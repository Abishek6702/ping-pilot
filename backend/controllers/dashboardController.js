const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");

/**
 * Get dashboard overview metrics, summary cards, chart data, and recent activity
 * GET /api/dashboard?timeRange=24h (or 7d, 30d)
 */
async function getDashboard(req, res, next) {
  try {
    const { timeRange = "24h" } = req.query;

    let durationHours = 24;
    if (timeRange === "7d") durationHours = 24 * 7;
    else if (timeRange === "30d") durationHours = 24 * 30;

    const sinceDate = new Date(Date.now() - durationHours * 60 * 60 * 1000);

    // 1. Fetch all monitors
    const monitors = await Monitor.find().sort({ createdAt: -1 });

    const totalMonitors = monitors.length;
    const operational = monitors.filter((m) => m.isActive && m.currentStatus === "UP").length;
    const down = monitors.filter((m) => m.isActive && m.currentStatus === "DOWN").length;
    const paused = monitors.filter((m) => !m.isActive || m.currentStatus === "PAUSED").length;

    // 2. Aggregate stats for the given time range
    const [pingsSummary, recentActivity, timeSeriesData] = await Promise.all([
      PingResult.aggregate([
        { $match: { checkedAt: { $gte: sinceDate } } },
        {
          $group: {
            _id: null,
            totalPings: { $sum: 1 },
            successfulPings: {
              $sum: { $cond: [{ $eq: ["$status", "UP"] }, 1, 0] },
            },
            avgResponseTime: { $avg: "$responseTime" },
          },
        },
      ]),

      PingResult.find({ checkedAt: { $gte: sinceDate } })
        .populate("monitorId", "name url currentStatus")
        .sort({ checkedAt: -1 })
        .limit(10),

      // Aggregate data grouped by time interval for charts
      PingResult.aggregate([
        { $match: { checkedAt: { $gte: sinceDate } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: durationHours <= 24 ? "%Y-%m-%d %H:00" : "%Y-%m-%d",
                date: "$checkedAt",
              },
            },
            timestamp: { $first: "$checkedAt" },
            avgResponseTime: { $avg: "$responseTime" },
            totalChecks: { $sum: 1 },
            successfulChecks: {
              $sum: { $cond: [{ $eq: ["$status", "UP"] }, 1, 0] },
            },
          },
        },
        { $sort: { timestamp: 1 } },
      ]),
    ]);

    const totalPings = pingsSummary[0]?.totalPings || 0;
    const successfulPings = pingsSummary[0]?.successfulPings || 0;
    const overallUptime = totalPings > 0 ? Number(((successfulPings / totalPings) * 100).toFixed(2)) : 100;
    const avgResponseTime = pingsSummary[0]?.avgResponseTime
      ? Math.round(pingsSummary[0].avgResponseTime)
      : 0;

    // Calculate individual monitor uptime for table
    const monitorPings = await PingResult.aggregate([
      { $match: { checkedAt: { $gte: sinceDate } } },
      {
        $group: {
          _id: "$monitorId",
          total: { $sum: 1 },
          successful: {
            $sum: { $cond: [{ $eq: ["$status", "UP"] }, 1, 0] },
          },
          avgResponseTime: { $avg: "$responseTime" },
        },
      },
    ]);

    const monitorStatsMap = new Map();
    monitorPings.forEach((p) => {
      monitorStatsMap.set(p._id.toString(), {
        uptime: p.total > 0 ? Number(((p.successful / p.total) * 100).toFixed(1)) : 100,
        avgResponseTime: Math.round(p.avgResponseTime || 0),
      });
    });

    const monitorsWithStats = monitors.map((m) => {
      const stats = monitorStatsMap.get(m._id.toString()) || {
        uptime: m.currentStatus === "UP" ? 100 : 0,
        avgResponseTime: m.lastResponseTime || 0,
      };
      return {
        ...m.toObject(),
        uptimePercentage: stats.uptime,
        calculatedAvgResponseTime: stats.avgResponseTime,
      };
    });

    // Format chart points
    const charts = timeSeriesData.map((d) => ({
      time: d._id,
      timestamp: d.timestamp,
      avgResponseTime: Math.round(d.avgResponseTime || 0),
      uptimePercentage: d.totalChecks > 0 ? Number(((d.successfulChecks / d.totalChecks) * 100).toFixed(1)) : 100,
      checks: d.totalChecks,
      successes: d.successfulChecks,
      failures: d.totalChecks - d.successfulChecks,
    }));

    return res.status(200).json({
      success: true,
      timeRange,
      metrics: {
        totalMonitors,
        operational,
        down,
        paused,
        averageResponseTime: avgResponseTime,
        overallUptime,
        totalChecks: totalPings,
      },
      monitors: monitorsWithStats,
      charts,
      recentActivity,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboard,
};

