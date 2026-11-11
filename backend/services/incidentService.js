const crypto = require("crypto");
const mongoose = require("mongoose");
const Incident = require("../models/Incident");
const notificationService = require("./notificationService");
const { logEvent } = require("../utils/logger");

function canUseIncidentDb(methodName, forceIncidentDb = false) {
  if (forceIncidentDb || mongoose.connection.readyState === 1) {
    return true;
  }
  const fn = Incident[methodName];
  return Boolean(fn && fn._isMockFunction);
}

/**
 * Generates a unique human-readable incident key such as INC-20261111-A1B2C3.
 */
function generateIncidentKey(date = new Date()) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `INC-${yyyy}${mm}${dd}-${suffix}`;
}

/**
 * Computes non-negative outage duration in milliseconds between start and resolution timestamps.
 */
function computeDowntimeDurationMs(startedAt, resolvedAt) {
  if (!startedAt || !resolvedAt) return 0;
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(resolvedAt).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
  return Math.max(0, endMs - startMs);
}

async function attachPingToActiveIncident(activeIncident, pingResult, forceIncidentDb = false) {
  const pingId = pingResult?._id;
  const existingIds = Array.isArray(activeIncident.affectedPingIds)
    ? activeIncident.affectedPingIds.map((id) => id.toString())
    : [];

  if (pingId && !existingIds.includes(pingId.toString())) {
    if (!Array.isArray(activeIncident.affectedPingIds)) {
      activeIncident.affectedPingIds = [];
    }
    activeIncident.affectedPingIds.push(pingId);
    if (activeIncident.affectedPingIds.length > 200) {
      activeIncident.affectedPingIds = activeIncident.affectedPingIds.slice(-200);
    }
    activeIncident.affectedChecksCount = (activeIncident.affectedChecksCount || 0) + 1;
  }

  if (typeof activeIncident.save === "function") {
    await activeIncident.save();
  } else if (canUseIncidentDb("updateOne", forceIncidentDb)) {
    const updateOps = { $inc: { affectedChecksCount: 1 } };
    if (pingId) {
      updateOps.$addToSet = { affectedPingIds: pingId };
    }
    await Incident.updateOne({ _id: activeIncident._id }, updateOps);
  }

  return activeIncident;
}

/**
 * Evaluates a monitor check result to create, update, or resolve an incident
 * atomically and trigger outage/recovery notifications via notificationService.
 */
