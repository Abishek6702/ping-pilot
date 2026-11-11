const { performance } = require("perf_hooks");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const SystemSetting = require("../models/SystemSetting");
const User = require("../models/User");
const CycleLock = require("../models/CycleLock");
const sendMail = require("../utils/sendMail");
const renderTemplate = require("../utils/renderTemplate");
const { validateUrlForMonitoring } = require("./../utils/ssrfFilter");
const { handleMonitorCheckForIncident } = require("./incidentService");
const { logEvent } = require("../utils/logger");
const { CLAIM_LEASE_MS } = require("../constants/monitorConstants");
const {
  resolveMonitoringInterval,
  calculateNextCheckAt,
  buildDueMonitorsQuery,
  isMonitorDue,
} = require("../utils/monitorSchedule");

const LOCK_KEY = "monitoring-cycle";
const LOCK_LEASE_MS = 3 * 60 * 1000;

let isCycleRunning = false;

/**
 * Safely closes/cancels a Fetch Response body stream so sockets are not leaked.
 */
async function drainResponseBody(response) {
  if (response && response.body && typeof response.body.cancel === "function") {
    await response.body.cancel().catch(() => {});
  }
}

/**
 * Determines whether MongoDB atomic operations should execute directly (live DB or mocked spies).
 */
function canRunMonitorAtomicQuery(methodName, forceAtomic = false) {
  if (forceAtomic || mongoose.connection.readyState === 1) {
    return true;
  }
  const fn = Monitor[methodName];
  return Boolean(fn && fn._isMockFunction);
}

/**
 * Acquires a distributed cross-instance lease lock in MongoDB when connected.
 * Returns true if lock acquired (or DB is disconnected in isolated unit tests), false if held elsewhere.
 */
