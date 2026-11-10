const request = require("supertest");
const app = require("../app");
const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const SystemSetting = require("../models/SystemSetting");
const { pingMonitor, executeMonitoringCycle } = require("../services/monitoringEngine");

process.env.PINGPILOT_WORKER_SECRET = "super-secret-worker-key-999";

describe("Monitoring Engine & Worker Endpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("pingMonitor() Execution Logic", () => {
    test("records successful ping, updates response time, and restores UP status", async () => {
      const mockMonitor = {
        _id: "60d0fe4f5311236168a109ca",
        name: "Mock Service",
        url: "https://8.8.8.8", // Using valid public IP to pass SSRF
        method: "GET",
        timeout: 10,
        expectedStatusCodes: [200],
        currentStatus: "DOWN",
        consecutiveFailures: 2,
        consecutiveSuccesses: 0,
        failureThreshold: 2,
        save: jest.fn().mockResolvedValue(true),
      };

      // Mock global fetch to return 200 OK
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        headers: new Map(),
      });

      jest.spyOn(PingResult, "create").mockResolvedValue({
        _id: "70d0fe4f5311236168a109cb",
      });

      const outcome = await pingMonitor(mockMonitor);

      expect(outcome.pingStatus).toBe("UP");
      expect(outcome.statusCode).toBe(200);
      expect(mockMonitor.currentStatus).toBe("UP");
      expect(mockMonitor.consecutiveSuccesses).toBe(1);
      expect(mockMonitor.consecutiveFailures).toBe(0);
      expect(mockMonitor.save).toHaveBeenCalled();
    });

    test("handles consecutive failures and triggers DOWN status only after reaching threshold", async () => {
      const mockMonitor = {
        _id: "60d0fe4f5311236168a109ca",
        name: "Failing Service",
        url: "https://8.8.8.8",
        method: "GET",
        timeout: 10,
        expectedStatusCodes: [200],
        currentStatus: "UP",
        consecutiveFailures: 0,
        consecutiveSuccesses: 5,
        failureThreshold: 2,
        save: jest.fn().mockResolvedValue(true),
      };

      // Mock fetch returning 503 Service Unavailable
      global.fetch = jest.fn().mockResolvedValue({
        status: 503,
        headers: new Map(),
      });

      jest.spyOn(PingResult, "create").mockResolvedValue({
        _id: "70d0fe4f5311236168a109cb",
      });

      // 1st failure: consecutiveFailures becomes 1, status remains UP (threshold is 2)
      await pingMonitor(mockMonitor);
      expect(mockMonitor.consecutiveFailures).toBe(1);
      expect(mockMonitor.currentStatus).toBe("UP");

      // 2nd failure: consecutiveFailures becomes 2, threshold reached -> status changes to DOWN
      await pingMonitor(mockMonitor);
      expect(mockMonitor.consecutiveFailures).toBe(2);
      expect(mockMonitor.currentStatus).toBe("DOWN");
    });

    test("handles request timeout gracefully", async () => {
      const mockMonitor = {
        _id: "60d0fe4f5311236168a109ca",
        name: "Laggy Service",
        url: "https://8.8.8.8",
        method: "GET",
        timeout: 1,
        expectedStatusCodes: [200],
        currentStatus: "UP",
        consecutiveFailures: 0,
        failureThreshold: 2,
        save: jest.fn().mockResolvedValue(true),
      };

      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      global.fetch = jest.fn().mockRejectedValue(abortError);

      jest.spyOn(PingResult, "create").mockResolvedValue({
        _id: "70d0fe4f5311236168a109cb",
      });

      const outcome = await pingMonitor(mockMonitor);
      expect(outcome.pingStatus).toBe("DOWN");
      expect(outcome.errorMessage).toContain("Connection timed out");
    });
  });

  describe("Internal Worker Endpoint POST /api/internal/monitor/run", () => {
    test("rejects unauthorized calls without worker secret", async () => {
      const res = await request(app).post("/api/internal/monitor/run");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Unauthorized");
    });

    test("rejects incorrect worker secret", async () => {
      const res = await request(app)
        .post("/api/internal/monitor/run")
        .set("x-worker-secret", "wrong-secret");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("authenticates and executes monitoring cycle with valid worker secret", async () => {
      jest.spyOn(SystemSetting, "findOne").mockResolvedValue({ value: 30 });
      jest.spyOn(Monitor, "find").mockResolvedValue([]);

      const res = await request(app)
        .post("/api/internal/monitor/run")
        .set("x-worker-secret", process.env.PINGPILOT_WORKER_SECRET);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("completed");
    });
  });
});
