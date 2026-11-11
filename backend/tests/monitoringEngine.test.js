const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const connectDB = require("../config/db");
const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const SystemSetting = require("../models/SystemSetting");
const CycleLock = require("../models/CycleLock");
const { pingMonitor, executeMonitoringCycle } = require("../services/monitoringEngine");
const { startRecurringWorker } = require("../services/recurringService");

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
    interval: 5,
    timeout: 10,
    expectedStatusCodes: [200],
    isActive: true,
    currentStatus: "UP",
    consecutiveFailures: 0,
    consecutiveSuccesses: 1,
    failureThreshold: 2,
    lastCheckedAt: null,
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

      await jest.advanceTimersByTimeAsync(5000);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error in initial monitoring cycle:",
        "Startup DB error"
      );

      stop();
    });
  });
});
