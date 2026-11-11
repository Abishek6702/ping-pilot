const ALLOWED_MONITORING_INTERVALS = [1, 5, 10, 15, 30, 60];
const DEFAULT_MONITORING_INTERVAL = 5;
const CLAIM_LEASE_MS = 2 * 60 * 1000; // 2-minute atomic claim lease to recover from crashed workers

module.exports = {
  ALLOWED_MONITORING_INTERVALS,
  DEFAULT_MONITORING_INTERVAL,
  CLAIM_LEASE_MS,
};

