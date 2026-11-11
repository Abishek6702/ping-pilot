const mongoose = require("mongoose");
const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const Incident = require("../models/Incident");
const { calculateIncidentOverlapMs: _ignored } = {};

const PRESET_DURATIONS_MS = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function isDbOrMockReady(model, method) {
  return (
    mongoose.connection.readyState === 1 ||
    Boolean(model && model[method] && model[method]._isMockFunction)
  );
}

/**
 * Resolves current and preceding comparison time windows from preset range or custom dates.
 */
function resolveDateWindow({ range = "24h", startDate, endDate, now = new Date() } = {}) {
  const currentNow = now instanceof Date ? now : new Date(now);
  const normalizedRange = String(range || "24h").toLowerCase();

  let start;
  let end;

  if (normalizedRange === "custom" || (startDate && endDate)) {
    if (!startDate || !endDate) {
      const err = new Error("Both startDate and endDate are required for custom range");
      err.statusCode = 400;
      throw err;
    }
    start = new Date(startDate);
    end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      const err = new Error("Invalid startDate or endDate provided");
      err.statusCode = 400;
      throw err;
    }
    if (end <= start) {
      const err = new Error("endDate must be later than startDate");
      err.statusCode = 400;
      throw err;
    }
    const maxSpanMs = 366 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > maxSpanMs) {
      const err = new Error("Custom analytics range cannot exceed 366 days");
      err.statusCode = 400;
      throw err;
    }
  } else {
    const durationMs = PRESET_DURATIONS_MS[normalizedRange];
    if (!durationMs) {
      const err = new Error("Invalid range parameter. Use 24h, 7d, 30d, or custom");
      err.statusCode = 400;
      throw err;
    }
    end = currentNow;
    start = new Date(end.getTime() - durationMs);
  }

  const spanMs = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime());
  const previousStart = new Date(previousEnd.getTime() - spanMs);
  const granularity = spanMs <= 48 * 60 * 60 * 1000 ? "hour" : "day";

  return {
    range: normalizedRange === "custom" || (startDate && endDate) ? "custom" : normalizedRange,
    start,
    end,
    previousStart,
    previousEnd,
    spanMs,
    granularity,
  };
}

/**
 * Computes exact outage overlap in milliseconds inside [windowStart, windowEnd].
 */
function calculateIncidentOverlapMs(incident, windowStart, windowEnd, now = new Date()) {
  if (!incident || !incident.startedAt) return 0;
  const incStart = new Date(incident.startedAt).getTime();
  const incEnd = incident.resolvedAt ? new Date(incident.resolvedAt).getTime() : new Date(now).getTime();
  const winStart = new Date(windowStart).getTime();
  const winEnd = new Date(windowEnd).getTime();

  if (
    Number.isNaN(incStart) ||
    Number.isNaN(incEnd) ||
    Number.isNaN(winStart) ||
    Number.isNaN(winEnd)
  ) {
    return 0;
  }

  const effectiveStart = Math.max(incStart, winStart);
  const effectiveEnd = Math.min(incEnd, winEnd);
  return Math.max(0, effectiveEnd - effectiveStart);
}

/**
 * Computes Mean Time To Recovery (MTTR) in milliseconds across resolved incidents,
 * returning null when there are no resolved incidents.
 */
function calculateMttrMs(incidents = []) {
  const resolved = incidents.filter((inc) => inc && !inc.isActive && inc.resolvedAt && inc.startedAt);
  if (resolved.length === 0) return null;

  let totalMs = 0;
  for (const inc of resolved) {
    const duration =
      inc.downtimeDurationMs !== null && inc.downtimeDurationMs !== undefined
        ? Math.max(0, Number(inc.downtimeDurationMs))
        : Math.max(0, new Date(inc.resolvedAt).getTime() - new Date(inc.startedAt).getTime());
    totalMs += duration;
  }

  return Math.round(totalMs / resolved.length);
}

/**
 * Builds normalized analytics metrics for a single monitor inside a time window.
 * Missing checks never produce a fabricated 100% uptime; uptimePercentage stays null.
 */
