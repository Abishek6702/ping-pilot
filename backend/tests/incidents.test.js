const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const Incident = require("../models/Incident");
const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const NotificationLog = require("../models/NotificationLog");
const User = require("../models/User");
const { generateToken } = require("../utils/generateToken");
const { handleMonitorCheckForIncident } = require("../services/incidentService");
const notificationService = require("../services/notificationService");

process.env.JWT_SECRET = "test-secret-key-32-chars-long-pingpilot";
process.env.ADMIN_EMAIL = "admin@pingpilot.local";
delete process.env.MONGO_URI;
delete process.env.MONGODB_URI;

describe("Phase 1: Incident Management Service & API", () => {
  const userId = "507f1f77bcf86cd799439022";
  const otherUserId = "507f1f77bcf86cd799439033";
  const monitorId = "60d0fe4f5311236168a109ca";
  const pingId1 = "60d0fe4f5311236168a109f1";
  const pingId2 = "60d0fe4f5311236168a109f2";
  const regularUser = {
    _id: userId,
    name: "Alice User",
    email: "alice@example.com",
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

  describe("Automated Incident Lifecycle Engine", () => {
    test("creates an active incident when monitor transitions to DOWN and attaches notification", async () => {
      jest.spyOn(Incident, "findOne").mockResolvedValue(null);
      const createdIncident = {
        _id: "60d0fe4f5311236168a10aa1",
        incidentKey: "INC-20261111-ABCDEF",
        monitorId,
        userId,
        status: "Detected",
        isActive: true,
        startedAt: new Date("2026-11-11T10:00:00.000Z"),
      };
      const createSpy = jest.spyOn(Incident, "create").mockResolvedValue(createdIncident);
      const dispatchSpy = jest
        .spyOn(notificationService, "dispatchIncidentNotification")
        .mockResolvedValue({ success: true });

      const monitor = {
        _id: monitorId,
        userId,
        name: "Checkout API",
        url: "https://api.example.com/checkout",
        currentStatus: "DOWN",
        consecutiveFailures: 2,
        lastError: "HTTP 503",
      };
      const pingResult = {
        _id: pingId1,
        status: "DOWN",
        statusCode: 503,
        checkedAt: new Date("2026-11-11T10:00:00.000Z"),
      };

      const res = await handleMonitorCheckForIncident({
        monitor,
        pingResult,
        previousStatus: "UP",
      });

      expect(res.handled).toBe(true);
      expect(res.action).toBe("created");
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy.mock.calls[0][0].userId).toBe(userId);
      expect(createSpy.mock.calls[0][0].status).toBe("Detected");
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "DOWN", monitor, incident: createdIncident })
      );
    });

    test("attaches subsequent failed pings to existing active incident without duplicates", async () => {
      const existingActive = {
        _id: "60d0fe4f5311236168a10aa1",
        incidentKey: "INC-20261111-ABCDEF",
        monitorId,
        isActive: true,
        affectedPingIds: [pingId1],
        affectedChecksCount: 1,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Incident, "findOne").mockResolvedValue(existingActive);
      const createSpy = jest.spyOn(Incident, "create");

      const res = await handleMonitorCheckForIncident({
        monitor: { _id: monitorId, name: "Checkout API", currentStatus: "DOWN" },
        pingResult: { _id: pingId2, status: "DOWN", checkedAt: new Date() },
        previousStatus: "DOWN",
      });

      expect(res.action).toBe("updated");
      expect(createSpy).not.toHaveBeenCalled();
      expect(existingActive.affectedChecksCount).toBe(2);
      expect(existingActive.affectedPingIds).toHaveLength(2);
      expect(existingActive.save).toHaveBeenCalled();
    });

    test("deduplicates cleanly on E11000 concurrent incident creation race", async () => {
      const existingRaced = {
        _id: "60d0fe4f5311236168a10aa1",
        incidentKey: "INC-20261111-ABCDEF",
        isActive: true,
        affectedPingIds: [],
        affectedChecksCount: 1,
        save: jest.fn().mockResolvedValue(true),
      };
      jest
        .spyOn(Incident, "findOne")
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingRaced);
      const dupErr = new Error("Duplicate active incident");
      dupErr.code = 11000;
      jest.spyOn(Incident, "create").mockRejectedValue(dupErr);

      const res = await handleMonitorCheckForIncident({
        monitor: { _id: monitorId, name: "Checkout API", currentStatus: "DOWN" },
        pingResult: { _id: pingId2, status: "DOWN", checkedAt: new Date() },
        previousStatus: "UP",
      });

      expect(res.action).toBe("deduplicated");
      expect(existingRaced.save).toHaveBeenCalled();
    });

    test("resolves active incident automatically on UP check and calculates exact downtime", async () => {
      const startedAt = new Date("2026-11-11T10:00:00.000Z");
      const resolvedAt = new Date("2026-11-11T10:07:30.000Z");
      const activeIncident = {
        _id: "60d0fe4f5311236168a10aa1",
        incidentKey: "INC-20261111-ABCDEF",
        monitorId,
        userId,
        status: "Detected",
        isActive: true,
        startedAt,
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Incident, "findOne").mockResolvedValue(activeIncident);
      const dispatchSpy = jest
        .spyOn(notificationService, "dispatchIncidentNotification")
        .mockResolvedValue({ success: true });

      const res = await handleMonitorCheckForIncident({
        monitor: { _id: monitorId, userId, name: "Checkout API", currentStatus: "UP" },
        pingResult: {
          _id: pingId2,
          status: "UP",
          statusCode: 200,
          responseTime: 145,
          checkedAt: resolvedAt,
        },
        previousStatus: "DOWN",
      });

      expect(res.action).toBe("resolved");
      expect(activeIncident.status).toBe("Resolved");
      expect(activeIncident.isActive).toBe(false);
      expect(activeIncident.downtimeDurationMs).toBe(450000);
      expect(activeIncident.save).toHaveBeenCalled();
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "RECOVERED", incident: activeIncident })
      );
    });
  });

  describe("Incident HTTP Endpoints & Ownership Isolation", () => {
    test("GET /api/incidents filters strictly to authenticated userId and passes parameters", async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([
          {
            _id: "60d0fe4f5311236168a10aa1",
            incidentKey: "INC-20261111-ABCDEF",
            userId,
            title: "Checkout API is experiencing downtime",
            status: "Detected",
            isActive: true,
            startedAt: new Date(Date.now() - 60000),
          },
        ]),
      };
      const findSpy = jest.spyOn(Incident, "find").mockReturnValue(mockQuery);
      jest.spyOn(Incident, "countDocuments").mockResolvedValue(1);

      const res = await request(app)
        .get("/api/incidents?status=Detected&activeOnly=true")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(String),
          status: "Detected",
          isActive: true,
        })
      );
      expect(res.body.data).toHaveLength(1);
      expect(typeof res.body.data[0].liveDurationMs).toBe("number");
    });

    test("GET /api/incidents/:id blocks cross-user access with 403", async () => {
      const incId = "60d0fe4f5311236168a10aa9";
      const baseQuery = {
        populate: jest.fn().mockResolvedValue({
          _id: incId,
          userId: otherUserId,
          title: "Private Service Down",
        }),
      };
      jest.spyOn(Incident, "findById").mockReturnValue(baseQuery);

      const res = await request(app)
        .get(`/api/incidents/${incId}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test("PATCH /api/incidents/:id transitions workflow stage, adds note, and rejects invalid stage", async () => {
      const incId = "60d0fe4f5311236168a10aa9";

      const badRes = await request(app)
        .patch(`/api/incidents/${incId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ status: "BogusStage" });
      expect(badRes.status).toBe(400);

      const doc = {
        _id: incId,
        userId,
        status: "Detected",
        isActive: true,
        startedAt: new Date(Date.now() - 120000),
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Incident, "findById").mockResolvedValue(doc);

      const okRes = await request(app)
        .patch(`/api/incidents/${incId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          status: "Investigating",
          note: "Inspecting upstream load balancer metrics",
        });

      expect(okRes.status).toBe(200);
      expect(doc.status).toBe("Investigating");
      expect(doc.isActive).toBe(true);
      expect(doc.timeline).toHaveLength(1);
      expect(doc.timeline[0].actorType).toBe("user");
      expect(doc.save).toHaveBeenCalled();
    });

    test("PATCH /api/incidents/:id resolves manually and computes downtime", async () => {
      const incId = "60d0fe4f5311236168a10aa9";
      const doc = {
        _id: incId,
        userId,
        status: "Monitoring",
        isActive: true,
        startedAt: new Date(Date.now() - 300000),
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Incident, "findById").mockResolvedValue(doc);

      const res = await request(app)
        .patch(`/api/incidents/${incId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          status: "Resolved",
          resolutionNotes: "Rolled back faulty gateway deployment",
        });

      expect(res.status).toBe(200);
      expect(doc.status).toBe("Resolved");
      expect(doc.isActive).toBe(false);
      expect(doc.resolvedAt).toBeInstanceOf(Date);
      expect(doc.downtimeDurationMs).toBeGreaterThanOrEqual(299000);
    });
  });
});

