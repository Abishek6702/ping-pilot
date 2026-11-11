const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const connectDB = require("../config/db");
const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const SystemSetting = require("../models/SystemSetting");
const CycleLock = require("../models/CycleLock");
const {
  pingMonitor,
  executeMonitoringCycle,
  claimMonitorForExecution,
  releaseMonitorClaim,
} = require("../services/monitoringEngine");
const { startRecurringWorker } = require("../services/recurringService");
const { buildDueMonitorsQuery } = require("../utils/monitorSchedule");
const {
  buildMigrationUpdate,
  migrateMonitorIntervals,
} = require("../scripts/migrateMonitorIntervals");

process.env.PINGPILOT_WORKER_SECRET = "super-secret-worker-key-999";

// Ensure automated tests never touch production Atlas URI injected by .env
delete process.env.MONGO_URI;
delete process.env.MONGODB_URI;

function createMockMonitor(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId().toString(),
    name: "Mock API Service",
    url: "https://8.8.8.8/health",
    method: "GET",
    monitoringInterval: 5,
    interval: 5,
    timeout: 10,
    expectedStatusCodes: [200],
    isActive: true,
    currentStatus: "UP",
    consecutiveFailures: 0,
    consecutiveSuccesses: 1,
    failureThreshold: 2,
    lastCheckedAt: null,
    nextCheckAt: null,
    claimOwner: null,
    claimExpiresAt: null,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("Monitoring Engine, Scheduler & Worker Endpoint", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    process.env.PINGPILOT_WORKER_SECRET = "super-secret-worker-key-999";
    jest.spyOn(SystemSetting, "findOne").mockResolvedValue({ value: 30 });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  describe("Test Database Safety Guard", () => {
    test("refuses to connect without TEST_MONGODB_URI in test environment", async () => {
      delete process.env.TEST_MONGODB_URI;
      await expect(connectDB()).rejects.toThrow("TEST_MONGODB_URI");
    });
  });

  describe("pingMonitor() Execution & History Creation", () => {
    test("records successful ping, creates history entry, updates response time, and restores UP status", async () => {
      const mockMonitor = createMockMonitor({
        name: "Mock Service",
        url: "https://8.8.8.8",
        currentStatus: "DOWN",
        consecutiveFailures: 2,
        consecutiveSuccesses: 0,
      });

      const cancelSpy = jest.fn().mockResolvedValue(undefined);
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        headers: new Map(),
        body: { cancel: cancelSpy },
      });

      const createSpy = jest.spyOn(PingResult, "create").mockResolvedValue({
        _id: "70d0fe4f5311236168a109cb",
      });

      const outcome = await pingMonitor(mockMonitor);

      expect(outcome.pingStatus).toBe("UP");
      expect(outcome.statusCode).toBe(200);
      expect(mockMonitor.currentStatus).toBe("UP");
      expect(mockMonitor.consecutiveSuccesses).toBe(1);
      expect(mockMonitor.consecutiveFailures).toBe(0);
      expect(mockMonitor.lastCheckedAt).toBeInstanceOf(Date);
      expect(mockMonitor.save).toHaveBeenCalledTimes(1);
      expect(cancelSpy).toHaveBeenCalledTimes(1);

      expect(createSpy).toHaveBeenCalledTimes(1);
      const historyArg = createSpy.mock.calls[0][0];
      expect(historyArg.monitorId).toBe(mockMonitor._id);
      expect(historyArg.status).toBe("UP");
      expect(historyArg.statusCode).toBe(200);
      expect(typeof historyArg.responseTime).toBe("number");
      expect(historyArg.checkedAt).toEqual(mockMonitor.lastCheckedAt);
      expect(historyArg.expiresAt).toBeInstanceOf(Date);
    });

    test("handles failed endpoint responses and transitions DOWN only after failure threshold", async () => {
      const mockMonitor = createMockMonitor({
        name: "Failing Service",
        url: "https://8.8.8.8",
        currentStatus: "UP",
        consecutiveFailures: 0,
        consecutiveSuccesses: 5,
        failureThreshold: 2,
      });

      global.fetch = jest.fn().mockResolvedValue({
        status: 503,
        headers: new Map(),
      });

      const createSpy = jest.spyOn(PingResult, "create").mockResolvedValue({
        _id: "70d0fe4f5311236168a109cb",
      });

      const first = await pingMonitor(mockMonitor);
      expect(first.pingStatus).toBe("DOWN");
      expect(first.statusCode).toBe(503);
      expect(mockMonitor.consecutiveFailures).toBe(1);
      expect(mockMonitor.currentStatus).toBe("UP");

      const second = await pingMonitor(mockMonitor);
      expect(second.pingStatus).toBe("DOWN");
      expect(mockMonitor.consecutiveFailures).toBe(2);
      expect(mockMonitor.currentStatus).toBe("DOWN");
      expect(createSpy).toHaveBeenCalledTimes(2);
    });

    test("handles request timeout gracefully without throwing", async () => {
      const mockMonitor = createMockMonitor({
        name: "Laggy Service",
        url: "https://8.8.8.8",
        timeout: 1,
      });

      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      global.fetch = jest.fn().mockRejectedValue(abortError);

      const createSpy = jest.spyOn(PingResult, "create").mockResolvedValue({
        _id: "70d0fe4f5311236168a109cb",
      });

      const outcome = await pingMonitor(mockMonitor);
      expect(outcome.pingStatus).toBe("DOWN");
      expect(outcome.statusCode).toBeNull();
      expect(outcome.errorMessage).toContain("Connection timed out");
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          monitorId: mockMonitor._id,
          status: "DOWN",
          statusCode: null,
        })
      );
    });

    test("handles network error with cause details cleanly", async () => {
      const mockMonitor = createMockMonitor({ url: "https://8.8.8.8" });

      const netErr = new TypeError("fetch failed");
      netErr.cause = { code: "ECONNREFUSED" };
      global.fetch = jest.fn().mockRejectedValue(netErr);

      jest.spyOn(PingResult, "create").mockResolvedValue({ _id: "70d0fe4f5311236168a109cc" });

      const outcome = await pingMonitor(mockMonitor);
      expect(outcome.pingStatus).toBe("DOWN");
      expect(outcome.errorMessage).toContain("ECONNREFUSED");
    });

    test("handles HTTP 429 rate-limit response cleanly and sets nextCheckAt based on monitoringInterval", async () => {
      const mockMonitor = createMockMonitor({
        name: "Rate Limited API",
        url: "https://8.8.8.8/ratelimit",
        monitoringInterval: 15,
        interval: 15,
        expectedStatusCodes: [200],
      });

      global.fetch = jest.fn().mockResolvedValue({
        status: 429,
        headers: new Map(),
      });
      const createSpy = jest.spyOn(PingResult, "create").mockResolvedValue({
        _id: "70d0fe4f5311236168a109cd",
      });

      const outcome = await pingMonitor(mockMonitor);
      expect(outcome.pingStatus).toBe("DOWN");
      expect(outcome.statusCode).toBe(429);
      expect(outcome.errorMessage).toContain("429");
      expect(mockMonitor.nextCheckAt).toBeInstanceOf(Date);
      const diffMs = mockMonitor.nextCheckAt.getTime() - mockMonitor.lastCheckedAt.getTime();
      expect(diffMs).toBeGreaterThanOrEqual(14 * 60 * 1000);
      expect(diffMs).toBeLessThanOrEqual(16 * 60 * 1000);
      expect(createSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("executeMonitoringCycle() Core Behavior, Locks & Idempotency", () => {
    test("fixes previously failing undefined-options path when active monitors exist without options arg", async () => {
      const monitor = createMockMonitor({ name: "Startup Monitor" });
      jest.spyOn(Monitor, "find").mockResolvedValue([monitor]);
      jest.spyOn(PingResult, "create").mockResolvedValue({ _id: "res-1" });
      global.fetch = jest.fn().mockResolvedValue({ status: 200, headers: new Map() });

      // Calling with NO arguments previously threw: ReferenceError: options is not defined
      const summary = await executeMonitoringCycle();

      expect(summary.status).toBe("completed");
      expect(summary.totalMonitors).toBe(1);
      expect(summary.checked).toBe(1);
      expect(summary.up).toBe(1);
      expect(summary.down).toBe(0);
    });

    test("handles null options safely without throwing", async () => {
      const monitor = createMockMonitor({ name: "Null Opts Monitor" });
      jest.spyOn(Monitor, "find").mockResolvedValue([monitor]);
      jest.spyOn(PingResult, "create").mockResolvedValue({ _id: "res-null" });
      global.fetch = jest.fn().mockResolvedValue({ status: 200, headers: new Map() });

      const summary = await executeMonitoringCycle(null);
      expect(summary.status).toBe("completed");
      expect(summary.checked).toBe(1);
    });

    test("checks multiple active monitors and continues remaining monitors when one fails or times out", async () => {
      const healthy1 = createMockMonitor({ name: "Healthy One", url: "https://8.8.8.8/one" });
      const badEndpoint = createMockMonitor({ name: "Error 500", url: "https://8.8.8.8/err" });
      const timedOut = createMockMonitor({ name: "Timeout API", url: "https://8.8.8.8/slow", timeout: 2 });
      const healthy2 = createMockMonitor({ name: "Healthy Two", url: "https://1.1.1.1/two" });

      jest.spyOn(Monitor, "find").mockResolvedValue([healthy1, badEndpoint, timedOut, healthy2]);
      const createSpy = jest.spyOn(PingResult, "create").mockImplementation(async (doc) => ({
        _id: `history-${doc.monitorId}`,
      }));

      global.fetch = jest.fn().mockImplementation((url) => {
        if (url.includes("/err")) {
          return Promise.resolve({ status: 500, headers: new Map() });
        }
        if (url.includes("/slow")) {
          const err = new Error("aborted");
          err.name = "AbortError";
          return Promise.reject(err);
        }
        return Promise.resolve({ status: 200, headers: new Map() });
      });

      const summary = await executeMonitoringCycle();

      expect(summary.status).toBe("completed");
      expect(summary.totalMonitors).toBe(4);
      expect(summary.checked).toBe(4);
      expect(summary.skipped).toBe(0);
      expect(summary.up).toBe(2);
      expect(summary.down).toBe(2);
      expect(createSpy).toHaveBeenCalledTimes(4);
    });

    test("prevents duplicate history entries within cooldown interval and respects force option", async () => {
      const recentlyChecked = createMockMonitor({
        name: "Recent Service",
        interval: 5,
        lastCheckedAt: new Date(Date.now() - 60 * 1000), // checked 1 min ago
      });
      const dueMonitor = createMockMonitor({
        name: "Due Service",
        interval: 5,
        lastCheckedAt: new Date(Date.now() - 6 * 60 * 1000), // checked 6 mins ago
      });

      // Include a duplicate reference with same _id to test per-cycle deduplication
      jest.spyOn(Monitor, "find").mockResolvedValue([recentlyChecked, dueMonitor, dueMonitor]);
      const createSpy = jest.spyOn(PingResult, "create").mockResolvedValue({ _id: "res-dedup" });
      global.fetch = jest.fn().mockResolvedValue({ status: 200, headers: new Map() });

      // Normal cycle: checks only dueMonitor once, skips recentlyChecked
      const normalSummary = await executeMonitoringCycle();
      expect(normalSummary.status).toBe("completed");
      expect(normalSummary.totalMonitors).toBe(2);
      expect(normalSummary.checked).toBe(1);
      expect(normalSummary.skipped).toBe(1);
      expect(createSpy).toHaveBeenCalledTimes(1);

      // Immediate second cycle: dueMonitor was just updated, so BOTH are skipped (0 duplicates)
      const secondSummary = await executeMonitoringCycle();
      expect(secondSummary.status).toBe("completed");
      expect(secondSummary.checked).toBe(0);
      expect(secondSummary.skipped).toBe(2);
      expect(createSpy).toHaveBeenCalledTimes(1);

      // Forced cycle: checks both regardless of cooldown
      const forcedSummary = await executeMonitoringCycle({ force: true });
      expect(forcedSummary.status).toBe("completed");
      expect(forcedSummary.checked).toBe(2);
      expect(forcedSummary.skipped).toBe(0);
      expect(createSpy).toHaveBeenCalledTimes(3);
    });

    test("handles concurrent monitoring calls safely without overlapping execution", async () => {
      let resolveFetch;
      const slowFetchPromise = new Promise((resolve) => {
        resolveFetch = () => resolve({ status: 200, headers: new Map() });
      });

      const monitor = createMockMonitor({ name: "Slow Target" });
      jest.spyOn(Monitor, "find").mockResolvedValue([monitor]);
      const createSpy = jest.spyOn(PingResult, "create").mockResolvedValue({ _id: "res-conc" });
      global.fetch = jest.fn().mockReturnValue(slowFetchPromise);

      const firstPromise = executeMonitoringCycle();
      // Immediately start second concurrent cycle before first completes
      const secondSummary = await executeMonitoringCycle();

      expect(secondSummary.status).toBe("skipped");
      expect(secondSummary.reason).toContain("already in progress");

      resolveFetch();
      const firstSummary = await firstPromise;
      expect(firstSummary.status).toBe("completed");
      expect(firstSummary.checked).toBe(1);
      expect(createSpy).toHaveBeenCalledTimes(1);
    });

    test("releases in-process lock even when execution throws an unexpected error", async () => {
      jest.spyOn(Monitor, "find").mockRejectedValueOnce(new Error("Simulated DB failure"));

      await expect(executeMonitoringCycle()).rejects.toThrow("Simulated DB failure");

      // Next cycle should proceed cleanly because finally released the lock
      const monitor = createMockMonitor();
      jest.spyOn(Monitor, "find").mockResolvedValueOnce([monitor]);
      jest.spyOn(PingResult, "create").mockResolvedValue({ _id: "res-recover" });
      global.fetch = jest.fn().mockResolvedValue({ status: 200, headers: new Map() });

      const recoverySummary = await executeMonitoringCycle();
      expect(recoverySummary.status).toBe("completed");
      expect(recoverySummary.checked).toBe(1);
    });

    test("selects only due active unclaimed monitors and skips future and paused monitors", async () => {
      const t0 = new Date("2026-11-11T10:00:00.000Z");
      const dueMonitor = createMockMonitor({
        name: "Due Now",
        url: "https://8.8.8.8/due",
        monitoringInterval: 5,
        nextCheckAt: new Date("2026-11-11T09:59:30.000Z"),
        isActive: true,
      });
      const futureMonitor = createMockMonitor({
        name: "Future Check",
        url: "https://8.8.8.8/future",
        monitoringInterval: 10,
        nextCheckAt: new Date("2026-11-11T10:07:00.000Z"),
        isActive: true,
      });
      const pausedMonitor = createMockMonitor({
        name: "Paused Service",
        url: "https://8.8.8.8/paused",
        monitoringInterval: 1,
        nextCheckAt: null,
        isActive: false,
        currentStatus: "PAUSED",
      });

      const findSpy = jest
        .spyOn(Monitor, "find")
        .mockResolvedValue([dueMonitor, futureMonitor, pausedMonitor]);
      const createSpy = jest.spyOn(PingResult, "create").mockResolvedValue({ _id: "res-due" });
      global.fetch = jest.fn().mockResolvedValue({ status: 200, headers: new Map() });

      const expectedQuery = buildDueMonitorsQuery(t0, false);
      const summary = await executeMonitoringCycle({ now: t0 });

      expect(findSpy).toHaveBeenCalledWith(expectedQuery);
      expect(summary.status).toBe("completed");
      expect(summary.checked).toBe(1);
      expect(summary.skipped).toBe(2);
      expect(summary.up).toBe(1);
      expect(summary.failed).toBe(0);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(summary.results).toHaveLength(1);
      expect(summary.results[0]).toEqual(
        expect.objectContaining({
          monitorId: dueMonitor._id,
          monitorName: "Due Now",
          status: "success",
          pingStatus: "UP",
          httpStatus: 200,
        })
      );
    });

    test("executes FinLab (10m) and PingPilot (5m) independently across 1-minute scheduler ticks", async () => {
      jest.useFakeTimers();
      const baseTime = new Date("2026-11-11T10:00:00.000Z");
      jest.setSystemTime(baseTime);

      const finLab = createMockMonitor({
        name: "FinLab",
        url: "https://8.8.8.8/finlab",
        monitoringInterval: 10,
        interval: 10,
        nextCheckAt: new Date("2026-11-11T10:00:00.000Z"),
      });
      const pingPilot = createMockMonitor({
        name: "PingPilot",
        url: "https://1.1.1.1/pingpilot",
        monitoringInterval: 5,
        interval: 5,
        nextCheckAt: new Date("2026-11-11T10:00:00.000Z"),
      });

      jest.spyOn(Monitor, "find").mockResolvedValue([finLab, pingPilot]);
      const pingCreateSpy = jest.spyOn(PingResult, "create").mockResolvedValue({ _id: "tick-res" });
      global.fetch = jest.fn().mockResolvedValue({ status: 200, headers: new Map() });

      // Tick t = 0m: both FinLab and PingPilot are due
      const s0 = await executeMonitoringCycle({ now: new Date("2026-11-11T10:00:00.000Z") });
      expect(s0.checked).toBe(2);

      // Tick t = 1m: neither is due
      jest.setSystemTime(new Date("2026-11-11T10:01:00.000Z"));
      const s1 = await executeMonitoringCycle({ now: new Date("2026-11-11T10:01:00.000Z") });
      expect(s1.checked).toBe(0);

      // Tick t = 5m: ONLY PingPilot (5m interval) is due; FinLab (10m) waits until 10:10
      jest.setSystemTime(new Date("2026-11-11T10:05:00.000Z"));
      const s5 = await executeMonitoringCycle({ now: new Date("2026-11-11T10:05:00.000Z") });
      expect(s5.checked).toBe(1);
      expect(s5.results[0].monitorName).toBe("PingPilot");

      // Tick t = 9m: neither is due
      jest.setSystemTime(new Date("2026-11-11T10:09:00.000Z"));
      const s9 = await executeMonitoringCycle({ now: new Date("2026-11-11T10:09:00.000Z") });
      expect(s9.checked).toBe(0);

      // Tick t = 10m: BOTH FinLab (10m) and PingPilot (5m) are due
      jest.setSystemTime(new Date("2026-11-11T10:10:00.000Z"));
      const s10 = await executeMonitoringCycle({ now: new Date("2026-11-11T10:10:00.000Z") });
      expect(s10.checked).toBe(2);

      const finLabPings = pingCreateSpy.mock.calls.filter(
        ([arg]) => arg.monitorId === finLab._id
      ).length;
      const pingPilotPings = pingCreateSpy.mock.calls.filter(
        ([arg]) => arg.monitorId === pingPilot._id
      ).length;
      expect(finLabPings).toBe(2); // t=0m, t=10m
      expect(pingPilotPings).toBe(3); // t=0m, t=5m, t=10m
    });

    test("prevents concurrent double-claim in atomic claimMonitorForExecution and recovers after lease expiry", async () => {
      const candidate = createMockMonitor({ name: "Race Service", monitoringInterval: 5 });
      const now = new Date("2026-11-11T10:00:00.000Z");

      const findOneAndUpdateSpy = jest
        .spyOn(Monitor, "findOneAndUpdate")
        .mockResolvedValueOnce({ ...candidate, claimOwner: "worker-A" }) // first worker wins
        .mockResolvedValueOnce(null); // second concurrent worker sees existing claim -> returns null

      const [claimA, claimB] = await Promise.all([
        claimMonitorForExecution(candidate, "worker-A", { now, forceAtomicClaim: true }),
        claimMonitorForExecution(candidate, "worker-B", { now, forceAtomicClaim: true }),
      ]);

      expect(claimA).not.toBeNull();
      expect(claimA.claimOwner).toBe("worker-A");
      expect(claimB).toBeNull();
      expect(findOneAndUpdateSpy).toHaveBeenCalledTimes(2);

      // Check lease-expiry query allows recovery if previous worker crashed
      const expiredNow = new Date("2026-11-11T10:03:00.000Z");
      findOneAndUpdateSpy.mockResolvedValueOnce({ ...candidate, claimOwner: "worker-C" });
      const recovered = await claimMonitorForExecution(candidate, "worker-C", {
        now: expiredNow,
        forceAtomicClaim: true,
      });
      expect(recovered.claimOwner).toBe("worker-C");
      const recoveryFilter = findOneAndUpdateSpy.mock.calls[2][0];
      expect(JSON.stringify(recoveryFilter)).toContain("claimExpiresAt");

      const releaseSpy = jest.spyOn(Monitor, "updateOne").mockResolvedValue({ modifiedCount: 1 });
      await releaseMonitorClaim(candidate._id, "worker-C", { forceAtomicClaim: true });
      expect(releaseSpy).toHaveBeenCalledWith(
        { _id: candidate._id, claimOwner: "worker-C" },
        { $set: { claimOwner: null, claimExpiresAt: null } }
      );
    });

    test("respects distributed CycleLock conflict and releases lock on failure when connected", async () => {
      const duplicateErr = new Error("E11000 duplicate key");
      duplicateErr.code = 11000;

      const lockUpdateSpy = jest
        .spyOn(CycleLock, "findOneAndUpdate")
        .mockRejectedValueOnce(duplicateErr);
      const releaseSpy = jest.spyOn(CycleLock, "updateOne").mockResolvedValue({ modifiedCount: 1 });

      // Another instance holds the distributed lock -> returns skipped cleanly
      const skipped = await executeMonitoringCycle({ forceDbLock: true });
      expect(skipped.status).toBe("skipped");
      expect(skipped.reason).toContain("another worker");
      expect(releaseSpy).not.toHaveBeenCalled();

      // Now acquire lock succeeds, but Monitor.find throws -> distributed lock MUST be released
      lockUpdateSpy.mockImplementationOnce(async (_filter, update) => ({
        key: "monitoring-cycle",
        owner: update.$set.owner,
      }));
      jest.spyOn(Monitor, "find").mockRejectedValueOnce(new Error("Query error"));

      await expect(executeMonitoringCycle({ forceDbLock: true })).rejects.toThrow("Query error");
      expect(releaseSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("Internal Worker Endpoint POST /api/internal/monitor/run", () => {
    test("rejects unauthorized calls without worker secret", async () => {
      const res = await request(app).post("/api/internal/monitor/run");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Unauthorized");
    });

    test("rejects incorrect worker secret without leaking configured secret", async () => {
      const res = await request(app)
        .post("/api/internal/monitor/run")
        .set("x-worker-secret", "wrong-secret");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).not.toContain(process.env.PINGPILOT_WORKER_SECRET);
    });

    test("returns 500 when PINGPILOT_WORKER_SECRET is not configured on server", async () => {
      delete process.env.PINGPILOT_WORKER_SECRET;

      const res = await request(app)
        .post("/api/internal/monitor/run")
        .set("x-worker-secret", "anything");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("not configured");
    });

    test("authenticates with x-worker-secret and executes cycle for active monitors", async () => {
      const monitor = createMockMonitor({ name: "Worker Probe Target" });
      jest.spyOn(Monitor, "find").mockResolvedValue([monitor]);
      jest.spyOn(PingResult, "create").mockResolvedValue({ _id: "res-http" });
      global.fetch = jest.fn().mockResolvedValue({ status: 200, headers: new Map() });

      const res = await request(app)
        .post("/api/internal/monitor/run")
        .set("x-worker-secret", process.env.PINGPILOT_WORKER_SECRET);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("completed");
      expect(res.body.checked).toBe(1);
      expect(res.body.up).toBe(1);
      expect(res.body.failed).toBe(0);
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results[0]).toEqual(
        expect.objectContaining({
          monitorId: monitor._id,
          monitorName: "Worker Probe Target",
          status: "success",
          httpStatus: 200,
        })
      );
      expect(JSON.stringify(res.body)).not.toContain(process.env.PINGPILOT_WORKER_SECRET);
      expect(JSON.stringify(res.body)).not.toContain("8.8.8.8");
    });

    test("returns HTTP 409 for concurrent HTTP worker requests so scheduler handles overlap cleanly", async () => {
      let releaseFetch;
      const pendingFetch = new Promise((resolve) => {
        releaseFetch = () => resolve({ status: 200, headers: new Map() });
      });

      const monitor = createMockMonitor({ name: "Concurrent Target" });
      jest.spyOn(Monitor, "find").mockResolvedValue([monitor]);
      jest.spyOn(PingResult, "create").mockResolvedValue({ _id: "res-http-conc" });
      global.fetch = jest.fn().mockReturnValue(pendingFetch);

      // Fire first request and allow Express middleware + controller to enter executeMonitoringCycle
      const req1 = request(app)
        .post("/api/internal/monitor/run")
        .set("x-worker-secret", process.env.PINGPILOT_WORKER_SECRET);

      // Wait a tick for req1 to acquire isCycleRunning lock before firing req2
      const req1Promise = new Promise((resolve) => {
        req1.end((err, res) => resolve({ err, res }));
      });

      await new Promise((r) => setTimeout(r, 30));

      const res2 = await request(app)
        .post("/api/internal/monitor/run")
        .set("x-worker-secret", process.env.PINGPILOT_WORKER_SECRET);

      expect(res2.status).toBe(409);
      expect(res2.body.status).toBe("skipped");

      releaseFetch();
      const { err, res: res1 } = await req1Promise;
      expect(err).toBeNull();
      expect(res1.status).toBe(200);
      expect(res1.body.checked).toBe(1);
    });
  });

  describe("Startup & Recurring Scheduler (recurringService.js)", () => {
    test("executes initial startup cycle safely, prevents duplicate init, and stops timers cleanly", async () => {
      jest.useFakeTimers();

      const monitor = createMockMonitor({ name: "Startup Target" });
      jest.spyOn(Monitor, "find").mockResolvedValue([monitor]);
      jest.spyOn(PingResult, "create").mockResolvedValue({ _id: "res-startup" });
      global.fetch = jest.fn().mockResolvedValue({ status: 200, headers: new Map() });

      const mockLogger = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const stop1 = startRecurringWorker({
        logger: mockLogger,
        intervalMs: 300000,
        initialDelayMs: 15000,
        forceInTest: true,
      });

      try {
        // Calling a second time while active returns same handle and logs duplicate warning
        const stop2 = startRecurringWorker({
          logger: mockLogger,
          forceInTest: true,
        });
        expect(stop2).toBe(stop1);
        expect(mockLogger.warn).toHaveBeenCalled();

        // Advance past 15s initial startup delay
        await jest.advanceTimersByTimeAsync(15000);

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining("Initial cycle complete"));

        stop1();
        expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining("stopped"));

        // Advance timers further; stopped worker must NOT fire again
        await jest.advanceTimersByTimeAsync(350000);
        expect(global.fetch).toHaveBeenCalledTimes(1);
      } finally {
        stop1();
      }
    });

    test("logs error cleanly during startup cycle failure without unhandled rejection", async () => {
      jest.useFakeTimers();

      jest.spyOn(Monitor, "find").mockRejectedValue(new Error("Startup DB error"));
      const mockLogger = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const stop = startRecurringWorker({
        logger: mockLogger,
        initialDelayMs: 5000,
        forceInTest: true,
      });

      try {
        await jest.advanceTimersByTimeAsync(5000);

        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error in initial monitoring cycle:",
          "Startup DB error"
        );
      } finally {
        stop();
      }
    });

    test("disables duplicate in-process scheduler in production unless ENABLE_IN_PROCESS_WORKER is true", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalFlag = process.env.ENABLE_IN_PROCESS_WORKER;

      try {
        process.env.NODE_ENV = "production";
        delete process.env.ENABLE_IN_PROCESS_WORKER;

        const mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
        const stop = startRecurringWorker({ logger: mockLogger });

        expect(typeof stop).toBe("function");
        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.stringContaining("disabled in production")
        );
        stop();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalFlag === undefined) {
          delete process.env.ENABLE_IN_PROCESS_WORKER;
        } else {
          process.env.ENABLE_IN_PROCESS_WORKER = originalFlag;
        }
      }
    });
  });

  describe("Idempotent Interval Migration Script (migrateMonitorIntervals.js)", () => {
    test("computes safe defaults without touching valid intervals or monitor history", () => {
      const now = new Date("2026-11-11T10:00:00.000Z");
      const lastCheckedAt = new Date("2026-11-11T09:57:00.000Z");

      // Legacy doc with custom interval=10, missing monitoringInterval & nextCheckAt
      const legacyUpdate = buildMigrationUpdate(
        {
          _id: "m1",
          name: "Legacy 10m",
          interval: 10,
          isActive: true,
          lastCheckedAt,
        },
        now
      );
      expect(legacyUpdate).toEqual({
        monitoringInterval: 10,
        nextCheckAt: new Date(lastCheckedAt.getTime() + 10 * 60 * 1000),
        claimOwner: null,
        claimExpiresAt: null,
      });

      // Legacy doc with unsupported interval=3 -> falls back safely to 5
      const invalidUpdate = buildMigrationUpdate(
        {
          _id: "m2",
          name: "Legacy 3m",
          interval: 3,
          isActive: true,
          lastCheckedAt: null,
        },
        now
      );
      expect(invalidUpdate).toEqual({
        monitoringInterval: 5,
        interval: 5,
        nextCheckAt: now,
        claimOwner: null,
        claimExpiresAt: null,
      });

      // Second pass on already-migrated document produces empty update (idempotent)
      const secondPass = buildMigrationUpdate(
        {
          _id: "m1",
          name: "Migrated 10m",
          monitoringInterval: 10,
          interval: 10,
          isActive: true,
          lastCheckedAt,
          nextCheckAt: new Date(lastCheckedAt.getTime() + 10 * 60 * 1000),
          claimOwner: null,
          claimExpiresAt: null,
        },
        now
      );
      expect(secondPass).toEqual({});
    });

    test("supports dry-run and apply modes without deleting monitors or PingResult records", async () => {
      const now = new Date("2026-11-11T10:00:00.000Z");
      const docs = [
        { _id: "mon-1", name: "Unmigrated", interval: 15, isActive: true, lastCheckedAt: null },
        {
          _id: "mon-2",
          name: "Already Migrated",
          monitoringInterval: 5,
          interval: 5,
          isActive: true,
          nextCheckAt: now,
          claimOwner: null,
          claimExpiresAt: null,
        },
        { _id: "mon-3", name: "Paused Legacy", interval: 5, isActive: false },
      ];

      jest.spyOn(Monitor, "find").mockResolvedValue(docs);
      const updateOneSpy = jest.spyOn(Monitor, "updateOne").mockResolvedValue({ modifiedCount: 1 });
      const deleteMonitorSpy = jest.spyOn(Monitor, "deleteMany");
      const deleteHistorySpy = jest.spyOn(PingResult, "deleteMany");

      const mockLogger = { log: jest.fn() };
      const dryRunResult = await migrateMonitorIntervals({ dryRun: true, now, logger: mockLogger });
      expect(dryRunResult.dryRun).toBe(true);
      expect(dryRunResult.totalMonitors).toBe(3);
      expect(dryRunResult.updatedCount).toBe(2);
      expect(dryRunResult.unchangedCount).toBe(1);
      expect(updateOneSpy).not.toHaveBeenCalled();

      const applyResult = await migrateMonitorIntervals({ dryRun: false, now, logger: mockLogger });
      expect(applyResult.dryRun).toBe(false);
      expect(applyResult.updatedCount).toBe(2);
      expect(applyResult.unchangedCount).toBe(1);
      expect(updateOneSpy).toHaveBeenCalledTimes(2);
      expect(deleteMonitorSpy).not.toHaveBeenCalled();
      expect(deleteHistorySpy).not.toHaveBeenCalled();
    });
  });
});
