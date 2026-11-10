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
    jest.spyOn(User, "findById").mockResolvedValue(adminUser);
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
  });

  describe("PATCH /api/monitors/:id/toggle", () => {
    test("toggles monitor isActive status between active and PAUSED", async () => {
      const mockMonitor = {
        _id: "60d0fe4f5311236168a109ca",
        name: "Gateway API",
        isActive: true,
        currentStatus: "UP",
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
      expect(mockMonitor.save).toHaveBeenCalled();
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

