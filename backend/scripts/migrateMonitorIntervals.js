const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Monitor = require("../models/Monitor");
const {
  resolveMonitoringInterval,
  computeIntervalChangeNextCheckAt,
} = require("../utils/monitorSchedule");

/**
 * Computes the idempotent `$set` update required to backfill individual monitoring
 * interval and scheduling fields on a monitor document without altering history.
 */
function buildMigrationUpdate(monitor, now = new Date()) {
  const update = {};
  const targetInterval = resolveMonitoringInterval(monitor);

  if (monitor.monitoringInterval !== targetInterval) {
    update.monitoringInterval = targetInterval;
  }

  if (monitor.interval !== targetInterval) {
    update.interval = targetInterval;
  }

  if (monitor.isActive === false) {
    if (monitor.nextCheckAt !== null) {
      update.nextCheckAt = null;
    }
  } else {
    const parsedNext = monitor.nextCheckAt ? new Date(monitor.nextCheckAt).getTime() : NaN;
    if (!monitor.nextCheckAt || Number.isNaN(parsedNext)) {
      update.nextCheckAt = computeIntervalChangeNextCheckAt(
        targetInterval,
        monitor.lastCheckedAt,
        null,
        now
      );
    }
  }

  if (monitor.claimOwner === undefined) {
    update.claimOwner = null;
  }

  if (monitor.claimExpiresAt === undefined) {
    update.claimExpiresAt = null;
  }

  return update;
}

/**
 * Safely migrates existing Monitor documents to include `monitoringInterval`, synced `interval`,
 * `nextCheckAt`, and null claim defaults. Never modifies PingResult history or deletes monitors.
 */
async function migrateMonitorIntervals({
  dryRun = false,
  now = new Date(),
  logger = console,
} = {}) {
  const findQuery = Monitor.find({});
  const monitors =
    findQuery && typeof findQuery.lean === "function"
      ? await findQuery.lean()
      : await findQuery;

  const monitorList = Array.isArray(monitors) ? monitors : [];
  let updatedCount = 0;
  let unchangedCount = 0;
  const changes = [];

  for (const monitor of monitorList) {
    const update = buildMigrationUpdate(monitor, now);
    const updateKeys = Object.keys(update);

    if (updateKeys.length === 0) {
      unchangedCount += 1;
      continue;
    }

    if (!dryRun) {
      await Monitor.updateOne({ _id: monitor._id }, { $set: update });
    }

    updatedCount += 1;
    changes.push({
      id: monitor._id ? String(monitor._id) : null,
      name: monitor.name || "",
      update,
    });
  }

  if (logger && typeof logger.log === "function") {
    logger.log(
      `[migrateMonitorIntervals] dryRun=${Boolean(dryRun)} total=${monitorList.length} updated=${updatedCount} unchanged=${unchangedCount}`
    );
  }

  return {
    totalMonitors: monitorList.length,
    updatedCount,
    unchangedCount,
    dryRun: Boolean(dryRun),
    changes,
  };
}

async function runCli() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  try {
    await connectDB();
    const result = await migrateMonitorIntervals({ dryRun });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 0;
  } catch (error) {
    console.error("Migration failed:", error?.message || error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  buildMigrationUpdate,
  migrateMonitorIntervals,
};

