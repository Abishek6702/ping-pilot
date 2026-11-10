const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const { validateUrlForMonitoring } = require("../utils/ssrfFilter");
const { pingMonitor } = require("../services/monitoringEngine");

/**
 * Get all monitors with filtering, search, and pagination
 * GET /api/monitors
 */
async function getMonitors(req, res, next) {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status && status !== "ALL") {
      query.currentStatus = status.toUpperCase();
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { url: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [monitors, total] = await Promise.all([
      Monitor.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Monitor.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      monitors,
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
 * Create a new monitor
 * POST /api/monitors
 */
async function createMonitor(req, res, next) {
  try {
    const {
      name,
      description,
      url,
      method = "GET",
      interval = 5,
      timeout = 15,
      expectedStatusCodes = [200],
      isActive = true,
      failureThreshold = 2,
    } = req.body;

    // Validate URL against SSRF
    const ssrfCheck = await validateUrlForMonitoring(url);
    if (!ssrfCheck.valid) {
      return res.status(400).json({
        success: false,
        error: `URL rejected for security: ${ssrfCheck.error}`,
      });
    }

    const monitor = await Monitor.create({
      name,
      description: description || "",
      url,
      method: "GET",
      interval: Number(interval) || 5,
      timeout: Number(timeout) || 15,
      expectedStatusCodes: expectedStatusCodes || [200],
      isActive: isActive !== false,
      currentStatus: isActive === false ? "PAUSED" : "UNKNOWN",
      failureThreshold: Number(failureThreshold) || 2,
    });

    return res.status(201).json({
      success: true,
      message: "Monitor created successfully",
      monitor,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get monitor by ID
 * GET /api/monitors/:id
 */
async function getMonitorById(req, res, next) {
  try {
    const monitor = await Monitor.findById(req.params.id);
    if (!monitor) {
      return res.status(404).json({
        success: false,
        error: "Monitor not found",
      });
    }

    return res.status(200).json({
      success: true,
      monitor,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update monitor
 * PATCH /api/monitors/:id
 */
async function updateMonitor(req, res, next) {
  try {
    const monitor = await Monitor.findById(req.params.id);
    if (!monitor) {
      return res.status(404).json({
        success: false,
        error: "Monitor not found",
      });
    }

    const {
      name,
      description,
      url,
      interval,
      timeout,
      expectedStatusCodes,
      isActive,
      failureThreshold,
    } = req.body;

    // If URL is being changed, validate for SSRF
    if (url && url !== monitor.url) {
      const ssrfCheck = await validateUrlForMonitoring(url);
      if (!ssrfCheck.valid) {
        return res.status(400).json({
          success: false,
          error: `URL rejected for security: ${ssrfCheck.error}`,
        });
      }
      monitor.url = url;
    }

    if (name !== undefined) monitor.name = name;
    if (description !== undefined) monitor.description = description;
    if (interval !== undefined) monitor.interval = Number(interval);
    if (timeout !== undefined) monitor.timeout = Number(timeout);
    if (expectedStatusCodes !== undefined) monitor.expectedStatusCodes = expectedStatusCodes;
    if (failureThreshold !== undefined) monitor.failureThreshold = Number(failureThreshold);

    if (isActive !== undefined) {
      monitor.isActive = Boolean(isActive);
      if (!monitor.isActive) {
        monitor.currentStatus = "PAUSED";
      } else if (monitor.currentStatus === "PAUSED") {
        monitor.currentStatus = "UNKNOWN";
      }
    }

    await monitor.save();

    return res.status(200).json({
      success: true,
      message: "Monitor updated successfully",
      monitor,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete monitor and clean up related ping history
 * DELETE /api/monitors/:id
 */
async function deleteMonitor(req, res, next) {
  try {
    const monitor = await Monitor.findById(req.params.id);
    if (!monitor) {
      return res.status(404).json({
        success: false,
        error: "Monitor not found",
      });
    }

    await Promise.all([
      Monitor.findByIdAndDelete(req.params.id),
      PingResult.deleteMany({ monitorId: req.params.id }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Monitor and associated history deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Toggle monitor enable/pause status
 * PATCH /api/monitors/:id/toggle
 */
async function toggleMonitor(req, res, next) {
  try {
    const monitor = await Monitor.findById(req.params.id);
    if (!monitor) {
      return res.status(404).json({
        success: false,
        error: "Monitor not found",
      });
    }

    monitor.isActive = !monitor.isActive;
    if (!monitor.isActive) {
      monitor.currentStatus = "PAUSED";
    } else {
      monitor.currentStatus = "UNKNOWN";
    }

    await monitor.save();

    return res.status(200).json({
      success: true,
      message: monitor.isActive ? "Monitor enabled" : "Monitor paused",
      monitor,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Trigger manual ping
 * POST /api/monitors/:id/ping
 */
async function pingMonitorNow(req, res, next) {
  try {
    const monitor = await Monitor.findById(req.params.id);
    if (!monitor) {
      return res.status(404).json({
        success: false,
        error: "Monitor not found",
      });
    }

    const pingOutcome = await pingMonitor(monitor);

    return res.status(200).json({
      success: true,
      message: `Ping completed: ${pingOutcome.pingStatus} (${pingOutcome.responseTime}ms)`,
      result: pingOutcome,
      monitor,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMonitors,
  createMonitor,
  getMonitorById,
  updateMonitor,
  deleteMonitor,
  toggleMonitor,
  pingMonitorNow,
};

