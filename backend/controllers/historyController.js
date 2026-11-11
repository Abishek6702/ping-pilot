const mongoose = require("mongoose");
const PingResult = require("../models/PingResult");
const Monitor = require("../models/Monitor");
const { canAccessMonitor } = require("../utils/ownership");

/**
 * Get global monitoring history with filtering and pagination
 * GET /api/history
 */
async function getHistory(req, res, next) {
  try {
    const {
      monitorId,
      status,
      startDate,
      endDate,
      timeRange,
      page = 1,
      limit = 30,
    } = req.query;

    const query = {};

    if (req.user && req.user.role !== "admin") {
      const userMonitors = await Monitor.find({ userId: req.user._id }).select("_id");
      const allowedIds = userMonitors.map((m) => m._id.toString());

      if (monitorId) {
        if (!allowedIds.includes(monitorId.toString())) {
          return res.status(200).json({
            success: true,
            history: [],
            pagination: { page: 1, limit: parseInt(limit, 10), total: 0, pages: 1 },
          });
        }
        query.monitorId = monitorId;
      } else {
        query.monitorId = { $in: userMonitors.map((m) => m._id) };
      }
    } else if (monitorId && mongoose.Types.ObjectId.isValid(monitorId)) {
      query.monitorId = monitorId;
    }

    if (status && status !== "ALL") {
      query.status = status.toUpperCase();
    }

    if (timeRange) {
      let hours = 24;
      if (timeRange === "7d") hours = 24 * 7;
      if (timeRange === "30d") hours = 24 * 30;
      query.checkedAt = { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) };
    } else if (startDate || endDate) {
      query.checkedAt = {};
      if (startDate) query.checkedAt.$gte = new Date(startDate);
      if (endDate) query.checkedAt.$lte = new Date(endDate);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [results, total] = await Promise.all([
      PingResult.find(query)
        .populate("monitorId", "name url currentStatus")
        .sort({ checkedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      PingResult.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      history: results,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get history specific to a single monitor
 * GET /api/monitors/:id/history
 */
async function getMonitorHistory(req, res, next) {
  try {
    const { id } = req.params;
    const { status, timeRange = "24h", page = 1, limit = 50 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid monitor ID" });
    }

    const monitor = await Monitor.findById(id);
    if (!monitor) {
      return res.status(404).json({ success: false, error: "Monitor not found" });
    }

    if (!canAccessMonitor(req.user, monitor)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to view history for this monitor",
      });
    }

    let hours = 24;
    if (timeRange === "7d") hours = 24 * 7;
    if (timeRange === "30d") hours = 24 * 30;

    const query = {
      monitorId: id,
      checkedAt: { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) },
    };

    if (status && status !== "ALL") {
      query.status = status.toUpperCase();
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [results, total] = await Promise.all([
      PingResult.find(query).sort({ checkedAt: -1 }).skip(skip).limit(limitNum),
      PingResult.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      history: results,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get detailed statistics for a monitor
 * GET /api/monitors/:id/stats?timeRange=24h
 */
async function getMonitorStats(req, res, next) {
  try {
    const { id } = req.params;
    const { timeRange = "24h" } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid monitor ID" });
    }

    const monitor = await Monitor.findById(id);
    if (!monitor) {
      return res.status(404).json({ success: false, error: "Monitor not found" });
    }

    if (!canAccessMonitor(req.user, monitor)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to view stats for this monitor",
      });
    }

    let hours = 24;
    if (timeRange === "7d") hours = 24 * 7;
    if (timeRange === "30d") hours = 24 * 30;

    const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    const matchStage = {
      monitorId: new mongoose.Types.ObjectId(id),
      checkedAt: { $gte: sinceDate },
    };

    const [aggregateStats, timeSeriesPoints, recentPings] = await Promise.all([
      PingResult.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalPings: { $sum: 1 },
            successCount: {
              $sum: { $cond: [{ $eq: ["$status", "UP"] }, 1, 0] },
            },
            failureCount: {
              $sum: { $cond: [{ $eq: ["$status", "DOWN"] }, 1, 0] },
            },
            avgResponseTime: { $avg: "$responseTime" },
            minResponseTime: { $min: "$responseTime" },
            maxResponseTime: { $max: "$responseTime" },
          },
        },
      ]),

      PingResult.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              $dateToString: {
                format: hours <= 24 ? "%Y-%m-%d %H:00" : "%Y-%m-%d",
                date: "$checkedAt",
              },
            },
            timestamp: { $first: "$checkedAt" },
            avgResponseTime: { $avg: "$responseTime" },
            totalChecks: { $sum: 1 },
            successes: {
              $sum: { $cond: [{ $eq: ["$status", "UP"] }, 1, 0] },
            },
          },
        },
        { $sort: { timestamp: 1 } },
      ]),

      PingResult.find(matchStage).sort({ checkedAt: -1 }).limit(20),
    ]);

    const stats = aggregateStats[0] || {
      totalPings: 0,
      successCount: 0,
      failureCount: 0,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
    };

    const uptimePercentage =
      stats.totalPings > 0
        ? Number(((stats.successCount / stats.totalPings) * 100).toFixed(2))
        : monitor.currentStatus === "UP"
        ? 100
        : 0;

    const chartData = timeSeriesPoints.map((p) => ({
      time: p._id,
      timestamp: p.timestamp,
      avgResponseTime: Math.round(p.avgResponseTime || 0),
      uptimePercentage:
        p.totalChecks > 0 ? Number(((p.successes / p.totalChecks) * 100).toFixed(1)) : 100,
      totalChecks: p.totalChecks,
      successes: p.successes,
      failures: p.totalChecks - p.successes,
    }));

    return res.status(200).json({
      success: true,
      timeRange,
      stats: {
        uptimePercentage,
        averageResponseTime: Math.round(stats.avgResponseTime || 0),
        minResponseTime: Math.round(stats.minResponseTime || 0),
        maxResponseTime: Math.round(stats.maxResponseTime || 0),
        totalPings: stats.totalPings,
        successCount: stats.successCount,
        failureCount: stats.failureCount,
      },
      chartData,
      recentPings,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getHistory,
  getMonitorHistory,
  getMonitorStats,
};

