const mongoose = require("mongoose");
const Monitor = require("../models/Monitor");
const {
  buildReportDataset,
  streamCsvReport,
  streamPdfReport,
} = require("../services/reportService");
const { isAdminUser, canAccessMonitor } = require("../utils/ownership");

async function resolveScopedMonitors(req, monitorId) {
  if (monitorId) {
    if (!mongoose.Types.ObjectId.isValid(monitorId)) {
      const err = new Error("Invalid monitorId parameter");
      err.statusCode = 400;
      throw err;
    }

    const monitor = await Monitor.findById(monitorId);
    if (!monitor) {
      const err = new Error("Monitor not found");
      err.statusCode = 404;
      throw err;
    }

    if (!canAccessMonitor(req.user, monitor)) {
      const err = new Error("You do not have permission to generate reports for this monitor");
      err.statusCode = 403;
      throw err;
    }

    return [monitor];
  }

  const filter = isAdminUser(req.user) ? {} : { userId: req.user._id };
  const query = Monitor.find(filter);
  return typeof query.lean === "function" ? await query.lean() : await query;
}

/**
 * Preview structured report data in JSON before exporting.
 * GET /api/reports/preview
 */
async function previewReport(req, res, next) {
  try {
    const {
      type = "summary",
      range = "7d",
      startDate,
      endDate,
      monitorId,
      timezone = "UTC",
    } = req.query;

    const monitors = await resolveScopedMonitors(req, monitorId);
    const dataset = await buildReportDataset({
      reportType: type,
      monitors,
      range,
      startDate,
      endDate,
      timezone,
    });

    const previewLimit = 100;
    return res.status(200).json({
      success: true,
      data: {
        metadata: dataset.metadata,
        summary: dataset.summary,
        columns: dataset.columns,
        totalRows: dataset.rows.length,
        truncated: dataset.rows.length > previewLimit,
        rows: dataset.rows.slice(0, previewLimit),
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
}

/**
 * Stream report download in CSV or PDF format.
 * GET /api/reports/export
 */
async function exportReport(req, res, next) {
  try {
    const {
      type = "summary",
      format = "csv",
      range = "7d",
      startDate,
      endDate,
      monitorId,
      timezone = "UTC",
    } = req.query;

    const normalizedFormat = String(format || "csv").toLowerCase();
    if (!["csv", "pdf"].includes(normalizedFormat)) {
      return res.status(400).json({
        success: false,
        error: "Unsupported export format. Use csv or pdf",
      });
    }

    const monitors = await resolveScopedMonitors(req, monitorId);
    const dataset = await buildReportDataset({
      reportType: type,
      monitors,
      range,
      startDate,
      endDate,
      timezone,
    });

    const dateStamp = new Date().toISOString().slice(0, 10);
    const safeType = dataset.metadata.reportType.replace(/[^a-z0-9-]/g, "");
    const filename = `pingpilot-${safeType}-report-${dateStamp}.${normalizedFormat}`;

    if (normalizedFormat === "csv") {
      return streamCsvReport(res, dataset, filename);
    }

    return streamPdfReport(res, dataset, filename);
  } catch (error) {
    if (error.statusCode && !res.headersSent) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
}

module.exports = {
  previewReport,
  exportReport,
};

