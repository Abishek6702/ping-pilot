const mongoose = require("mongoose");
const Monitor = require("../models/Monitor");
const { generateAnalyticsReport } = require("../services/analyticsService");
const { isAdminUser, canAccessMonitor } = require("../utils/ownership");

/**
 * Get organization-wide or monitor-scoped advanced analytics.
 * GET /api/analytics
 */
async function getAnalytics(req, res, next) {
  try {
    const { range = "24h", startDate, endDate, monitorId } = req.query;

    let monitors = [];
    if (monitorId) {
      if (!mongoose.Types.ObjectId.isValid(monitorId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid monitorId parameter",
        });
      }
      const monitor = await Monitor.findById(monitorId);
      if (!monitor) {
        return res.status(404).json({
          success: false,
          error: "Monitor not found",
        });
      }
      if (!canAccessMonitor(req.user, monitor)) {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to access analytics for this monitor",
        });
      }
      monitors = [monitor];
    } else {
      const scopeFilter = isAdminUser(req.user) ? {} : { userId: req.user._id };
      const findQuery = Monitor.find(scopeFilter);
      monitors =
        typeof findQuery.lean === "function" ? await findQuery.lean() : await findQuery;
    }

    const report = await generateAnalyticsReport({
      monitors,
      range,
      startDate,
      endDate,
    });

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
}

/**
 * Get per-monitor analytics breakdown and trends.
 * GET /api/analytics/monitors/:id
 */
async function getMonitorAnalytics(req, res, next) {
  try {
    const { range = "24h", startDate, endDate } = req.query;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid monitor ID",
      });
    }

    const monitor = await Monitor.findById(req.params.id);
    if (!monitor) {
      return res.status(404).json({
        success: false,
        error: "Monitor not found",
      });
    }

    if (!canAccessMonitor(req.user, monitor)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to access analytics for this monitor",
      });
    }

    const report = await generateAnalyticsReport({
      monitors: [monitor],
      range,
      startDate,
      endDate,
    });

    return res.status(200).json({
      success: true,
      data: {
        ...report,
        monitor: report.perMonitor[0] || null,
      },
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
}

module.exports = {
  getAnalytics,
  getMonitorAnalytics,
};

