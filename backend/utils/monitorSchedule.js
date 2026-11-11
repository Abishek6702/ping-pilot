const {
  ALLOWED_MONITORING_INTERVALS,
  DEFAULT_MONITORING_INTERVAL,
} = require("../constants/monitorConstants");

/**
 * Checks whether a value is one of the supported monitoring intervals (minutes).
 */
function isValidMonitoringInterval(value) {
  const num = Number(value);
  return Number.isInteger(num) && ALLOWED_MONITORING_INTERVALS.includes(num);
}

/**
 * Resolves a monitor's configured interval in minutes with safe fallback to 5 minutes
 * for legacy monitors that only stored `interval` or had missing fields.
 */
function resolveMonitoringInterval(monitorOrValue) {
  if (monitorOrValue === null || monitorOrValue === undefined) {
    return DEFAULT_MONITORING_INTERVAL;
  }

  if (typeof monitorOrValue === "number" || typeof monitorOrValue === "string") {
    return isValidMonitoringInterval(monitorOrValue)
      ? Number(monitorOrValue)
      : DEFAULT_MONITORING_INTERVAL;
  }

  if (isValidMonitoringInterval(monitorOrValue.monitoringInterval)) {
    return Number(monitorOrValue.monitoringInterval);
  }

  if (isValidMonitoringInterval(monitorOrValue.interval)) {
    return Number(monitorOrValue.interval);
  }

  return DEFAULT_MONITORING_INTERVAL;
}

/**
 * Calculates nextCheckAt after a completed check while preserving cadence across minor cron jitter
 * and preventing burst catch-ups after prolonged downtime.
 */
function calculateNextCheckAt(
  intervalMinutes,
  completedAt = new Date(),
  previousNextCheckAt = null
) {
  const safeMinutes = resolveMonitoringInterval(intervalMinutes);
  const intervalMs = safeMinutes * 60 * 1000;
  const completedMs = new Date(completedAt).getTime();

  if (previousNextCheckAt) {
    const prevMs = new Date(previousNextCheckAt).getTime();
    if (!Number.isNaN(prevMs) && prevMs <= completedMs && completedMs - prevMs < intervalMs) {
      const candidate = prevMs + intervalMs;
      if (candidate > completedMs + 5000) {
        return new Date(candidate);
      }
    }
  }

  return new Date(completedMs + intervalMs);
}

/**
 * Recalculates nextCheckAt when a user updates a monitor's monitoringInterval
 * without triggering an immediate duplicate check if recently checked.
 */
function computeIntervalChangeNextCheckAt(
  newIntervalMinutes,
  lastCheckedAt = null,
  existingNextCheckAt = null,
  now = new Date()
) {
  const safeMinutes = resolveMonitoringInterval(newIntervalMinutes);
  const intervalMs = safeMinutes * 60 * 1000;
  const nowDate = new Date(now);

  if (lastCheckedAt) {
    const lastMs = new Date(lastCheckedAt).getTime();
    if (!Number.isNaN(lastMs)) {
      return new Date(lastMs + intervalMs);
    }
  }

  return existingNextCheckAt ? new Date(existingNextCheckAt) : nowDate;
}

/**
 * Schedules nextCheckAt when a paused monitor is re-enabled.
 * Avoids duplicate pings if checked very recently within the interval, otherwise schedules for next cycle.
 */
function computeReactivatedNextCheckAt(
  intervalMinutes,
  lastCheckedAt = null,
  now = new Date()
) {
  const safeMinutes = resolveMonitoringInterval(intervalMinutes);
  const intervalMs = safeMinutes * 60 * 1000;
  const nowDate = new Date(now);

  if (lastCheckedAt) {
    const lastMs = new Date(lastCheckedAt).getTime();
    if (!Number.isNaN(lastMs) && lastMs + intervalMs > nowDate.getTime()) {
      return new Date(lastMs + intervalMs);
    }
  }

  return nowDate;
}

/**
 * Builds the MongoDB filter selecting active, unclaimed monitors due at `now`.
 */
function buildDueMonitorsQuery(now = new Date(), force = false) {
  const nowDate = new Date(now);
  const claimAvailableCondition = {
    $or: [
      { claimExpiresAt: null },
      { claimExpiresAt: { $exists: false } },
      { claimExpiresAt: { $lte: nowDate } },
    ],
  };

  if (force) {
    return {
      isActive: true,
      ...claimAvailableCondition,
    };
  }

  return {
    isActive: true,
    $and: [
      {
        $or: [
          { nextCheckAt: { $lte: nowDate } },
          { nextCheckAt: null },
          { nextCheckAt: { $exists: false } },
        ],
      },
      claimAvailableCondition,
    ],
  };
}

/**
 * Evaluates in-memory whether a monitor is due at `now` (guards mocked queries and legacy docs).
 */
function isMonitorDue(monitor, now = new Date(), force = false) {
  if (!monitor || monitor.isActive === false) {
    return false;
  }

  const nowMs = new Date(now).getTime();

  // Never pick up an active unexpired claim
  if (monitor.claimExpiresAt) {
    const expiryMs = new Date(monitor.claimExpiresAt).getTime();
    if (!Number.isNaN(expiryMs) && expiryMs > nowMs) {
      return false;
    }
  }

  if (force) {
    return true;
  }

  if (monitor.nextCheckAt) {
    const nextMs = new Date(monitor.nextCheckAt).getTime();
    return !Number.isNaN(nextMs) && nextMs <= nowMs;
  }

  // Backward-compatible legacy document without nextCheckAt: respect lastCheckedAt + interval if checked
  if (monitor.lastCheckedAt) {
    const lastMs = new Date(monitor.lastCheckedAt).getTime();
    const intervalMs = resolveMonitoringInterval(monitor) * 60 * 1000;
    if (!Number.isNaN(lastMs)) {
      return lastMs + intervalMs <= nowMs;
    }
  }

  // Never checked and active -> due on next cycle
  return true;
}

module.exports = {
  ALLOWED_MONITORING_INTERVALS,
  DEFAULT_MONITORING_INTERVAL,
  isValidMonitoringInterval,
  resolveMonitoringInterval,
  calculateNextCheckAt,
  computeIntervalChangeNextCheckAt,
  computeReactivatedNextCheckAt,
  buildDueMonitorsQuery,
  isMonitorDue,
};

