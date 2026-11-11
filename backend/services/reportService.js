const PDFDocument = require("pdfkit");
const mongoose = require("mongoose");
const Incident = require("../models/Incident");
const {
  resolveDateWindow,
  calculateIncidentOverlapMs,
  generateAnalyticsReport,
} = require("./analyticsService");
const { formatDuration } = require("./notificationService");

const VALID_REPORT_TYPES = [
  "summary",
  "uptime",
  "response-time",
  "incidents",
  "downtime",
  "comparison",
];

function isValidTimeZone(tz) {
  if (!tz) return true;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: String(tz) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats a Date into the user's chosen timezone string (defaulting to UTC).
 */
function formatTimestampForTimezone(dateValue, timezone = "UTC") {
  if (!dateValue) return "—";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "—";
  const tz = timezone && isValidTimeZone(timezone) ? String(timezone) : "UTC";
  try {
    const formatted = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d);
    return `${formatted} (${tz})`;
  } catch {
    return d.toISOString();
  }
}

/**
 * Escapes CSV cell values per RFC 4180 and neutralizes spreadsheet formula injection.
 */
function sanitizeCsvCell(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCsvRow(values) {
  return `${values.map(sanitizeCsvCell).join(",")}\r\n`;
}

function getReportTitle(reportType) {
  switch (reportType) {
    case "summary":
      return "Overall Monitoring Summary Report";
    case "uptime":
      return "Service Uptime & Availability Report";
    case "response-time":
      return "Response Time Performance Report";
    case "incidents":
      return "Incident Log & Timeline Report";
    case "downtime":
      return "Outage & Downtime Analysis Report";
    case "comparison":
      return "Service Availability Comparison Report";
    default:
      return "PingPilot Monitoring Report";
  }
}

async function fetchScopedIncidentsForWindow({ monitors, windowInfo }) {
  const monitorIds = monitors.map((m) => m._id).filter(Boolean);
  if (monitorIds.length === 0) return [];

  const canQuery =
    mongoose.connection.readyState === 1 ||
    Boolean(Incident.find && Incident.find._isMockFunction);
  if (!canQuery) return [];

  const query = Incident.find({
    monitorId: { $in: monitorIds },
    startedAt: { $lte: windowInfo.end },
    $or: [{ resolvedAt: null }, { resolvedAt: { $gte: windowInfo.start } }],
  });

  const docs =
    typeof query.sort === "function"
      ? await query.sort({ startedAt: -1 }).lean?.() || await query.sort({ startedAt: -1 })
      : await query;

  return docs || [];
}

/**
 * Builds structured metadata, summary KPIs, headers, and tabular rows for any report type.
 */
async function buildReportDataset({
  reportType = "summary",
  monitors = [],
  range = "7d",
  startDate,
  endDate,
  timezone = "UTC",
  now = new Date(),
} = {}) {
  const normalizedType = String(reportType || "summary").toLowerCase();
  if (!VALID_REPORT_TYPES.includes(normalizedType)) {
    const err = new Error(
      `Invalid report type. Supported types: ${VALID_REPORT_TYPES.join(", ")}`
    );
    err.statusCode = 400;
    throw err;
  }

  if (!isValidTimeZone(timezone)) {
    const err = new Error(`Invalid timezone identifier: ${timezone}`);
    err.statusCode = 400;
    throw err;
  }

  const windowInfo = resolveDateWindow({ range, startDate, endDate, now });
  const analytics = await generateAnalyticsReport({
    monitors,
    range,
    startDate,
    endDate,
    now,
  });

  const monitorNameMap = new Map(monitors.map((m) => [m._id.toString(), m.name]));
  const monitorUrlMap = new Map(monitors.map((m) => [m._id.toString(), m.url]));

  let columns = [];
  let rows = [];

  if (normalizedType === "summary" || normalizedType === "comparison") {
    columns = [
      { key: "name", label: "Service Name" },
      { key: "currentStatus", label: "Current Status" },
      { key: "uptimeLabel", label: "Uptime (%)" },
      { key: "avgResponseLabel", label: "Avg Response (ms)" },
      { key: "totalChecks", label: "Total Checks" },
      { key: "failedChecks", label: "Failed Checks" },
      { key: "totalIncidents", label: "Incidents" },
      { key: "downtimeLabel", label: "Downtime" },
      { key: "mttrLabel", label: "MTTR" },
    ];
    rows = analytics.perMonitor.map((m) => ({
      name: m.name,
      currentStatus: m.isActive ? m.currentStatus : "PAUSED",
      uptimeLabel:
        m.uptimePercentage !== null
          ? `${m.uptimePercentage}%`
          : m.dataStatus === "PAUSED"
            ? "Paused"
            : "No Data",
      avgResponseLabel: m.avgResponseTime !== null ? `${m.avgResponseTime}` : "—",
      totalChecks: m.totalChecks,
      failedChecks: m.failedChecks,
      totalIncidents: m.totalIncidents,
      downtimeLabel: formatDuration(m.totalDowntimeMs),
      mttrLabel: m.mttrMs !== null ? formatDuration(m.mttrMs) : "—",
    }));
  } else if (normalizedType === "uptime") {
    columns = [
      { key: "name", label: "Service Name" },
      { key: "url", label: "Endpoint URL" },
      { key: "dataStatus", label: "Monitoring State" },
      { key: "uptimeLabel", label: "Uptime (%)" },
      { key: "totalChecks", label: "Total Checks" },
      { key: "successfulChecks", label: "Successful Checks" },
      { key: "failedChecks", label: "Failed Checks" },
      { key: "downtimeLabel", label: "Window Downtime" },
    ];
    rows = analytics.perMonitor.map((m) => ({
      name: m.name,
      url: m.url,
      dataStatus: m.dataStatus,
      uptimeLabel: m.uptimePercentage !== null ? `${m.uptimePercentage}%` : "No Data",
      totalChecks: m.totalChecks,
      successfulChecks: m.successfulChecks,
      failedChecks: m.failedChecks,
      downtimeLabel: formatDuration(m.totalDowntimeMs),
    }));
  } else if (normalizedType === "response-time") {
    columns = [
      { key: "name", label: "Service Name" },
      { key: "method", label: "Method" },
      { key: "monitoringInterval", label: "Interval (min)" },
      { key: "totalChecks", label: "Samples" },
      { key: "avgResponseLabel", label: "Avg (ms)" },
      { key: "minResponseLabel", label: "Min (ms)" },
      { key: "maxResponseLabel", label: "Max (ms)" },
    ];
    rows = analytics.perMonitor.map((m) => ({
      name: m.name,
      method: m.method,
      monitoringInterval: m.monitoringInterval,
      totalChecks: m.totalChecks,
      avgResponseLabel: m.avgResponseTime !== null ? `${m.avgResponseTime}` : "—",
      minResponseLabel: m.minResponseTime !== null ? `${m.minResponseTime}` : "—",
      maxResponseLabel: m.maxResponseTime !== null ? `${m.maxResponseTime}` : "—",
    }));
  } else if (normalizedType === "incidents" || normalizedType === "downtime") {
    const incidents = await fetchScopedIncidentsForWindow({ monitors, windowInfo });
    columns = [
      { key: "incidentKey", label: "Incident ID" },
      { key: "serviceName", label: "Service" },
      { key: "serviceUrl", label: "Endpoint URL" },
      { key: "status", label: "Stage" },
      { key: "startedAtLabel", label: "Started At" },
      { key: "resolvedAtLabel", label: "Resolved At" },
      { key: "windowDowntimeLabel", label: "Window Downtime" },
      { key: "affectedChecksCount", label: "Failed Pings" },
      { key: "resolutionNotes", label: "Notes" },
    ];
    rows = incidents.map((inc) => {
      const mId = inc.monitorId?.toString?.() || String(inc.monitorId);
      const overlapMs = calculateIncidentOverlapMs(inc, windowInfo.start, windowInfo.end, now);
      return {
        incidentKey: inc.incidentKey,
        serviceName: monitorNameMap.get(mId) || "Monitored Service",
        serviceUrl: monitorUrlMap.get(mId) || "",
        status: inc.status,
        startedAtLabel: formatTimestampForTimezone(inc.startedAt, timezone),
        resolvedAtLabel: inc.resolvedAt
          ? formatTimestampForTimezone(inc.resolvedAt, timezone)
          : "Ongoing",
        windowDowntimeLabel: formatDuration(overlapMs),
        affectedChecksCount: inc.affectedChecksCount || 0,
        resolutionNotes: inc.resolutionNotes || inc.description || "",
      };
    });
  }

  return {
    metadata: {
      reportType: normalizedType,
      title: getReportTitle(normalizedType),
      timezone: timezone || "UTC",
      generatedAt: formatTimestampForTimezone(now, timezone),
      windowStart: formatTimestampForTimezone(windowInfo.start, timezone),
      windowEnd: formatTimestampForTimezone(windowInfo.end, timezone),
      range: windowInfo.range,
      monitorCount: monitors.length,
    },
    summary: {
      overallUptime:
        analytics.overview.overallUptime !== null
          ? `${analytics.overview.overallUptime}%`
          : "No Data",
      avgResponseTime:
        analytics.overview.avgResponseTime !== null
          ? `${analytics.overview.avgResponseTime} ms`
          : "—",
      totalChecks: analytics.overview.totalChecks,
      successfulChecks: analytics.overview.successfulChecks,
      failedChecks: analytics.overview.failedChecks,
      totalIncidents: analytics.overview.totalIncidents,
      totalDowntime: formatDuration(analytics.overview.totalDowntimeMs),
      mttr:
        analytics.overview.mttrMs !== null
          ? formatDuration(analytics.overview.mttrMs)
          : "N/A",
    },
    columns,
    rows,
  };
}

/**
 * Streams a UTF-8 BOM-safe, formula-injection-safe CSV document directly to an HTTP response.
 */
function streamCsvReport(res, dataset, filename) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");

  res.write(`# PingPilot Report: ${sanitizeCsvCell(dataset.metadata.title)}\r\n`);
  res.write(
    `# Window: ${sanitizeCsvCell(dataset.metadata.windowStart)} to ${sanitizeCsvCell(dataset.metadata.windowEnd)} | Generated: ${sanitizeCsvCell(dataset.metadata.generatedAt)}\r\n`
  );
  res.write(formatCsvRow(dataset.columns.map((c) => c.label)));

  const CHUNK_SIZE = 200;
  for (let i = 0; i < dataset.rows.length; i += CHUNK_SIZE) {
    const batch = dataset.rows.slice(i, i + CHUNK_SIZE);
    let buffer = "";
    for (const row of batch) {
      buffer += formatCsvRow(dataset.columns.map((col) => row[col.key]));
    }
    res.write(buffer);
  }

  res.end();
}