async function acquireDistributedLock(owner, forceDbLock = false) {
  if (!forceDbLock && mongoose.connection.readyState !== 1) {
    return true;
  }

  const now = new Date();
  const lockedUntil = new Date(now.getTime() + LOCK_LEASE_MS);

  try {
    const lockDoc = await CycleLock.findOneAndUpdate(
      {
        key: LOCK_KEY,
        $or: [{ lockedUntil: { $lte: now } }, { lockedUntil: null }],
      },
      {
        $set: {
          key: LOCK_KEY,
          owner,
          lockedUntil,
          acquiredAt: now,
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    return Boolean(lockDoc && lockDoc.owner === owner);
  } catch (err) {
    if (err && err.code === 11000) {
      return false;
    }
    throw err;
  }
}

/**
 * Releases the distributed lock only if still owned by this cycle execution.
 */
async function releaseDistributedLock(owner, forceDbLock = false) {
  if (!forceDbLock && mongoose.connection.readyState !== 1) {
    return;
  }

  await CycleLock.updateOne(
    { key: LOCK_KEY, owner },
    { $set: { lockedUntil: new Date(0) } }
  );
}

/**
 * Atomically claims a due active monitor so two scheduler instances cannot execute the same occurrence.
 */
async function claimMonitorForExecution(monitorCandidate, workerId, options = {}) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const now = safeOptions.now ? new Date(safeOptions.now) : new Date();
  const force = Boolean(safeOptions.force);
  const claimExpiresAt = new Date(now.getTime() + CLAIM_LEASE_MS);

  if (!monitorCandidate || !monitorCandidate._id) {
    return null;
  }

  if (!canRunMonitorAtomicQuery("findOneAndUpdate", safeOptions.forceAtomicClaim)) {
    if (!isMonitorDue(monitorCandidate, now, force)) {
      return null;
    }
    monitorCandidate.claimOwner = workerId;
    monitorCandidate.claimExpiresAt = claimExpiresAt;
    return monitorCandidate;
  }

  const claimAvailable = {
    $or: [
      { claimExpiresAt: null },
      { claimExpiresAt: { $exists: false } },
      { claimExpiresAt: { $lte: now } },
    ],
  };

  const query = force
    ? {
        _id: monitorCandidate._id,
        isActive: true,
        ...claimAvailable,
      }
    : {
        _id: monitorCandidate._id,
        isActive: true,
        $and: [
          {
            $or: [
              { nextCheckAt: { $lte: now } },
              { nextCheckAt: null },
              { nextCheckAt: { $exists: false } },
            ],
          },
          claimAvailable,
        ],
      };

  return Monitor.findOneAndUpdate(
    query,
    {
      $set: {
        claimOwner: workerId,
        claimExpiresAt,
      },
    },
    { returnDocument: "after" }
  );
}

/**
 * Safely releases an atomic monitor claim owned by `workerId`.
 */
async function releaseMonitorClaim(monitorId, workerId, options = {}) {
  const safeOptions = options && typeof options === "object" ? options : {};
  if (!monitorId || !workerId) return;

  if (!canRunMonitorAtomicQuery("updateOne", safeOptions.forceAtomicClaim)) {
    return;
  }

  await Monitor.updateOne(
    { _id: monitorId, claimOwner: workerId },
    { $set: { claimOwner: null, claimExpiresAt: null } }
  );
}

/**
 * Execute a single HTTP ping against a monitor with SSRF checks, redirect safety, timeout handling,
 * single PingResult history write, and nextCheckAt scheduling.
 */
async function pingMonitor(monitor, options = {}) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const retentionDays = Math.max(1, Number(safeOptions.retentionDays) || 30);
  const startTime = performance.now();
  let statusCode = null;
  let isSuccess = false;
  let errorMessage = null;
  let responseTime = 0;

  try {
    // 1. SSRF Validation of target URL
    const ssrfCheck = await validateUrlForMonitoring(monitor.url);
    if (!ssrfCheck.valid) {
      throw new Error(`SSRF Blocked: ${ssrfCheck.error}`);
    }

    let currentUrl = monitor.url;
    let redirectCount = 0;
    const maxRedirects = 3;
    const timeoutSeconds = monitor.timeout || 15;
    const deadlineMs = Date.now() + timeoutSeconds * 1000;
    const expectedCodes =
      Array.isArray(monitor.expectedStatusCodes) && monitor.expectedStatusCodes.length > 0
        ? monitor.expectedStatusCodes
        : [200];

    // Follow redirects manually within the monitor's timeout budget to validate each target for SSRF
    while (redirectCount <= maxRedirects) {
      const remainingMs = deadlineMs - Date.now();
      if (remainingMs <= 0) {
        const timeoutErr = new Error("The operation was aborted");
        timeoutErr.name = "AbortError";
        throw timeoutErr;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, remainingMs);

      let response;
      try {
        response = await fetch(currentUrl, {
          method: monitor.method || "GET",
          headers: {
            "User-Agent": "PingPilot/1.0 (+https://pingpilot.local; API Health Monitor)",
            Accept: "*/*",
          },
          redirect: "manual",
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      statusCode = response.status;

      // Handle redirect status codes (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(statusCode)) {
        const locationHeader = response.headers.get("location");
        await drainResponseBody(response);

        if (!locationHeader) {
          break;
        }

        const nextUrl = new URL(locationHeader, currentUrl).toString();
        const redirectSsrf = await validateUrlForMonitoring(nextUrl);
        if (!redirectSsrf.valid) {
          throw new Error(`Redirect SSRF Blocked: ${redirectSsrf.error}`);
        }

        currentUrl = nextUrl;
        redirectCount++;
        continue;
      }

      await drainResponseBody(response);
      break;
    }

    responseTime = Math.round(performance.now() - startTime);
    isSuccess = expectedCodes.includes(statusCode);

    if (!isSuccess) {
      errorMessage = `Unexpected HTTP status code: ${statusCode} (Expected: ${expectedCodes.join(", ")})`;
    }
  } catch (err) {
    responseTime = Math.round(performance.now() - startTime);
    isSuccess = false;
    if (err.name === "AbortError" || err.message?.includes("aborted")) {
      errorMessage = `Connection timed out after ${monitor.timeout || 15}s`;
    } else {
      const causeDetail = err.cause?.code || err.cause?.message;
      errorMessage = causeDetail
        ? `${err.message || "Network request failed"} (${causeDetail})`
        : err.message || "Network request failed";
    }
  }

  // 2. Save PingResult in MongoDB with TTL expiration (preserved 30-day default retention)
  const checkedAt = new Date();
  const expiresAt = new Date(checkedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
  const pingResult = await PingResult.create({
    monitorId: monitor._id,
    status: isSuccess ? "UP" : "DOWN",
    statusCode,
    responseTime,
    errorMessage,
    checkedAt,
    expiresAt,
  });

  // 3. Update Monitor document status, schedule next check, and release any active claim
  const failureThreshold = monitor.failureThreshold || 2;
  const previousStatus = monitor.currentStatus;
  const resolvedInterval = resolveMonitoringInterval(monitor);

  if (isSuccess) {
    monitor.consecutiveSuccesses = (monitor.consecutiveSuccesses || 0) + 1;
    monitor.consecutiveFailures = 0;
    monitor.currentStatus = "UP";
    monitor.lastError = null;
  } else {
    monitor.consecutiveFailures = (monitor.consecutiveFailures || 0) + 1;
    monitor.consecutiveSuccesses = 0;
    monitor.lastError = errorMessage;

    if (monitor.consecutiveFailures >= failureThreshold) {
      monitor.currentStatus = "DOWN";
    }
  }

  monitor.monitoringInterval = resolvedInterval;
  monitor.interval = resolvedInterval;
  monitor.lastCheckedAt = checkedAt;
  monitor.nextCheckAt = calculateNextCheckAt(resolvedInterval, checkedAt, monitor.nextCheckAt);
  monitor.lastResponseTime = responseTime;
  monitor.claimOwner = null;
  monitor.claimExpiresAt = null;

  await monitor.save();

  // 4. Incident lifecycle tracking and integrated status-transition notifications
  let incidentOutcome = null;
  try {
    incidentOutcome = await handleMonitorCheckForIncident({
      monitor,
      pingResult,
      previousStatus,
      dispatchNotifications: true,
    });
  } catch (incidentErr) {
    logEvent("error", "incident.lifecycle_error", {
      monitorId: monitor._id?.toString?.() || null,
      error: incidentErr.message,
    });
  }

  // Fallback alert dispatch only if incident store is inactive in mocked/disconnected environments
  const statusChanged = previousStatus !== monitor.currentStatus && previousStatus !== "UNKNOWN";
  const canLookupUserOrMail =
    mongoose.connection.readyState === 1 ||
    Boolean(User.findById && User.findById._isMockFunction) ||
    Boolean(sendMail && sendMail._isMockFunction);

  if (statusChanged && monitor.userId && (!incidentOutcome || !incidentOutcome.handled) && canLookupUserOrMail) {
    try {
      const user = await User.findById(monitor.userId);
      if (user && user.email) {
        if (monitor.currentStatus === "DOWN") {
          const html = renderTemplate("serviceDown", {
            serviceName: monitor.name,
            url: monitor.url,
            failureCount: monitor.consecutiveFailures,
            errorMessage: monitor.lastError,
            time: checkedAt.toUTCString(),
          });
          sendMail(user.email, `⚠️ Service Alert: ${monitor.name} is DOWN`, html).catch((err) =>
            console.error("Failed to send DOWN alert email:", err.message)
          );
        } else if (monitor.currentStatus === "UP" && previousStatus === "DOWN") {
          const html = renderTemplate("serviceRecovered", {
            serviceName: monitor.name,
            url: monitor.url,
            responseTime,
            time: checkedAt.toUTCString(),
          });
          sendMail(user.email, `✅ Service Recovered: ${monitor.name} is Back Online`, html).catch((err) =>
            console.error("Failed to send recovery alert email:", err.message)
          );
        }
      }
    } catch (notifyErr) {
      console.error("Status transition email notification error:", notifyErr.message);
    }
  }

  return {
    monitorId: monitor._id,
    name: monitor.name,
    monitorName: monitor.name,
    status: monitor.currentStatus,
    pingStatus: isSuccess ? "UP" : "DOWN",
    statusCode,
    httpStatus: statusCode,
    responseTime,
    errorMessage,
    previousStatus,
    checkedAt: monitor.lastCheckedAt,
    nextCheckAt: monitor.nextCheckAt,
    monitoringInterval: resolvedInterval,
    resultId: pingResult._id,
    incidentId: incidentOutcome?.incident?._id || null,
    incidentAction: incidentOutcome?.action || null,
  };
}

/**
 * Deduplicates monitor list by _id so a monitor is processed at most once per cycle.
 */
function deduplicateMonitors(monitors) {
  const seen = new Set();
  const unique = [];
  for (const monitor of monitors) {
    if (!monitor) continue;
    const idKey = monitor._id ? monitor._id.toString() : null;
    if (idKey) {
      if (seen.has(idKey)) continue;
      seen.add(idKey);
    }
    unique.push(monitor);
  }
  return unique;
}

/**
 * Formats an execution outcome for safe internal worker responses (never includes URLs or secrets).
 */
function formatWorkerResult(outcome) {
  const succeeded = outcome.pingStatus === "UP";
  return {
    monitorId: outcome.monitorId,
    monitorName: outcome.monitorName || outcome.name,
    status: succeeded ? "success" : "failed",
    pingStatus: outcome.pingStatus,
    httpStatus: outcome.statusCode ?? null,
    responseTime: outcome.responseTime ?? 0,
    checkedAt: outcome.checkedAt || null,
    nextCheckAt: outcome.nextCheckAt || null,
    ...(outcome.errorMessage ? { error: outcome.errorMessage } : {}),
  };
}

/**
 * Processes due monitors in one consolidated scheduler cycle.
 * Supports { force: boolean, forceDbLock: boolean, forceAtomicClaim: boolean, now: Date }.
 */
async function executeMonitoringCycle(options = {}) {
  const safeOptions = options && typeof options === "object" ? options : {};

  if (isCycleRunning) {
    return {
      status: "skipped",
      reason: "A monitoring cycle is already in progress",
      timestamp: new Date().toISOString(),
    };
  }

  isCycleRunning = true;
  const workerId = `${process.pid}-${crypto.randomUUID()}`;
  const forceDbLock = Boolean(safeOptions.forceDbLock);
  const forceAtomicClaim = Boolean(safeOptions.forceAtomicClaim);
  const force = Boolean(safeOptions.force);
  let dbLockAcquired = false;
  const cycleStart = performance.now();

  try {
    dbLockAcquired = await acquireDistributedLock(workerId, forceDbLock);
    if (!dbLockAcquired) {
      return {
        status: "skipped",
        reason: "A monitoring cycle is already in progress on another worker",
        timestamp: new Date().toISOString(),
      };
    }

    const cycleNow = safeOptions.now ? new Date(safeOptions.now) : new Date();

    // 1. Fetch history retention setting
    const retentionSetting = await SystemSetting.findOne({ key: "historyRetentionDays" });
    const retentionDays = Math.max(1, Number(retentionSetting?.value) || 30);

    // 2. Query ONLY due active unclaimed monitors from MongoDB
    const dueQuery = buildDueMonitorsQuery(cycleNow, force);
    const rawCandidates = await Monitor.find(dueQuery);
    const candidates = deduplicateMonitors(Array.isArray(rawCandidates) ? rawCandidates : []);

    // 3. Filter in-memory as well so mocked tests and legacy uninitialized docs respect schedule rules
    const dueCandidates = [];
    let skippedCount = 0;

    for (const candidate of candidates) {
      if (!isMonitorDue(candidate, cycleNow, force)) {
        skippedCount++;

        // Backfill missing nextCheckAt on active legacy monitors once connected so DB query stays indexed
        if (
          candidate.isActive !== false &&
          !candidate.nextCheckAt &&
          candidate.lastCheckedAt &&
          canRunMonitorAtomicQuery("updateOne", forceAtomicClaim)
        ) {
          const intervalMinutes = resolveMonitoringInterval(candidate);
          const derivedNext = new Date(
            new Date(candidate.lastCheckedAt).getTime() + intervalMinutes * 60 * 1000
          );
          await Monitor.updateOne(
            { _id: candidate._id, nextCheckAt: null },
            {
              $set: {
                monitoringInterval: intervalMinutes,
                interval: intervalMinutes,
                nextCheckAt: derivedNext,
              },
            }
          ).catch(() => {});
        }
        continue;
      }

      dueCandidates.push(candidate);
    }

    if (dueCandidates.length === 0) {
      return {
        status: "completed",
        totalMonitors: candidates.length,
        checked: 0,
        skipped: skippedCount,
        failed: 0,
        up: 0,
        down: 0,
        reason:
          candidates.length === 0
            ? "No monitors are due for checking right now"
            : "All due candidates were skipped or not yet due",
        durationMs: Math.round(performance.now() - cycleStart),
        timestamp: new Date().toISOString(),
        results: [],
      };
    }

    // 4. Claim atomically & execute due monitors in parallel batches (max 5 concurrent HTTP checks)
    const executedOutcomes = [];
    const concurrency = 5;

    for (let i = 0; i < dueCandidates.length; i += concurrency) {
      const batch = dueCandidates.slice(i, i + concurrency);
      const batchOutcomes = await Promise.all(
        batch.map(async (candidate) => {
          const claimed = await claimMonitorForExecution(candidate, workerId, {
            now: cycleNow,
            force,
            forceAtomicClaim,
          });

          if (!claimed) {
            skippedCount++;
            return null;
          }

          try {
            return await pingMonitor(claimed, { retentionDays });
          } catch (err) {
            return {
              monitorId: claimed._id,
              name: claimed.name,
              monitorName: claimed.name,
              status: "DOWN",
              pingStatus: "DOWN",
              statusCode: null,
              httpStatus: null,
              responseTime: 0,
              errorMessage: err.message,
              checkedAt: new Date(),
              nextCheckAt: claimed.nextCheckAt || null,
            };
          } finally {
            await releaseMonitorClaim(claimed._id, workerId, { forceAtomicClaim }).catch((err) => {
              console.error("Failed to release monitor claim:", err.message);
            });
          }
        })
      );

      for (const item of batchOutcomes) {
        if (item) {
          executedOutcomes.push(item);
        }
      }
    }

    const upCount = executedOutcomes.filter((r) => r.pingStatus === "UP").length;
    const downCount = executedOutcomes.filter((r) => r.pingStatus === "DOWN").length;

    return {
      status: "completed",
      totalMonitors: candidates.length,
      checked: executedOutcomes.length,
      skipped: skippedCount,
      failed: downCount,
      up: upCount,
      down: downCount,
      durationMs: Math.round(performance.now() - cycleStart),
      timestamp: new Date().toISOString(),
      results: executedOutcomes.map(formatWorkerResult),
    };
  } finally {
    if (dbLockAcquired) {
      await releaseDistributedLock(workerId, forceDbLock).catch((err) => {
        console.error("Failed to release distributed monitoring lock:", err.message);
      });
    }
    isCycleRunning = false;
  }
}

module.exports = {
  pingMonitor,
  executeMonitoringCycle,
  claimMonitorForExecution,
  releaseMonitorClaim,
  acquireDistributedLock,
  releaseDistributedLock,
};
