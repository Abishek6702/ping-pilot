const request = require("supertest");
const app = require("../app");
const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const User = require("../models/User");
const { generateToken } = require("../utils/generateToken");

process.env.JWT_SECRET = "test-secret-key-32-chars-long-pingpilot";
process.env.ADMIN_EMAIL = "admin@pingpilot.local";

describe("Monitors Management API", () => {
  let adminToken;
  const adminUser = {
    _id: "507f1f77bcf86cd799439011",
    name: "Admin",
    email: "admin@pingpilot.local",
    role: "admin",
    isActive: true,
  };

  beforeAll(() => {
    adminToken = generateToken({
      id: adminUser._id,
      role: adminUser.role,
      email: adminUser.email,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.spyOn(User, "findById").mockResolvedValue(adminUser);
  });

  describe("Mongoose Monitor Schema Interval Validation", () => {
    test("defaults monitoringInterval to 5 and syncs interval", async () => {
      const doc = new Monitor({
        name: "Default Schema Monitor",
        url: "https://8.8.8.8/health",
      });
      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.monitoringInterval).toBe(5);
      expect(doc.interval).toBe(5);
    });

    test.each([1, 5, 10, 15, 30, 60])(
      "accepts supported monitoringInterval %i minutes",
      async (validInterval) => {
        const doc = new Monitor({
          name: `Interval ${validInterval}`,
          url: "https://8.8.8.8/health",
          monitoringInterval: validInterval,
        });
        await expect(doc.validate()).resolves.toBeUndefined();
        expect(doc.monitoringInterval).toBe(validInterval);
        expect(doc.interval).toBe(validInterval);
      }
    );

    test.each([0, 2, 3, 120])(
      "rejects unsupported monitoringInterval %i at schema validation level",
      async (invalidInterval) => {
        const doc = new Monitor({
          name: "Bad Interval Monitor",
          url: "https://8.8.8.8/health",
          monitoringInterval: invalidInterval,
        });
        await expect(doc.validate()).rejects.toThrow();
      }
    );
  });

  describe("POST /api/monitors", () => {
    test("rejects request if unauthorized", async () => {
      const res = await request(app).post("/api/monitors").send({
        name: "Test API",
        url: "https://example.com/health",
      });
      expect(res.status).toBe(401);
    });

    test("validates required fields (name and valid URL)", async () => {
      const res = await request(app)
        .post("/api/monitors")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "",
          url: "not-a-valid-url",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("rejects private or localhost target URLs due to SSRF protection", async () => {
      const res = await request(app)
        .post("/api/monitors")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Local Service",
          url: "http://127.0.0.1:8080/metrics",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("URL rejected for security");
    });

    test("creates monitor with default 5-minute interval and initializes nextCheckAt", async () => {
      const createSpy = jest.spyOn(Monitor, "create").mockImplementation(async (doc) => ({
        _id: "60d0fe4f5311236168a109cb",
        ...doc,
      }));

      const res = await request(app)
        .post("/api/monitors")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "PingPilot Health",
          url: "https://8.8.8.8/health",
          timeout: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          monitoringInterval: 5,
          interval: 5,
          timeout: 10,
          isActive: true,
        })
      );
      const createdArg = createSpy.mock.calls[0][0];
      expect(createdArg.nextCheckAt).toBeInstanceOf(Date);
    });

    test.each([1, 5, 10, 15, 30, 60])(
      "creates monitor with configured interval %i minutes",
      async (selectedInterval) => {
        const createSpy = jest.spyOn(Monitor, "create").mockImplementation(async (doc) => ({
          _id: "60d0fe4f5311236168a109cc",
          ...doc,
        }));

        const res = await request(app)
          .post("/api/monitors")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            name: `Service ${selectedInterval}m`,
            url: "https://8.8.8.8/health",
            monitoringInterval: selectedInterval,
          });

        expect(res.status).toBe(201);
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            monitoringInterval: selectedInterval,
            interval: selectedInterval,
          })
        );
      }
    );

    test.each([0, 2, 3, 120])(
      "rejects unsupported monitoringInterval %i with HTTP 400",
      async (badInterval) => {
        const createSpy = jest.spyOn(Monitor, "create");

        const res = await request(app)
          .post("/api/monitors")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            name: "Invalid Interval Service",
            url: "https://8.8.8.8/health",
            monitoringInterval: badInterval,
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(createSpy).not.toHaveBeenCalled();
      }
    );
  });

  describe("PATCH /api/monitors/:id", () => {
    test("recalculates nextCheckAt without creating duplicate ping history when monitoringInterval changes", async () => {
      const lastCheckedAt = new Date(Date.now() - 4 * 60 * 1000);
      const mockMonitor = {
        _id: "60d0fe4f5311236168a109cd",
        name: "FinLab",
        url: "https://8.8.8.8/health",
        monitoringInterval: 5,
        interval: 5,
        isActive: true,
        lastCheckedAt,
        nextCheckAt: new Date(lastCheckedAt.getTime() + 5 * 60 * 1000),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Monitor, "findById").mockResolvedValue(mockMonitor);
      const pingCreateSpy = jest.spyOn(PingResult, "create");

      const res = await request(app)
        .patch(`/api/monitors/${mockMonitor._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ monitoringInterval: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockMonitor.monitoringInterval).toBe(10);
      expect(mockMonitor.interval).toBe(10);
      expect(mockMonitor.nextCheckAt.getTime()).toBe(lastCheckedAt.getTime() + 10 * 60 * 1000);
      expect(mockMonitor.save).toHaveBeenCalledTimes(1);
      expect(pingCreateSpy).not.toHaveBeenCalled();
    });

    test.each([0, 2, 3, 120])(
      "rejects unsupported monitoringInterval %i on PATCH /api/monitors/:id",
      async (badInterval) => {
        const res = await request(app)
          .patch("/api/monitors/60d0fe4f5311236168a109cd")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ monitoringInterval: badInterval });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      }
    );
  });

  describe("PATCH /api/monitors/:id/toggle", () => {
    test("pausing monitor clears nextCheckAt and claim metadata", async () => {
      const mockMonitor = {
        _id: "60d0fe4f5311236168a109ca",
        name: "Gateway API",
        monitoringInterval: 10,
        interval: 10,
        isActive: true,
        currentStatus: "UP",
        nextCheckAt: new Date(Date.now() + 300000),
        claimOwner: "worker-1",
        claimExpiresAt: new Date(Date.now() + 60000),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Monitor, "findById").mockResolvedValue(mockMonitor);

      const res = await request(app)
        .patch(`/api/monitors/${mockMonitor._id}/toggle`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockMonitor.isActive).toBe(false);
      expect(mockMonitor.currentStatus).toBe("PAUSED");
      expect(mockMonitor.nextCheckAt).toBeNull();
      expect(mockMonitor.claimOwner).toBeNull();
      expect(mockMonitor.claimExpiresAt).toBeNull();
      expect(mockMonitor.save).toHaveBeenCalled();
    });

    test("re-enabling paused monitor schedules nextCheckAt properly without immediate duplicate if within interval", async () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const mockMonitor = {
        _id: "60d0fe4f5311236168a109ce",
        name: "Resumed Service",
        monitoringInterval: 10,
        interval: 10,
        isActive: false,
        currentStatus: "PAUSED",
        lastCheckedAt: twoMinutesAgo,
        nextCheckAt: null,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Monitor, "findById").mockResolvedValue(mockMonitor);

      const res = await request(app)
        .patch(`/api/monitors/${mockMonitor._id}/toggle`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(mockMonitor.isActive).toBe(true);
      expect(mockMonitor.currentStatus).toBe("UNKNOWN");
      expect(mockMonitor.nextCheckAt).toBeInstanceOf(Date);
      expect(mockMonitor.nextCheckAt.getTime()).toBe(twoMinutesAgo.getTime() + 10 * 60 * 1000);
    });
  });

  describe("DELETE /api/monitors/:id", () => {
    test("deletes monitor and purges associated ping history", async () => {
      const monitorId = "60d0fe4f5311236168a109ca";
      jest.spyOn(Monitor, "findById").mockResolvedValue({ _id: monitorId });
      jest.spyOn(Monitor, "findByIdAndDelete").mockResolvedValue(true);
      jest.spyOn(PingResult, "deleteMany").mockResolvedValue({ deletedCount: 42 });

      const res = await request(app)
        .delete(`/api/monitors/${monitorId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Monitor.findByIdAndDelete).toHaveBeenCalledWith(monitorId);
      expect(PingResult.deleteMany).toHaveBeenCalledWith({ monitorId });
    });
  });
});

