const mongoose = require("mongoose");
const Incident = require("../models/Incident");
const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const NotificationLog = require("../models/NotificationLog");
const { computeDowntimeDurationMs } = require("../services/incidentService");
const {
  isAdminUser,
  canAccessMonitor,
  canAccessOwnedResource,
} = require("../utils/ownership");

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function serializeIncident(doc) {
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  const resolvedMs =
    obj.downtimeDurationMs !== null && obj.downtimeDurationMs !== undefined
      ? obj.downtimeDurationMs
      : obj.isActive && obj.startedAt
        ? Math.max(0, Date.now() - new Date(obj.startedAt).getTime())
        : computeDowntimeDurationMs(obj.startedAt, obj.resolvedAt);

  return {
    ...obj,
    liveDurationMs: resolvedMs,
  };
}

function isDbOrMockReady(model, method) {
  return (
    mongoose.connection.readyState === 1 ||
    Boolean(model && model[method] && model[method]._isMockFunction)
  );
}

/**
 * List incidents with user isolation, filtering by monitor, status, active state, and date range.
 * GET /api/incidents
 */
async function getIncidents(req, res, next) {
  try {
    const {
      monitorId,
      status,
      activeOnly,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (!isAdminUser(req.user)) {
      filter.userId = req.user._id;
    }

    if (monitorId) {
      if (!mongoose.Types.ObjectId.isValid(monitorId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid monitorId filter",
        });
      }

      if (isDbOrMockReady(Monitor, "findById")) {
        const monitor = await Monitor.findById(monitorId);
        if (monitor && !canAccessMonitor(req.user, monitor)) {
          return res.status(403).json({
            success: false,
            error: "You do not have permission to view incidents for this monitor",
          });
        }
      }

      filter.monitorId = monitorId;
    }

    if (status && status !== "ALL") {
      const requestedStatuses = String(status)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const invalidStatuses = requestedStatuses.filter(
        (s) => !Incident.INCIDENT_STATUSES.includes(s)
      );
      if (invalidStatuses.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid incident status filter: ${invalidStatuses.join(", ")}`,
        });
      }
      filter.status =
        requestedStatuses.length === 1
          ? requestedStatuses[0]
          : { $in: requestedStatuses };
    }

    if (activeOnly === "true") {
      filter.isActive = true;
    } else if (activeOnly === "false") {
      filter.isActive = false;
    }

    if (startDate || endDate) {
      filter.startedAt = {};
      if (startDate) {
        const parsedStart = new Date(startDate);
        if (Number.isNaN(parsedStart.getTime())) {
          return res.status(400).json({
            success: false,
            error: "Invalid startDate parameter",
          });
        }
        filter.startedAt.$gte = parsedStart;
      }
      if (endDate) {
        const parsedEnd = new Date(endDate);
        if (Number.isNaN(parsedEnd.getTime())) {
          return res.status(400).json({
            success: false,
            error: "Invalid endDate parameter",
          });
        }
        filter.startedAt.$lte = parsedEnd;
      }
    }

    if (search && String(search).trim()) {
      const rx = new RegExp(escapeRegex(String(search).trim()), "i");
      filter.$or = [{ title: rx }, { incidentKey: rx }, { description: rx }];
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const findQuery = Incident.find(filter)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(parsedLimit);

    const incidents =
      typeof findQuery.populate === "function"
        ? await findQuery.populate("monitorId", "name url method currentStatus isActive monitoringInterval")
        : await findQuery;

    const total = await Incident.countDocuments(filter);

    const scopeMatch = isAdminUser(req.user) ? {} : { userId: req.user._id };
    let activeCount = 0;
    let resolvedCount = 0;

    if (isDbOrMockReady(Incident, "countDocuments")) {
      const [activeRes, resolvedRes] = await Promise.all([
        Incident.countDocuments({ ...scopeMatch, isActive: true }),
        Incident.countDocuments({ ...scopeMatch, isActive: false }),
      ]);
      activeCount = activeRes || 0;
      resolvedCount = resolvedRes || 0;
    }

    return res.status(200).json({
      success: true,
      count: incidents.length,
      total,
      page: parsedPage,
      totalPages: Math.max(1, Math.ceil(total / parsedLimit)),
      summary: {
        activeCount,
        resolvedCount,
        totalCount: activeCount + resolvedCount,
      },
      data: incidents.map(serializeIncident),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve detailed incident timeline, affected monitoring checks, and notifications.
 * GET /api/incidents/:id
 */
async function getIncidentById(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid incident ID",
      });
    }

    const baseQuery = Incident.findById(req.params.id);
    const incident =
      typeof baseQuery.populate === "function"
        ? await baseQuery.populate("monitorId", "name url method currentStatus isActive monitoringInterval userId")
        : await baseQuery;

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: "Incident not found",
      });
    }

    const ownerCandidate = incident.userId || incident.monitorId?.userId || null;
    if (!canAccessOwnedResource(req.user, ownerCandidate)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to access this incident",
      });
    }

    let affectedPings = [];
    if (
      Array.isArray(incident.affectedPingIds) &&
      incident.affectedPingIds.length > 0 &&
      isDbOrMockReady(PingResult, "find")
    ) {
      const pingQuery = PingResult.find({ _id: { $in: incident.affectedPingIds } });
      affectedPings =
        typeof pingQuery.sort === "function"
          ? await pingQuery.sort({ checkedAt: -1 }).limit(100)
          : await pingQuery;
    }

    let notifications = [];
    if (isDbOrMockReady(NotificationLog, "find")) {
      const notifQuery = NotificationLog.find({ incidentId: incident._id });
      notifications =
        typeof notifQuery.sort === "function"
          ? await notifQuery.sort({ createdAt: -1 }).limit(20)
          : await notifQuery;
    }

    return res.status(200).json({
      success: true,
      data: {
        ...serializeIncident(incident),
        affectedPings,
        notifications,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Advance incident lifecycle stage, append timeline notes, or manually resolve/reopen.
 * PATCH /api/incidents/:id
 */
async function updateIncident(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid incident ID",
      });
    }

    const { status, note, resolutionNotes, description } = req.body || {};

    if (
      status === undefined &&
      note === undefined &&
      resolutionNotes === undefined &&
      description === undefined
    ) {
      return res.status(400).json({
        success: false,
        error: "Provide status, note, resolutionNotes, or description to update",
      });
    }

    if (status !== undefined && !Incident.INCIDENT_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Allowed values: ${Incident.INCIDENT_STATUSES.join(", ")}`,
      });
    }

    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({
        success: false,
        error: "Incident not found",
      });
    }

    if (!canAccessOwnedResource(req.user, incident.userId)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to update this incident",
      });
    }

    const now = new Date();
    const actorName = req.user.name || req.user.email || "Operator";
    const previousStatus = incident.status;
    let timelineAdded = false;

    if (description !== undefined) {
      const trimmedDesc = String(description).trim();
      if (trimmedDesc.length > 1000) {
        return res.status(400).json({
          success: false,
          error: "Description cannot exceed 1000 characters",
        });
      }
      incident.description = trimmedDesc;
    }

    if (resolutionNotes !== undefined) {
      const trimmedNotes = String(resolutionNotes).trim();
      if (trimmedNotes.length > 2000) {
        return res.status(400).json({
          success: false,
          error: "Resolution notes cannot exceed 2000 characters",
        });
      }
      incident.resolutionNotes = trimmedNotes;
    }

    if (status !== undefined) {
      incident.status = status;
      if (status === "Resolved") {
        incident.isActive = false;
        incident.resolvedAt = incident.resolvedAt || now;
        incident.downtimeDurationMs = computeDowntimeDurationMs(
          incident.startedAt,
          incident.resolvedAt
        );
      } else {
        incident.isActive = true;
        incident.resolvedAt = null;
        incident.downtimeDurationMs = null;
      }

      if (!Array.isArray(incident.timeline)) {
        incident.timeline = [];
      }

      const trimmedNote = note !== undefined ? String(note).trim() : "";
      const stageMessage =
        trimmedNote ||
        (status !== previousStatus
          ? `Status updated from ${previousStatus} to ${status}`
          : `Timeline checkpoint recorded at ${status}`);

      incident.timeline.push({
        status,
        message: stageMessage.slice(0, 1000),
        actorType: "user",
        actorName,
        timestamp: now,
      });
      timelineAdded = true;
    } else if (note !== undefined && String(note).trim()) {
      if (!Array.isArray(incident.timeline)) {
        incident.timeline = [];
      }
      incident.timeline.push({
        status: incident.status,
        message: String(note).trim().slice(0, 1000),
        actorType: "user",
        actorName,
        timestamp: now,
      });
      timelineAdded = true;
    } else if (resolutionNotes !== undefined && !timelineAdded) {
      if (!Array.isArray(incident.timeline)) {
        incident.timeline = [];
      }
      incident.timeline.push({
        status: incident.status,
        message: `Resolution notes updated: ${String(resolutionNotes).trim().slice(0, 900) || "(cleared)"}`,
        actorType: "user",
        actorName,
        timestamp: now,
      });
    }

    try {
      await incident.save();
    } catch (saveErr) {
      if (saveErr && saveErr.code === 11000) {
        return res.status(409).json({
          success: false,
          error: "Another active incident already exists for this monitor",
        });
      }
      throw saveErr;
    }

    return res.status(200).json({
      success: true,
      data: serializeIncident(incident),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getIncidents,
  getIncidentById,
  updateIncident,
};

