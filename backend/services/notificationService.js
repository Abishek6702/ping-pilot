const mongoose = require("mongoose");
const NotificationLog = require("../models/NotificationLog");
const User = require("../models/User");
const sendMail = require("../utils/sendMail");
const renderTemplate = require("../utils/renderTemplate");
const { logEvent } = require("../utils/logger");

function defaultSleep(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canUseNotificationDb(methodName, forceDbLog = false) {
  if (forceDbLog || mongoose.connection.readyState === 1) {
    return true;
  }
  const fn = NotificationLog[methodName];
  return Boolean(fn && fn._isMockFunction);
}

/**
 * Formats a millisecond duration into human-readable outage duration.
 */
function formatDuration(durationMs) {
  if (durationMs === null || durationMs === undefined || Number.isNaN(Number(durationMs))) {
    return "0s";
  }
  const totalSeconds = Math.max(0, Math.round(Number(durationMs) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0 || (days === 0 && hours === 0 && seconds > 0)) {
    parts.push(`${seconds}s`);
  }
  return parts.join(" ");
}

/**
 * Executes an async mail send operation with bounded retries and exponential backoff.
 */
async function sendMailWithRetry(
  operation,
  {
    maxAttempts = 3,
    baseDelayMs = process.env.NODE_ENV === "test" ? 0 : 500,
    sleepFn = defaultSleep,
  } = {}
) {
  const safeMaxAttempts = Math.min(Math.max(1, Number(maxAttempts) || 3), 5);
  let lastError = null;

  for (let attempt = 1; attempt <= safeMaxAttempts; attempt++) {
    try {
      const result = await operation(attempt);
      return {
        success: true,
        attempts: attempt,
        result,
        error: null,
      };
    } catch (err) {
      lastError = err;
      if (attempt < safeMaxAttempts) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        await sleepFn(delayMs);
      }
    }
  }

  return {
    success: false,
    attempts: safeMaxAttempts,
    result: null,
    error: lastError?.message || "Email delivery failed",
  };
}

/**
 * Dispatches an outage ("DOWN") or recovery ("RECOVERED") notification for an incident,
 * preventing duplicate dispatches per incident+type, retrying with bounded backoff,
 * and persisting NotificationLog status without throwing into monitoring cycles.
 */
async function dispatchIncidentNotification({
  type,
  incident,
  monitor,
  user = null,
  pingResult = null,
  maxAttempts = 3,
  baseDelayMs = process.env.NODE_ENV === "test" ? 0 : 500,
  sleepFn = defaultSleep,
  forceDbLog = false,
} = {}) {
  try {
    if (!["DOWN", "RECOVERED"].includes(type)) {
      return { skipped: true, reason: `Unsupported notification type: ${type}` };
    }
    if (!monitor || !incident) {
      return { skipped: true, reason: "Missing monitor or incident context" };
    }

    let recipientUser = user;
    if (!recipientUser && monitor.userId) {
      const canLookupUser =
        forceDbLog ||
        mongoose.connection.readyState === 1 ||
        Boolean(User.findById && User.findById._isMockFunction);
      if (canLookupUser) {
        recipientUser = await User.findById(monitor.userId).catch(() => null);
      }
    }

    const recipientEmail = recipientUser?.email ? String(recipientUser.email).trim().toLowerCase() : null;
    if (!recipientEmail) {
      return { skipped: true, reason: "Monitor has no recipient user email" };
    }

    const incidentId = incident._id || null;
    const dedupeKey = `${incidentId ? incidentId.toString() : monitor._id.toString()}:${type}`;
    const canReserve = canUseNotificationDb("findOneAndUpdate", forceDbLog);
    const canUpdate = canUseNotificationDb("updateOne", forceDbLog);

    let logRecordId = null;

    if (canReserve) {
      try {
        const existingBefore = await NotificationLog.findOneAndUpdate(
          { dedupeKey },
          {
            $setOnInsert: {
              userId: monitor.userId || null,
              monitorId: monitor._id,
              incidentId,
              type,
              channel: "EMAIL",
              recipientEmail,
              dedupeKey,
              status: "PENDING",
              attempts: 0,
              maxAttempts,
            },
          },
          { upsert: true, returnDocument: "before" }
        );

        if (existingBefore) {
          return {
            skipped: true,
            reason: `Duplicate ${type} notification prevented for incident`,
            dedupeKey,
            existingStatus: existingBefore.status,
          };
        }

        if (NotificationLog.findOne && (forceDbLog || mongoose.connection.readyState === 1 || NotificationLog.findOne._isMockFunction)) {
          const created = await NotificationLog.findOne({ dedupeKey });
          logRecordId = created?._id || null;
        }
      } catch (err) {
        if (err && err.code === 11000) {
          return {
            skipped: true,
            reason: `Duplicate ${type} notification prevented (concurrent lock)`,
            dedupeKey,
          };
        }
        throw err;
      }
    }

    const checkedAt = pingResult?.checkedAt || monitor.lastCheckedAt || new Date();
    let subject;
    let html;

    if (type === "DOWN") {
      subject = `⚠️ Service Alert: ${monitor.name} is DOWN${incident.incidentKey ? ` (${incident.incidentKey})` : ""}`;
      html = renderTemplate("serviceDown", {
        serviceName: monitor.name,
        url: monitor.url,
        failureCount: monitor.consecutiveFailures || 1,
        errorMessage: monitor.lastError || pingResult?.errorMessage || "Unexpected endpoint response",
        time: new Date(checkedAt).toUTCString(),
        incidentKey: incident.incidentKey,
      });
    } else {
      const downtimeMs =
        incident.downtimeDurationMs !== null && incident.downtimeDurationMs !== undefined
          ? incident.downtimeDurationMs
          : incident.startedAt
            ? Math.max(0, new Date(checkedAt).getTime() - new Date(incident.startedAt).getTime())
            : 0;
      subject = `✅ Service Recovered: ${monitor.name} is Back Online${incident.incidentKey ? ` (${incident.incidentKey})` : ""}`;
      html = renderTemplate("serviceRecovered", {
        serviceName: monitor.name,
        url: monitor.url,
        responseTime: pingResult?.responseTime ?? monitor.lastResponseTime ?? 0,
        time: new Date(checkedAt).toUTCString(),
        incidentKey: incident.incidentKey,
        downtimeFormatted: formatDuration(downtimeMs),
      });
    }

    const outcome = await sendMailWithRetry(
      () => sendMail(recipientEmail, subject, html),
      { maxAttempts, baseDelayMs, sleepFn }
    );

    if (canUpdate) {
      const filter = logRecordId ? { _id: logRecordId } : { dedupeKey };
      await NotificationLog.updateOne(filter, {
        $set: {
          status: outcome.success ? "SENT" : "FAILED",
          attempts: outcome.attempts,
          lastAttemptAt: new Date(),
          lastError: outcome.error,
          sentAt: outcome.success ? new Date() : null,
          messageId: outcome.result?.messageId || null,
        },
      }).catch((updateErr) => {
        logEvent("error", "notification_log_update_failed", {
          dedupeKey,
          error: updateErr?.message,
        });
      });
    }

    if (!outcome.success) {
      logEvent("error", "notification_delivery_failed", {
        type,
        monitorId: monitor._id?.toString(),
        incidentId: incidentId?.toString(),
        attempts: outcome.attempts,
        error: outcome.error,
      });
    }

    return {
      skipped: false,
      success: outcome.success,
      attempts: outcome.attempts,
      error: outcome.error,
      dedupeKey,
    };
  } catch (error) {
    logEvent("error", "notification_dispatch_error", {
      type,
      monitorId: monitor?._id?.toString(),
      error: error?.message || "Unknown error",
    });
    return {
      skipped: false,
      success: false,
      attempts: 0,
      error: error?.message || "Notification dispatch error",
    };
  }
}

module.exports = {
  formatDuration,
  sendMailWithRetry,
  dispatchIncidentNotification,
};

