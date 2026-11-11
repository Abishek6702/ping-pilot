const { executeMonitoringCycle } = require("./monitoringEngine");

let activeStopHandler = null;

/**
 * Starts the optional local/fallback recurring monitoring cycle (60s cadence matching the central due-monitor window).
 *
 * In production (Render), GitHub Actions acts as the central 1-minute scheduler hitting
 * POST /api/internal/monitor/run so two independent schedulers do not run by default.
 * Set ENABLE_IN_PROCESS_WORKER="true" to opt into an in-process fallback alongside GitHub Actions;
 * both share CycleLock and atomic per-monitor claiming in MongoDB.
 */
function startRecurringWorker({
  logger = console,
  intervalMs = 60 * 1000,
  initialDelayMs = 15000,
  forceInTest = false,
} = {}) {
  // Do not run background worker during test runs unless explicitly opted in by scheduler tests
  if (process.env.NODE_ENV === "test" && !forceInTest) {
    return () => {};
  }

  // In production, GitHub Actions is the single central scheduler unless fallback is explicitly enabled
  const explicitFlag = process.env.ENABLE_IN_PROCESS_WORKER;
  const shouldRunInCurrentEnv =
    forceInTest ||
    explicitFlag === "true" ||
    (process.env.NODE_ENV !== "production" && explicitFlag !== "false");

  if (!shouldRunInCurrentEnv) {
    logger.log(
      "🕒 In-process scheduler disabled in production (central scheduling delegated to GitHub Actions -> /api/internal/monitor/run)"
    );
    return () => {};
  }

  // Prevent duplicate scheduler initialization within the same process
  if (activeStopHandler) {
    logger.warn?.("⚠️ In-process monitoring worker already initialized; skipping duplicate startup.");
    return activeStopHandler;
  }

  logger.log(`🕒 In-process fallback monitoring worker initialized (interval: ${intervalMs / 1000}s)`);

  // Run initial check after startup stabilization delay (processes only due/uninitialized monitors)
  const initialTimer = setTimeout(async () => {
    try {
      logger.log("🔄 Running initial due-monitor check on startup...");
      const summary = await executeMonitoringCycle({ source: "startup" });
      if (summary.status === "skipped") {
        logger.log(`⚠️ Initial cycle skipped: ${summary.reason}`);
      } else {
        logger.log(
          `✅ Initial cycle complete: ${summary.checked || 0} checked, ${summary.skipped || 0} skipped`
        );
      }
    } catch (err) {
      logger.error("Error in initial monitoring cycle:", err?.message || err);
    }
  }, initialDelayMs);

  const intervalId = setInterval(async () => {
    try {
      const summary = await executeMonitoringCycle({ source: "interval" });
      if (summary.status === "skipped") {
        logger.log(`⚠️ Scheduled cycle skipped: ${summary.reason}`);
      } else if ((summary.checked || 0) > 0) {
        logger.log(
          `✅ Due-monitor cycle complete: ${summary.checked} checked, ${summary.up || 0} UP, ${summary.down || 0} DOWN (${summary.durationMs || 0}ms)`
        );
      }
    } catch (err) {
      logger.error("Error running recurring monitoring cycle:", err?.message || err);
    }
  }, intervalMs);

  activeStopHandler = function stopRecurringWorker() {
    clearTimeout(initialTimer);
    clearInterval(intervalId);
    activeStopHandler = null;
    logger.log("🛑 In-process monitoring worker stopped");
  };

  return activeStopHandler;
}

module.exports = {
  startRecurringWorker,
};

