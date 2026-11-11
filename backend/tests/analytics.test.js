const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const Incident = require("../models/Incident");
const User = require("../models/User");
const { generateToken } = require("../utils/generateToken");
const {
  resolveDateWindow,
  calculateIncidentOverlapMs,
  calculateMttrMs,
  buildMonitorAnalyticsSummary,
} = require("../services/analyticsService");

process.env.JWT_SECRET = "test-secret-key-32-chars-long-pingpilot";
delete process.env.MONGO_URI;
delete process.env.MONGODB_URI;

describe("Phase 2: Advanced Analytics Service & API", () => {
  const userId = "507f1f77bcf86cd799439022";
  const otherUserId = "507f1f77bcf86cd799439099";
  const regularUser = {
    _id: userId,
    name: "Analytics User",
    email: "analytics@example.com",
    role: "user",
    isActive: true,
  };
  let userToken;

  beforeAll(() => {
    userToken = generateToken({
      id: regularUser._id,
      role: regularUser.role,
      email: regularUser.email,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.spyOn(User, "findById").mockResolvedValue(regularUser);
  });

  describe("Analytics Calculation Edge Cases", () => {
    test("resolveDateWindow computes accurate current & preceding comparison bounds", () => {
      const now = new Date("2026-11-11T12:00:00.000Z");
      const w24 = resolveDateWindow({ range: "24h", now });
      expect(w24.granularity).toBe("hour");
      expect(w24.end.toISOString()).toBe("2026-11-11T12:00:00.000Z");
      expect(w24.start.toISOString()).toBe("2026-11-10T12:00:00.000Z");
      expect(w24.previousEnd.toISOString()).toBe("2026-11-10T12:00:00.000Z");
      expect(w24.previousStart.toISOString()).toBe("2026-11-09T12:00:00.000Z");

      expect(() =>
        resolveDateWindow({
          range: "custom",
          startDate: "2026-11-11T00:00:00Z",
          endDate: "2026-11-10T00:00:00Z",
        })
      ).toThrow("endDate must be later than startDate");
    });

    test("calculateIncidentOverlapMs clamps outages accurately to the window boundaries", () => {
      const windowStart = new Date("2026-11-10T10:00:00.000Z");
      const windowEnd = new Date("2026-11-11T10:00:00.000Z");

      // Outage began 2 hours BEFORE windowStart and resolved 1 hour AFTER windowStart
      const overlap = calculateIncidentOverlapMs(
        {
          startedAt: new Date("2026-11-10T08:00:00.000Z"),
          resolvedAt: new Date("2026-11-10T11:00:00.000Z"),
        },
        windowStart,
        windowEnd
      );
      expect(overlap).toBe(60 * 60 * 1000);
    });

    test("calculateMttrMs returns null for zero resolved incidents and computes exact average otherwise", () => {
      expect(calculateMttrMs([{ isActive: true, startedAt: new Date() }])).toBeNull();
      const mttr = calculateMttrMs([
        {
          isActive: false,
          startedAt: new Date("2026-11-10T00:00:00Z"),
          resolvedAt: new Date("2026-11-10T00:02:00Z"),
          downtimeDurationMs: 120000,
        },
        {
          isActive: false,
          startedAt: new Date("2026-11-10T01:00:00Z"),
          resolvedAt: new Date("2026-11-10T01:04:00Z"),
          downtimeDurationMs: 240000,
        },
      ]);
      expect(mttr).toBe(180000);
    });

    test("buildMonitorAnalyticsSummary distinguishes NO_DATA and PAUSED instead of fabricating 100% uptime", () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 86400000);

      const noDataMonitor = buildMonitorAnalyticsSummary({
        monitor: { _id: "m1", name: "Fresh", url: "https://a.com", isActive: true },
        pingAgg: null,
        incidents: [],
        windowStart,
        windowEnd: now,
      });
      expect(noDataMonitor.uptimePercentage).toBeNull();
      expect(noDataMonitor.dataStatus).toBe("NO_DATA");

      const pausedMonitor = buildMonitorAnalyticsSummary({
        monitor: { _id: "m2", name: "Paused", url: "https://b.com", isActive: false },
        pingAgg: null,
        incidents: [],
        windowStart,
        windowEnd: now,
      });
      expect(pausedMonitor.uptimePercentage).toBeNull();
      expect(pausedMonitor.dataStatus).toBe("PAUSED");
    });
  });

  describe("Analytics HTTP Endpoints", () => {
    test("GET /api/analytics aggregates metrics cleanly with comparison deltas", async () => {
      const mId = new mongoose.Types.ObjectId();
      jest.spyOn(Monitor, "find").mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: mId,
            userId,
            name: "Core API",
            url: "https://api.example.com",
            isActive: true,
            currentStatus: "UP",
            monitoringInterval: 5,
          },
        ]),
      });

      jest
        .spyOn(PingResult, "aggregate")
        // Current per-monitor
        .mockResolvedValueOnce([
          {
            _id: mId,
            totalChecks: 100,
            successfulChecks: 98,
            failedChecks: 2,
            avgResponseTime: 210,
            minResponseTime: 90,
            maxResponseTime: 480,
          },
        ])
        // Current series
        .mockResolvedValueOnce([
          {
            _id: "2026-11-11T10:00:00.000Z",
            totalChecks: 100,
            successfulChecks: 98,
            failedChecks: 2,
            avgResponseTime: 210,
            minResponseTime: 90,
            maxResponseTime: 480,
          },
        ])
        // Previous per-monitor
        .mockResolvedValueOnce([
          {
            _id: mId,
            totalChecks: 100,
            successfulChecks: 95,
            failedChecks: 5,
            avgResponseTime: 250,
            minResponseTime: 100,
            maxResponseTime: 600,
          },
        ])
        // Previous series
        .mockResolvedValueOnce([]);

      jest.spyOn(Incident, "find").mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await request(app)
        .get("/api/analytics?range=7d")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.overview.overallUptime).toBe(98);
      expect(res.body.data.comparison.deltas.uptimePercentageDelta).toBe(3);
      expect(res.body.data.comparison.deltas.avgResponseTimeDelta).toBe(-40);
      expect(res.body.data.perMonitor).toHaveLength(1);
    });

    test("GET /api/analytics/monitors/:id denies cross-user monitor analytics", async () => {
      const mId = "60d0fe4f5311236168a109ca";
      jest.spyOn(Monitor, "findById").mockResolvedValue({
        _id: mId,
        userId: otherUserId,
        name: "Someone Elses Monitor",
      });

      const res = await request(app)
        .get(`/api/analytics/monitors/${mId}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });
});

