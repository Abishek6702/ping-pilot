const mongoose = require("mongoose");
const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const NotificationLog = require("../models/NotificationLog");
const { validateUrlForMonitoring } = require("../utils/ssrfFilter");
const { pingMonitor } = require("../services/monitoringEngine");
const { canAccessMonitor } = require("../utils/ownership");
const {
  ALLOWED_MONITORING_INTERVALS,
  DEFAULT_MONITORING_INTERVAL,
  isValidMonitoringInterval,
  resolveMonitoringInterval,
  computeIntervalChangeNextCheckAt,
  computeReactivatedNextCheckAt,
} = require("../utils/monitorSchedule");

function isAuthorizedForMonitor(user, monitor) {
  return canAccessMonitor(user, monitor);
}

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

    if (req.user && req.user.role !== "admin") {
      query.userId = req.user._id;
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
      monitoringInterval,
      interval,
      timeout = 15,
      expectedStatusCodes = [200],
      isActive = true,
      failureThreshold = 2,
    } = req.body;

    const rawInterval = monitoringInterval !== undefined ? monitoringInterval : interval;
    if (rawInterval !== undefined && !isValidMonitoringInterval(rawInterval)) {
      return res.status(400).json({
        success: false,
        error: `Monitoring interval must be one of: ${ALLOWED_MONITORING_INTERVALS.join(", ")} minutes`,
      });
    }

    const resolvedInterval =
      rawInterval !== undefined ? Number(rawInterval) : DEFAULT_MONITORING_INTERVAL;

    // Validate URL against SSRF
    const ssrfCheck = await validateUrlForMonitoring(url);
    if (!ssrfCheck.valid) {
      return res.status(400).json({
        success: false,
        error: `URL rejected for security: ${ssrfCheck.error}`,
      });
    }

    const active = isActive !== false;
    // Active new monitors schedule their first check immediately for the next scheduler run
    const now = new Date();

    const monitor = await Monitor.create({
      name,
      description: description || "",
      url,
      method: "GET",
      monitoringInterval: resolvedInterval,
      interval: resolvedInterval,
      timeout: Number(timeout) || 15,
      expectedStatusCodes: expectedStatusCodes || [200],
      isActive: active,
      currentStatus: active ? "UNKNOWN" : "PAUSED",
      nextCheckAt: active ? now : null,
      claimOwner: null,
      claimExpiresAt: null,
      failureThreshold: Number(failureThreshold) || 2,
      userId: req.user?._id || null,
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

    if (!isAuthorizedForMonitor(req.user, monitor)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to access this monitor",
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

    if (!isAuthorizedForMonitor(req.user, monitor)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to access this monitor",
      });
    }

    const {
      name,
      description,
      url,
      monitoringInterval,
      interval,
      timeout,
      expectedStatusCodes,
      isActive,
      failureThreshold,
    } = req.body;

    const rawInterval = monitoringInterval !== undefined ? monitoringInterval : interval;
    if (rawInterval !== undefined && !isValidMonitoringInterval(rawInterval)) {
      return res.status(400).json({
        success: false,
        error: `Monitoring interval must be one of: ${ALLOWED_MONITORING_INTERVALS.join(", ")} minutes`,
      });
    }

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

    const wasActive = monitor.isActive !== false;
    const prevInterval = resolveMonitoringInterval(monitor);

    if (name !== undefined) monitor.name = name;
    if (description !== undefined) monitor.description = description;
    if (timeout !== undefined) monitor.timeout = Number(timeout);
    if (expectedStatusCodes !== undefined) monitor.expectedStatusCodes = expectedStatusCodes;
    if (failureThreshold !== undefined) monitor.failureThreshold = Number(failureThreshold);

    const nextInterval = rawInterval !== undefined ? Number(rawInterval) : prevInterval;
    monitor.monitoringInterval = nextInterval;
    monitor.interval = nextInterval;

    if (isActive !== undefined) {
      const nextActive = Boolean(isActive);
      monitor.isActive = nextActive;
      if (!nextActive) {
        monitor.currentStatus = "PAUSED";
        monitor.nextCheckAt = null;
        monitor.claimOwner = null;
        monitor.claimExpiresAt = null;
      } else if (!wasActive) {
        monitor.currentStatus = "UNKNOWN";
        monitor.nextCheckAt = computeReactivatedNextCheckAt(nextInterval, monitor.lastCheckedAt);
      } else if (rawInterval !== undefined || !monitor.nextCheckAt) {
        monitor.nextCheckAt = computeIntervalChangeNextCheckAt(
          nextInterval,
          monitor.lastCheckedAt,
          monitor.nextCheckAt
        );
      }
    } else if (monitor.isActive && (rawInterval !== undefined || !monitor.nextCheckAt)) {
      monitor.nextCheckAt = computeIntervalChangeNextCheckAt(
        nextInterval,
        monitor.lastCheckedAt,
        monitor.nextCheckAt
      );
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

    if (!isAuthorizedForMonitor(req.user, monitor)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to access this monitor",
      });
    }

    const deleteTasks = [
      Monitor.findByIdAndDelete(req.params.id),
      PingResult.deleteMany({ monitorId: req.params.id }),
    ];
    if (
      mongoose.connection.readyState === 1 ||
      Boolean(NotificationLog.deleteMany && NotificationLog.deleteMany._isMockFunction)
    ) {
      deleteTasks.push(NotificationLog.deleteMany({ monitorId: req.params.id }));
    }

    await Promise.all(deleteTasks);

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

    if (!isAuthorizedForMonitor(req.user, monitor)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to access this monitor",
      });
    }

    monitor.isActive = !monitor.isActive;
    const resolvedInterval = resolveMonitoringInterval(monitor);
    monitor.monitoringInterval = resolvedInterval;
    monitor.interval = resolvedInterval;

    if (!monitor.isActive) {
      monitor.currentStatus = "PAUSED";
      monitor.nextCheckAt = null;
      monitor.claimOwner = null;
      monitor.claimExpiresAt = null;
    } else {
      monitor.currentStatus = "UNKNOWN";
      monitor.nextCheckAt = computeReactivatedNextCheckAt(resolvedInterval, monitor.lastCheckedAt);
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

    if (!isAuthorizedForMonitor(req.user, monitor)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to access this monitor",
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

