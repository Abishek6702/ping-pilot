const { performance } = require("perf_hooks");
const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const SystemSetting = require("../models/SystemSetting");
const User = require("../models/User");
const sendMail = require("../utils/sendMail");
const renderTemplate = require("../utils/renderTemplate");
const { validateUrlForMonitoring } = require("./../utils/ssrfFilter");

let isCycleRunning = false;

/**
 * Execute a single HTTP ping against a monitor with SSRF checks, redirect safety, and timeout handling.
 */
async function pingMonitor(monitor, options = {}) {
  const retentionDays = options.retentionDays || 30;
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
      errorMessage = err.message || "Network request failed";
    }
  }

  // 2. Save PingResult in MongoDB with 30-day TTL expiration
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
  const pingResult = await PingResult.create({
    monitorId: monitor._id,
    status: isSuccess ? "UP" : "DOWN",
    statusCode,
    responseTime,
    errorMessage,
    checkedAt: new Date(),
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
    } else if (previousStatus === "UNKNOWN") {
      // If UNKNOWN and failed first time, keep UNKNOWN or set DOWN depending on threshold
      if (monitor.consecutiveFailures >= failureThreshold) {
        monitor.currentStatus = "DOWN";
      }
    }
  }

  monitor.lastCheckedAt = new Date();
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
            time: new Date().toUTCString(),
          });
          sendMail(user.email, `⚠️ Service Alert: ${monitor.name} is DOWN`, html).catch((err) =>
            console.error("Failed to send DOWN alert email:", err.message)
          );
        } else if (monitor.currentStatus === "UP" && previousStatus === "DOWN") {
          const html = renderTemplate("serviceRecovered", {
            serviceName: monitor.name,
            url: monitor.url,
            responseTime,
            time: new Date().toUTCString(),
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
 * Execute a complete monitoring cycle for all active monitors
 */
async function executeMonitoringCycle() {
  if (isCycleRunning) {
    return {
      status: "skipped",
      reason: "A monitoring cycle is already in progress",
      timestamp: new Date().toISOString(),
    };
  }

  isCycleRunning = true;
  const cycleStart = performance.now();

  try {
    // 1. Fetch system settings
    const retentionSetting = await SystemSetting.findOne({ key: "historyRetentionDays" });
    const retentionDays = retentionSetting ? Number(retentionSetting.value) || 30 : 30;

    // 2. Fetch all enabled monitors
    const activeMonitors = await Monitor.find({ isActive: true });

    // Filter monitors that are due based on their configured interval (prevents duplicate pings across multiple instances/restarts)
    const now = Date.now();
    const monitorsToPing = activeMonitors.filter((monitor) => {
      if (options.force) return true;
      if (!monitor.lastCheckedAt) return true;
      const intervalMs = (monitor.interval || 5) * 60 * 1000;
      // Allow 45s buffer for clock/cron jitter, but block near-duplicate pings
      return now - new Date(monitor.lastCheckedAt).getTime() >= intervalMs - 45000;
    });

    if (monitorsToPing.length === 0) {
      return {
        status: "completed",
        totalMonitors: activeMonitors.length,
        checked: 0,
        skipped: activeMonitors.length,
        up: 0,
        down: 0,
        reason: "All active monitors were checked recently and are not due yet",
        durationMs: Math.round(performance.now() - cycleStart),
        timestamp: new Date().toISOString(),
      };
    }

    // 3. Execute checks with a concurrency batch limit (max 5 parallel requests)
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
      up: upCount,
      down: downCount,
      durationMs: Math.round(performance.now() - cycleStart),
      timestamp: new Date().toISOString(),
      results,
    };
  } finally {
    isCycleRunning = false;
  }
}

module.exports = {
  pingMonitor,
  executeMonitoringCycle,
};

