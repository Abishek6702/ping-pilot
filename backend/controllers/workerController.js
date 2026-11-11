const { executeMonitoringCycle } = require("../services/monitoringEngine");

/**
 * Internal worker endpoint for external schedulers (e.g., GitHub Actions, cron)
 * POST /api/internal/monitor/run
 */
async function runMonitoringCycle(req, res, _next) {
  try {
    const force = Boolean(req.body && req.body.force === true);
    const summary = await executeMonitoringCycle({ source: "worker", force });
    const statusCode = summary.status === "skipped" ? 409 : 200;

    return res.status(statusCode).json({
      success: summary.status !== "skipped",
      ...summary,
    });
  } catch (error) {
    console.error("Monitoring worker cycle error:", error?.message || error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to execute monitoring cycle",
    });
  }
}

module.exports = {
  runMonitoringCycle,
};