function buildMonitorAnalyticsSummary({
  monitor,
  pingAgg = null,
  incidents = [],
  windowStart,
  windowEnd,
  now = new Date(),
}) {
  const totalChecks = pingAgg?.totalChecks || 0;
  const successfulChecks = pingAgg?.successfulChecks || 0;
  const failedChecks = pingAgg?.failedChecks || 0;

  let dataStatus;
  if (totalChecks > 0) {
    dataStatus = monitor.isActive ? "ACTIVE" : "PAUSED_WITH_DATA";
  } else {
    dataStatus = monitor.isActive ? "NO_DATA" : "PAUSED";
  }

  const uptimePercentage =
    totalChecks > 0 ? Number(((successfulChecks / totalChecks) * 100).toFixed(2)) : null;

  const avgResponseTime =
    totalChecks > 0 && pingAgg?.avgResponseTime !== null && pingAgg?.avgResponseTime !== undefined
      ? Math.round(pingAgg.avgResponseTime)
      : null;

  const minResponseTime =
    totalChecks > 0 && pingAgg?.minResponseTime !== null && pingAgg?.minResponseTime !== undefined
      ? Math.round(pingAgg.minResponseTime)
      : null;

  const maxResponseTime =
    totalChecks > 0 && pingAgg?.maxResponseTime !== null && pingAgg?.maxResponseTime !== undefined
      ? Math.round(pingAgg.maxResponseTime)
      : null;

  const monitorIdStr = monitor._id?.toString?.() || String(monitor._id);
  const overlappingIncidents = incidents.filter((inc) => {
    const incMonitorId = inc.monitorId?._id?.toString?.() || inc.monitorId?.toString?.() || String(inc.monitorId);
    return incMonitorId === monitorIdStr && calculateIncidentOverlapMs(inc, windowStart, windowEnd, now) >= 0 &&
      new Date(inc.startedAt).getTime() <= new Date(windowEnd).getTime() &&
      (!inc.resolvedAt || new Date(inc.resolvedAt).getTime() >= new Date(windowStart).getTime());
  });

  const totalDowntimeMs = overlappingIncidents.reduce(
    (sum, inc) => sum + calculateIncidentOverlapMs(inc, windowStart, windowEnd, now),
    0
  );

  const activeIncidentsCount = overlappingIncidents.filter((inc) => inc.isActive).length;
  const resolvedIncidentsCount = overlappingIncidents.length - activeIncidentsCount;
  const mttrMs = calculateMttrMs(overlappingIncidents);

  return {
    monitorId: monitorIdStr,
    name: monitor.name,
    url: monitor.url,
    method: monitor.method || "GET",
    isActive: Boolean(monitor.isActive),
    currentStatus: monitor.currentStatus || "UNKNOWN",
    monitoringInterval: monitor.monitoringInterval || monitor.interval || 5,
    dataStatus,
    uptimePercentage,
    avgResponseTime,
    minResponseTime,
    maxResponseTime,
    totalChecks,
    successfulChecks,
    failedChecks,
    totalIncidents: overlappingIncidents.length,
    activeIncidentsCount,
    resolvedIncidentsCount,
    totalDowntimeMs,
    mttrMs,
  };
}

