const { executeMonitoringCycle } = require("../services/monitoringEngine");

/**
 * Internal worker endpoint for external schedulers (e.g., GitHub Actions, cron)
 * POST /api/internal/monitor/run
 */
async function runMonitoringCycle(req, res, next) {
  try {
    const summary = await executeMonitoringCycle();
    const statusCode = summary.status === "skipped" ? 409 : 200;

    return res.status(statusCode).json({
      success: summary.status !== "skipped",
      ...summary,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to execute monitoring cycle",
    });
  }
}

module.exports = {
  runMonitoringCycle,
};

