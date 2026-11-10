const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const { generateToken } = require("../utils/generateToken");

describe("Admin & Multi-User API", () => {
  const adminToken = generateToken({
    id: "507f1f77bcf86cd799439011",
    role: "admin",
    email: "abishekkrishnat@gmail.com",
  });

  const userToken = generateToken({
    id: "507f1f77bcf86cd799439022",
    role: "user",
    email: "user@example.com",
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Access Control for /api/admin/*", () => {
    test("rejects unauthenticated requests with 401", async () => {
      const res = await request(app).get("/api/admin/overview");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("rejects standard user requests with 403 Forbidden", async () => {
      jest.spyOn(User, "findById").mockResolvedValue({
        _id: "507f1f77bcf86cd799439022",
        role: "user",
        email: "user@example.com",
        isActive: true,
      });

      const res = await request(app)
        .get("/api/admin/overview")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Access forbidden: admin privileges required");
    });

    test("allows admin access to /api/admin/overview", async () => {
      jest.spyOn(User, "findById").mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        role: "admin",
        email: "abishekkrishnat@gmail.com",
        isActive: true,
      });

      jest.spyOn(User, "countDocuments").mockResolvedValue(12);
      jest.spyOn(Monitor, "countDocuments").mockResolvedValue(45);
      jest.spyOn(PingResult, "countDocuments").mockResolvedValue(1280);
      jest.spyOn(User, "find").mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const res = await request(app)
        .get("/api/admin/overview")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.totalUsers).toBe(12);
    });
  });

  describe("POST /api/auth/register", () => {
    test("registers a new user and issues auth token", async () => {
      process.env.ALLOW_PUBLIC_REGISTRATION = "true";

      jest.spyOn(User, "findOne").mockResolvedValue(null);
      jest.spyOn(User.prototype, "save").mockResolvedValue(true);

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test Developer",
          email: "dev@example.com",
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe("dev@example.com");
      expect(res.body.user.role).toBe("user");
    });
  });
});