async function aggregateWindowMetrics({ monitorObjectIds, start, end, granularity }) {
  if (!monitorObjectIds || monitorObjectIds.length === 0) {
    return { perMonitorMap: new Map(), overallPing: null, timeSeries: [], incidents: [] };
  }

  const bucketFormat = granularity === "hour" ? "%Y-%m-%dT%H:00:00.000Z" : "%Y-%m-%d";

  let perMonitorAgg = [];
  let seriesAgg = [];
  let incidents = [];

  if (isDbOrMockReady(PingResult, "aggregate")) {
    [perMonitorAgg, seriesAgg] = await Promise.all([
      PingResult.aggregate([
        {
          $match: {
            monitorId: { $in: monitorObjectIds },
            checkedAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: "$monitorId",
            totalChecks: { $sum: 1 },
            successfulChecks: {
              $sum: { $cond: [{ $eq: ["$status", "UP"] }, 1, 0] },
            },
            failedChecks: {
              $sum: { $cond: [{ $eq: ["$status", "DOWN"] }, 1, 0] },
            },
            avgResponseTime: { $avg: "$responseTime" },
            minResponseTime: { $min: "$responseTime" },
            maxResponseTime: { $max: "$responseTime" },
          },
        },
      ]),
      PingResult.aggregate([
        {
          $match: {
            monitorId: { $in: monitorObjectIds },
            checkedAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: bucketFormat,
                date: "$checkedAt",
              },
            },
            totalChecks: { $sum: 1 },
            successfulChecks: {
              $sum: { $cond: [{ $eq: ["$status", "UP"] }, 1, 0] },
            },
            failedChecks: {
              $sum: { $cond: [{ $eq: ["$status", "DOWN"] }, 1, 0] },
            },
            avgResponseTime: { $avg: "$responseTime" },
            minResponseTime: { $min: "$responseTime" },
            maxResponseTime: { $max: "$responseTime" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);
  }

  if (isDbOrMockReady(Incident, "find")) {
    const incQuery = Incident.find({
      monitorId: { $in: monitorObjectIds },
      startedAt: { $lte: end },
      $or: [{ resolvedAt: null }, { resolvedAt: { $gte: start } }],
    });
    incidents = typeof incQuery.lean === "function" ? await incQuery.lean() : await incQuery;
  }

  const perMonitorMap = new Map();
  let totalChecks = 0;
  let successfulChecks = 0;
  let failedChecks = 0;
  let weightedResponseSum = 0;
  let minResponseTime = null;
  let maxResponseTime = null;

  for (const row of perMonitorAgg) {
    perMonitorMap.set(row._id.toString(), row);
    totalChecks += row.totalChecks || 0;
    successfulChecks += row.successfulChecks || 0;
    failedChecks += row.failedChecks || 0;
    if (row.avgResponseTime !== null && row.avgResponseTime !== undefined) {
      weightedResponseSum += row.avgResponseTime * (row.totalChecks || 0);
    }
    if (row.minResponseTime !== null && row.minResponseTime !== undefined) {
      minResponseTime =
        minResponseTime === null ? row.minResponseTime : Math.min(minResponseTime, row.minResponseTime);
    }
    if (row.maxResponseTime !== null && row.maxResponseTime !== undefined) {
      maxResponseTime =
        maxResponseTime === null ? row.maxResponseTime : Math.max(maxResponseTime, row.maxResponseTime);
    }
  }

  const overallPing = {
    totalChecks,
    successfulChecks,
    failedChecks,
    avgResponseTime: totalChecks > 0 ? Math.round(weightedResponseSum / totalChecks) : null,
    minResponseTime: minResponseTime !== null ? Math.round(minResponseTime) : null,
    maxResponseTime: maxResponseTime !== null ? Math.round(maxResponseTime) : null,
    overallUptime:
      totalChecks > 0 ? Number(((successfulChecks / totalChecks) * 100).toFixed(2)) : null,
  };

  const timeSeries = (seriesAgg || []).map((bucket) => ({
    bucket: bucket._id,
    totalChecks: bucket.totalChecks || 0,
    successfulChecks: bucket.successfulChecks || 0,
    failedChecks: bucket.failedChecks || 0,
    uptimePercentage:
      bucket.totalChecks > 0
        ? Number(((bucket.successfulChecks / bucket.totalChecks) * 100).toFixed(2))
        : null,
    avgResponseTime:
      bucket.avgResponseTime !== null && bucket.avgResponseTime !== undefined
        ? Math.round(bucket.avgResponseTime)
        : null,
    minResponseTime:
      bucket.minResponseTime !== null && bucket.minResponseTime !== undefined
        ? Math.round(bucket.minResponseTime)
        : null,
    maxResponseTime:
      bucket.maxResponseTime !== null && bucket.maxResponseTime !== undefined
        ? Math.round(bucket.maxResponseTime)
        : null,
  }));

  return { perMonitorMap, overallPing, timeSeries, incidents };
}

function summarizeOverview({ overallPing, incidents, start, end, now }) {
  const totalDowntimeMs = incidents.reduce(
    (sum, inc) => sum + calculateIncidentOverlapMs(inc, start, end, now),
    0
  );
  const mttrMs = calculateMttrMs(incidents);
  const activeIncidentsCount = incidents.filter((inc) => inc.isActive).length;

  return {
    overallUptime: overallPing.overallUptime,
    avgResponseTime: overallPing.avgResponseTime,
    minResponseTime: overallPing.minResponseTime,
    maxResponseTime: overallPing.maxResponseTime,
    totalChecks: overallPing.totalChecks,
    successfulChecks: overallPing.successfulChecks,
    failedChecks: overallPing.failedChecks,
    totalIncidents: incidents.length,
    activeIncidentsCount,
    resolvedIncidentsCount: incidents.length - activeIncidentsCount,
    totalDowntimeMs,
    mttrMs,
  };
}

function computeComparisonDeltas(currentSummary, previousSummary) {
  const deltaOrNull = (curr, prev, decimals = 0) => {
    if (curr === null || curr === undefined || prev === null || prev === undefined) {
      return null;
    }
    const diff = curr - prev;
    return decimals > 0 ? Number(diff.toFixed(decimals)) : Math.round(diff);
  };

  return {
    previousPeriod: previousSummary,
    deltas: {
      uptimePercentageDelta: deltaOrNull(currentSummary.overallUptime, previousSummary.overallUptime, 2),
      avgResponseTimeDelta: deltaOrNull(currentSummary.avgResponseTime, previousSummary.avgResponseTime, 0),
      totalChecksDelta: deltaOrNull(currentSummary.totalChecks, previousSummary.totalChecks, 0),
      totalIncidentsDelta: deltaOrNull(currentSummary.totalIncidents, previousSummary.totalIncidents, 0),
      totalDowntimeDeltaMs: deltaOrNull(currentSummary.totalDowntimeMs, previousSummary.totalDowntimeMs, 0),
      mttrDeltaMs: deltaOrNull(currentSummary.mttrMs, previousSummary.mttrMs, 0),
    },
  };
}

/**
 * Generates comprehensive analytics for all accessible monitors (or a single monitor),
 * including historical period comparisons, response trends, and service comparisons.
 */
async function generateAnalyticsReport({
  monitors = [],
  range = "24h",
  startDate,
  endDate,
  now = new Date(),
} = {}) {
  const windowInfo = resolveDateWindow({ range, startDate, endDate, now });
  const monitorObjectIds = monitors
    .map((m) => (typeof m._id === "string" && mongoose.Types.ObjectId.isValid(m._id)
      ? new mongoose.Types.ObjectId(m._id)
      : m._id))
    .filter(Boolean);

  const [currentData, previousData] = await Promise.all([
    aggregateWindowMetrics({
      monitorObjectIds,
      start: windowInfo.start,
      end: windowInfo.end,
      granularity: windowInfo.granularity,
    }),
    aggregateWindowMetrics({
      monitorObjectIds,
      start: windowInfo.previousStart,
      end: windowInfo.previousEnd,
      granularity: windowInfo.granularity,
    }),
  ]);

  const overview = summarizeOverview({
    overallPing: currentData.overallPing || {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      avgResponseTime: null,
      minResponseTime: null,
      maxResponseTime: null,
      overallUptime: null,
    },
    incidents: currentData.incidents,
    start: windowInfo.start,
    end: windowInfo.end,
    now,
  });

  const previousOverview = summarizeOverview({
    overallPing: previousData.overallPing || {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      avgResponseTime: null,
      minResponseTime: null,
      maxResponseTime: null,
      overallUptime: null,
    },
    incidents: previousData.incidents,
    start: windowInfo.previousStart,
    end: windowInfo.previousEnd,
    now,
  });

  const perMonitor = monitors
    .map((monitor) =>
      buildMonitorAnalyticsSummary({
        monitor,
        pingAgg: currentData.perMonitorMap.get(monitor._id.toString()) || null,
        incidents: currentData.incidents,
        windowStart: windowInfo.start,
        windowEnd: windowInfo.end,
        now,
      })
    )
    .sort((a, b) => {
      if (a.uptimePercentage === null && b.uptimePercentage !== null) return 1;
      if (b.uptimePercentage === null && a.uptimePercentage !== null) return -1;
      if (a.uptimePercentage !== null && b.uptimePercentage !== null && a.uptimePercentage !== b.uptimePercentage) {
        return a.uptimePercentage - b.uptimePercentage;
      }
      return (b.totalDowntimeMs || 0) - (a.totalDowntimeMs || 0);
    });

  return {
    window: {
      range: windowInfo.range,
      startDate: windowInfo.start.toISOString(),
      endDate: windowInfo.end.toISOString(),
      previousStartDate: windowInfo.previousStart.toISOString(),
      previousEndDate: windowInfo.previousEnd.toISOString(),
      granularity: windowInfo.granularity,
    },
    overview: {
      ...overview,
      totalMonitors: monitors.length,
      activeMonitorsCount: monitors.filter((m) => m.isActive).length,
      pausedMonitorsCount: monitors.filter((m) => !m.isActive).length,
    },
    comparison: computeComparisonDeltas(overview, previousOverview),
    timeSeries: currentData.timeSeries,
    perMonitor,
  };
}

module.exports = {
  resolveDateWindow,
  calculateIncidentOverlapMs,
  calculateMttrMs,
  buildMonitorAnalyticsSummary,
  generateAnalyticsReport,
};