async function handleMonitorCheckForIncident({
  monitor,
  pingResult,
  previousStatus,
  forceIncidentDb = false,
  dispatchNotifications = true,
} = {}) {
  if (!monitor || !pingResult) {
    return { handled: false, reason: "Missing monitor or pingResult" };
  }

  if (!canUseIncidentDb("findOne", forceIncidentDb)) {
    return { handled: false, reason: "Incident store inactive in disconnected environment" };
  }

  const checkedAt = pingResult.checkedAt ? new Date(pingResult.checkedAt) : new Date();
  const isCheckUp = pingResult.status === "UP";

  // 1. Outage detected or continuing when monitor state is DOWN and latest ping failed
  if (monitor.currentStatus === "DOWN" && !isCheckUp) {
    const existingActive = await Incident.findOne({ monitorId: monitor._id, isActive: true });

    if (existingActive) {
      await attachPingToActiveIncident(existingActive, pingResult, forceIncidentDb);
      return { handled: true, action: "updated", incident: existingActive };
    }

    if (!canUseIncidentDb("create", forceIncidentDb)) {
      return { handled: false, reason: "Incident.create unavailable" };
    }

    const failureReason =
      pingResult.errorMessage ||
      monitor.lastError ||
      (pingResult.statusCode ? `Unexpected HTTP ${pingResult.statusCode}` : "Health check failed");

    const title = `${monitor.name} is experiencing downtime`;
    const description = `Automated check detected service outage (${failureReason}).`;
    const initialTimeline = [
      {
        status: "Detected",
        message: `Outage automatically detected after ${monitor.consecutiveFailures || 1} failed check(s): ${failureReason}`,
        actorType: "system",
        actorName: "PingPilot Engine",
        timestamp: checkedAt,
      },
    ];

    try {
      const created = await Incident.create({
        incidentKey: generateIncidentKey(checkedAt),
        monitorId: monitor._id,
        userId: monitor.userId || null,
        title,
        description,
        status: "Detected",
        isActive: true,
        startedAt: checkedAt,
        affectedPingIds: pingResult._id ? [pingResult._id] : [],
        affectedChecksCount: 1,
        timeline: initialTimeline,
      });

      logEvent("warn", "incident.created", {
        incidentId: created._id?.toString?.() || null,
        incidentKey: created.incidentKey,
        monitorId: monitor._id?.toString?.() || null,
        userId: monitor.userId?.toString?.() || null,
        previousStatus,
      });

      if (dispatchNotifications && monitor.userId) {
        notificationService
          .dispatchIncidentNotification({
            type: "DOWN",
            incident: created,
            monitor,
            pingResult,
          })
          .catch((err) => {
            logEvent("error", "notification.down_dispatch_error", {
              incidentId: created._id?.toString?.() || null,
              error: err.message,
            });
          });
      }

      return { handled: true, action: "created", incident: created };
    } catch (err) {
      // Partial unique index guards concurrent cycle race on active incident per monitor
      if (err && err.code === 11000) {
        const racedActive = await Incident.findOne({ monitorId: monitor._id, isActive: true });
        if (racedActive) {
          await attachPingToActiveIncident(racedActive, pingResult, forceIncidentDb);
          return { handled: true, action: "deduplicated", incident: racedActive };
        }
      }
      throw err;
    }
  }

  // 2. Service recovered when both check and monitor status are UP
  if (monitor.currentStatus === "UP" && isCheckUp) {
    const activeIncident = await Incident.findOne({ monitorId: monitor._id, isActive: true });
    if (!activeIncident) {
      return { handled: true, action: "noop", incident: null };
    }

    const downtimeDurationMs = computeDowntimeDurationMs(activeIncident.startedAt, checkedAt);
    const formattedDowntime = notificationService.formatDuration(downtimeDurationMs);
    const resolutionNote = `Automatic recovery verified (HTTP ${pingResult.statusCode || "OK"}, ${pingResult.responseTime ?? 0}ms) after ${formattedDowntime}.`;

    activeIncident.status = "Resolved";
    activeIncident.isActive = false;
    activeIncident.resolvedAt = checkedAt;
    activeIncident.downtimeDurationMs = downtimeDurationMs;
    if (!activeIncident.resolutionNotes) {
      activeIncident.resolutionNotes = resolutionNote;
    }

    if (!Array.isArray(activeIncident.timeline)) {
      activeIncident.timeline = [];
    }
    activeIncident.timeline.push({
      status: "Resolved",
      message: resolutionNote,
      actorType: "system",
      actorName: "PingPilot Engine",
      timestamp: checkedAt,
    });

    if (typeof activeIncident.save === "function") {
      await activeIncident.save();
    } else if (canUseIncidentDb("updateOne", forceIncidentDb)) {
      await Incident.updateOne(
        { _id: activeIncident._id },
        {
          $set: {
            status: "Resolved",
            isActive: false,
            resolvedAt: checkedAt,
            downtimeDurationMs,
            resolutionNotes: activeIncident.resolutionNotes,
            timeline: activeIncident.timeline,
          },
        }
      );
    }

    logEvent("info", "incident.resolved", {
      incidentId: activeIncident._id?.toString?.() || null,
      incidentKey: activeIncident.incidentKey,
      monitorId: monitor._id?.toString?.() || null,
      downtimeDurationMs,
    });

    if (dispatchNotifications && monitor.userId) {
      notificationService
        .dispatchIncidentNotification({
          type: "RECOVERED",
          incident: activeIncident,
          monitor,
          pingResult,
        })
        .catch((err) => {
          logEvent("error", "notification.recovery_dispatch_error", {
            incidentId: activeIncident._id?.toString?.() || null,
            error: err.message,
          });
        });
    }

    return { handled: true, action: "resolved", incident: activeIncident };
  }

  return { handled: true, action: "noop", incident: null };
}

module.exports = {
  canUseIncidentDb,
  generateIncidentKey,
  computeDowntimeDurationMs,
  handleMonitorCheckForIncident,
};

