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
 * Execute a single HTTP ping against a monitor with SSRF checks, redirect safety, and timeout handling.
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
    const expectedCodes =
      Array.isArray(monitor.expectedStatusCodes) && monitor.expectedStatusCodes.length > 0
        ? monitor.expectedStatusCodes
        : [200];

    // Follow redirects manually to validate each target for SSRF
    while (redirectCount <= maxRedirects) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutSeconds * 1000);

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
          break; // No location header to follow
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

      // Reached final destination
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

  // 2. Save PingResult in MongoDB with TTL expiration
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

  // 3. Update Monitor document status and failure/success counters
  const failureThreshold = monitor.failureThreshold || 2;
  const previousStatus = monitor.currentStatus;

  if (isSuccess) {
    monitor.consecutiveSuccesses = (monitor.consecutiveSuccesses || 0) + 1;
    monitor.consecutiveFailures = 0;
    monitor.currentStatus = "UP";
    monitor.lastError = null;
  } else {
    monitor.consecutiveFailures = (monitor.consecutiveFailures || 0) + 1;
    monitor.consecutiveSuccesses = 0;
    monitor.lastError = errorMessage;

    // Change to DOWN only if failure threshold reached
    if (monitor.consecutiveFailures >= failureThreshold) {
      monitor.currentStatus = "DOWN";
    }
  }

  monitor.lastCheckedAt = checkedAt;
  monitor.lastResponseTime = responseTime;

  await monitor.save();

  // Send status transition email alerts if status changed
  const statusChanged = previousStatus !== monitor.currentStatus && previousStatus !== "UNKNOWN";
  if (statusChanged && monitor.userId) {
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
    status: monitor.currentStatus,
    pingStatus: isSuccess ? "UP" : "DOWN",
    statusCode,
    responseTime,
    errorMessage,
    previousStatus,
    checkedAt: monitor.lastCheckedAt,
    resultId: pingResult._id,
  };
}

/**
 * Deduplicates monitor list by _id so a monitor is checked at most once per cycle.
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
 * Execute a complete monitoring cycle for all active monitors.
 * Supports { force: boolean } to bypass cooldown interval checks when explicitly triggered.
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
  const lockOwner = `${process.pid}-${crypto.randomUUID()}`;
  const forceDbLock = Boolean(safeOptions.forceDbLock);
  let dbLockAcquired = false;
  const cycleStart = performance.now();

  try {
    dbLockAcquired = await acquireDistributedLock(lockOwner, forceDbLock);
    if (!dbLockAcquired) {
      return {
        status: "skipped",
        reason: "A monitoring cycle is already in progress on another worker",
        timestamp: new Date().toISOString(),
      };
    }

    // 1. Fetch system settings
    const retentionSetting = await SystemSetting.findOne({ key: "historyRetentionDays" });
    const retentionDays = Math.max(1, Number(retentionSetting?.value) || 30);

    // 2. Fetch all enabled monitors and deduplicate by ID
    const rawActiveMonitors = await Monitor.find({ isActive: true });
    const activeMonitors = deduplicateMonitors(Array.isArray(rawActiveMonitors) ? rawActiveMonitors : []);

    // 3. Filter monitors that are due based on their configured interval
    const now = Date.now();
    const monitorsToPing = activeMonitors.filter((monitor) => {
      if (monitor.isActive === false) return false;
      if (safeOptions.force) return true;
      if (!monitor.lastCheckedAt) return true;
      const intervalMs = (monitor.interval || 5) * 60 * 1000;
      // Allow up to 15% (capped at 45s) buffer for cron/timer jitter while blocking duplicate pings
      const jitterBufferMs = Math.min(45000, Math.floor(intervalMs * 0.15));
      return now - new Date(monitor.lastCheckedAt).getTime() >= intervalMs - jitterBufferMs;
    });

    const skippedCount = activeMonitors.length - monitorsToPing.length;

    if (monitorsToPing.length === 0) {
      return {
        status: "completed",
        totalMonitors: activeMonitors.length,
        checked: 0,
        skipped: skippedCount,
        up: 0,
        down: 0,
        reason:
          activeMonitors.length === 0
            ? "No active monitors configured"
            : "All active monitors were checked recently and are not due yet",
        durationMs: Math.round(performance.now() - cycleStart),
        timestamp: new Date().toISOString(),
      };
    }

    // 4. Execute checks with a concurrency batch limit (max 5 parallel requests)
    const results = [];
    const concurrency = 5;
    for (let i = 0; i < monitorsToPing.length; i += concurrency) {
      const batch = monitorsToPing.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((m) =>
          pingMonitor(m, { retentionDays }).catch((err) => ({
            monitorId: m._id,
            name: m.name,
            status: "DOWN",
            pingStatus: "DOWN",
            statusCode: null,
            responseTime: 0,
            errorMessage: err.message,
          }))
        )
      );
      results.push(...batchResults);
    }

    const upCount = results.filter((r) => r.pingStatus === "UP").length;
    const downCount = results.filter((r) => r.pingStatus === "DOWN").length;

    return {
      status: "completed",
      totalMonitors: activeMonitors.length,
      checked: results.length,
      skipped: skippedCount,
      up: upCount,
      down: downCount,
      durationMs: Math.round(performance.now() - cycleStart),
      timestamp: new Date().toISOString(),
      results,
    };
  } finally {
    if (dbLockAcquired) {
      await releaseDistributedLock(lockOwner, forceDbLock).catch((err) => {
        console.error("Failed to release distributed monitoring lock:", err.message);
      });
    }
    isCycleRunning = false;
  }
}

module.exports = {
  pingMonitor,
  executeMonitoringCycle,
  acquireDistributedLock,
  releaseDistributedLock,
};