/**
 * Streams a formatted multi-page PDF document using pdfkit directly into the HTTP response.
 */
function streamPdfReport(res, dataset, filename) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");

  const doc = new PDFDocument({
    size: "A4",
    layout: dataset.columns.length > 6 ? "landscape" : "portrait",
    margin: 40,
    info: {
      Title: dataset.metadata.title,
      Author: "PingPilot Monitoring Platform",
    },
  });

  doc.pipe(res);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startX = doc.page.margins.left;

  // Brand Header Banner
  doc.rect(startX, 36, pageWidth, 54).fill("#0E7A88");
  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("PingPilot", startX + 14, 46);
  doc
    .font("Helvetica")
    .fontSize(11)
    .text(dataset.metadata.title, startX + 14, 67);

  doc
    .fillColor("#E0F2F1")
    .fontSize(8)
    .text(`Generated: ${dataset.metadata.generatedAt}`, startX + 14, 48, {
      width: pageWidth - 28,
      align: "right",
    });

  doc.y = 104;
  doc
    .fillColor("#334155")
    .font("Helvetica")
    .fontSize(9)
    .text(
      `Reporting Window: ${dataset.metadata.windowStart}  →  ${dataset.metadata.windowEnd}   |   Services Included: ${dataset.metadata.monitorCount}`,
      startX
    );

  // Summary Strip
  doc.moveDown(0.7);
  const summaryTop = doc.y;
  const kpis = [
    { label: "Overall Uptime", value: dataset.summary.overallUptime },
    { label: "Avg Response", value: dataset.summary.avgResponseTime },
    { label: "Total Checks", value: String(dataset.summary.totalChecks) },
    { label: "Incidents", value: String(dataset.summary.totalIncidents) },
    { label: "Downtime", value: dataset.summary.totalDowntime },
    { label: "MTTR", value: dataset.summary.mttr },
  ];

  const boxWidth = (pageWidth - 25) / kpis.length;
  kpis.forEach((kpi, idx) => {
    const x = startX + idx * (boxWidth + 5);
    doc.roundedRect(x, summaryTop, boxWidth, 42, 4).fillAndStroke("#F8FAFC", "#CBD5E1");
    doc
      .fillColor("#64748B")
      .font("Helvetica")
      .fontSize(7)
      .text(kpi.label, x + 6, summaryTop + 7, { width: boxWidth - 12 });
    doc
      .fillColor("#0F172A")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(String(kpi.value), x + 6, summaryTop + 20, { width: boxWidth - 12 });
  });

  doc.y = summaryTop + 56;

  const colCount = Math.max(1, dataset.columns.length);
  const colWidth = pageWidth / colCount;

  const drawTableHeader = (yPos) => {
    doc.rect(startX, yPos, pageWidth, 22).fill("#0F172A");
    dataset.columns.forEach((col, i) => {
      doc
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(col.label, startX + i * colWidth + 5, yPos + 7, {
          width: colWidth - 10,
          ellipsis: true,
        });
    });
    return yPos + 22;
  };

  if (dataset.rows.length === 0) {
    doc.roundedRect(startX, doc.y + 8, pageWidth, 56, 6).fillAndStroke("#F8FAFC", "#CBD5E1");
    doc
      .fillColor("#475569")
      .font("Helvetica")
      .fontSize(10)
      .text(
        "No records matched the selected report filters and date range.",
        startX + 16,
        doc.y + 28,
        { width: pageWidth - 32, align: "center" }
      );
    doc.end();
    return;
  }

  let currentY = drawTableHeader(doc.y);
  const maxY = doc.page.height - doc.page.margins.bottom - 24;

  dataset.rows.forEach((row, rowIdx) => {
    const rowHeight = 20;
    if (currentY + rowHeight > maxY) {
      doc.addPage();
      currentY = drawTableHeader(doc.page.margins.top);
    }

    if (rowIdx % 2 === 1) {
      doc.rect(startX, currentY, pageWidth, rowHeight).fill("#F8FAFC");
    }

    dataset.columns.forEach((col, i) => {
      const val = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : "—";
      doc
        .fillColor("#1E293B")
        .font("Helvetica")
        .fontSize(7.5)
        .text(val, startX + i * colWidth + 5, currentY + 6, {
          width: colWidth - 10,
          lineBreak: false,
          ellipsis: true,
        });
    });

    currentY += rowHeight;
  });

  doc.end();
}

module.exports = {
  VALID_REPORT_TYPES,
  isValidTimeZone,
  formatTimestampForTimezone,
  sanitizeCsvCell,
  buildReportDataset,
  streamCsvReport,
  streamPdfReport,
};

