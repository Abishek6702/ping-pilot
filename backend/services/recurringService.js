const { executeMonitoringCycle } = require("./monitoringEngine");

/**
 * Starts an in-process recurring monitoring cycle (runs every 5 minutes by default).
 * Acts as an internal fallback alongside the external GitHub Actions scheduler.
 */
function startRecurringWorker({ logger = console, intervalMs = 5 * 60 * 1000 } = {}) {
  // Do not run background worker during test runs
  if (process.env.NODE_ENV === "test") {
    return () => {};
  }

  logger.log(`🕒 In-process monitoring worker initialized (interval: ${intervalMs / 1000}s)`);

  // Optional: run initial check 15 seconds after startup
  const initialTimer = setTimeout(async () => {
    try {
      logger.log("🔄 Running initial monitoring cycle on startup...");
      const summary = await executeMonitoringCycle();
      logger.log(`✅ Initial cycle complete: ${summary.checked || 0} monitors checked`);
    } catch (err) {
      logger.error("Error in initial monitoring cycle:", err.message);
    }
  }, 15000);

  const intervalId = setInterval(async () => {
    try {
      logger.log("🔄 Starting scheduled monitoring cycle...");
      const summary = await executeMonitoringCycle();
      logger.log(
        `✅ Cycle complete: ${summary.checked || 0} checked, ${summary.up || 0} UP, ${summary.down || 0} DOWN (${summary.durationMs || 0}ms)`
      );
    } catch (err) {
      logger.error("Error running recurring monitoring cycle:", err.message);
    }
  }, intervalMs);

  return function stopRecurringWorker() {
    clearTimeout(initialTimer);
    clearInterval(intervalId);
    logger.log("🛑 In-process monitoring worker stopped");
  };
}

module.exports = {
  startRecurringWorker,
};

