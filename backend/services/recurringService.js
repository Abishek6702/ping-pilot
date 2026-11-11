const { executeMonitoringCycle } = require("./monitoringEngine");

let activeStopHandler = null;

/**
 * Starts an in-process recurring monitoring cycle (runs every 5 minutes by default).
 * Acts as an internal fallback alongside the external GitHub Actions scheduler.
 */
function startRecurringWorker({
  logger = console,
  intervalMs = 5 * 60 * 1000,
  initialDelayMs = 15000,
  forceInTest = false,
} = {}) {
  // Do not run background worker during test runs unless explicitly opted in by scheduler tests
  if (process.env.NODE_ENV === "test" && !forceInTest) {
    return () => {};
  }

  // Prevent duplicate scheduler initialization within the same process
  if (activeStopHandler) {
    logger.warn?.("⚠️ In-process monitoring worker already initialized; skipping duplicate startup.");
    return activeStopHandler;
  }

  logger.log(`🕒 In-process monitoring worker initialized (interval: ${intervalMs / 1000}s)`);

  // Run initial check after startup stabilization delay
  const initialTimer = setTimeout(async () => {
    try {
      logger.log("🔄 Running initial monitoring cycle on startup...");
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
      logger.log("🔄 Starting scheduled monitoring cycle...");
      const summary = await executeMonitoringCycle({ source: "interval" });
      if (summary.status === "skipped") {
        logger.log(`⚠️ Scheduled cycle skipped: ${summary.reason}`);
      } else {
        logger.log(
          `✅ Cycle complete: ${summary.checked || 0} checked, ${summary.up || 0} UP, ${summary.down || 0} DOWN (${summary.durationMs || 0}ms)`
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

