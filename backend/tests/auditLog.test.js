const request = require("supertest");
const app = require("../app");
const AuditLog = require("../models/AuditLog");
const Monitor = require("../models/Monitor");
const SystemSetting = require("../models/SystemSetting");
const User = require("../models/User");
const { generateToken } = require("../utils/generateToken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-32-chars-long-pingpilot";
process.env.PINGPILOT_WORKER_SECRET = process.env.PINGPILOT_WORKER_SECRET || "worker-secret-test-value";

describe("Audit Log Model, Middleware & Admin Endpoint", () => {
  const adminToken = generateToken({
    id: "507f1f77bcf86cd799439011",
    role: "admin",
    email: "admin@pingpilot.local",
  });

  const userToken = generateToken({
    id: "507f1f77bcf86cd799439022",
    role: "user",
    email: "dev@example.com",
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("AuditLog Mongoose Schema", () => {
    test("applies expected defaults and indexes", () => {
      const doc = new AuditLog({
        method: "GET",
        endpoint: "/api/monitors",
        statusCode: 200,
      });

      expect(doc.userId).toBeNull();
      expect(doc.name).toBe("Anonymous");
      expect(doc.role).toBe("Guest");
      expect(doc.action).toBe("");
      expect(doc.success).toBe(true);

      const indexes = AuditLog.schema.indexes();
      expect(indexes).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([expect.objectContaining({ createdAt: -1 })]),
          expect.arrayContaining([expect.objectContaining({ userId: 1 })]),
          expect.arrayContaining([expect.objectContaining({ endpoint: 1 })]),
          expect.arrayContaining([expect.objectContaining({ method: 1 })]),
        ])
      );
    });
  });

  describe("auditLogger Middleware", () => {
    test("records authenticated API requests with user metadata, action, IP, and response time", async () => {
      jest.spyOn(User, "findById").mockResolvedValue({
        _id: "507f1f77bcf86cd799439022",
        name: "Dev User",
        email: "dev@example.com",
        role: "user",
        isActive: true,
      });
      jest.spyOn(Monitor, "find").mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      jest.spyOn(Monitor, "countDocuments").mockResolvedValue(0);
      const createSpy = jest.spyOn(AuditLog, "create").mockResolvedValue({});

      const res = await request(app)
        .get("/api/monitors?status=UP")
        .set("Authorization", `Bearer ${userToken}`)
        .set("User-Agent", "PingPilot-Test-Agent/1.0")
        .set("X-Forwarded-For", "203.0.113.10, 10.0.0.1");

      await new Promise((resolve) => setImmediate(resolve));

      expect(res.status).toBe(200);
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "507f1f77bcf86cd799439022",
          name: "Dev User",
          role: "user",
          action: "List Monitors",
          method: "GET",
          endpoint: "/api/monitors",
          statusCode: 200,
          success: true,
          ipAddress: "203.0.113.10",
          userAgent: "PingPilot-Test-Agent/1.0",
          responseTime: expect.any(Number),
        })
      );
    });

    test("captures authenticated identity on POST /api/auth/login and marks failures as Anonymous", async () => {
      const createSpy = jest.spyOn(AuditLog, "create").mockResolvedValue({});

      const mockUser = {
        _id: "507f1f77bcf86cd799439033",
        name: "Alice Admin",
        email: "alice@example.com",
        role: "user",
        authProviders: ["local"],
        isActive: true,
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(User, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const okRes = await request(app).post("/api/auth/login").send({
        email: "alice@example.com",
        password: "Password123!",
      });
      await new Promise((resolve) => setImmediate(resolve));

      expect(okRes.status).toBe(200);
      expect(createSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          userId: "507f1f77bcf86cd799439033",
          name: "Alice Admin",
          role: "user",
          action: "User Login",
          method: "POST",
          endpoint: "/api/auth/login",
          statusCode: 200,
          success: true,
        })
      );

      jest.spyOn(User, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const failRes = await request(app).post("/api/auth/login").send({
        email: "unknown@example.com",
        password: "wrong-password",
      });
      await new Promise((resolve) => setImmediate(resolve));

      expect(failRes.status).toBe(401);
      expect(createSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          userId: null,
          name: "Anonymous",
          role: "Guest",
          action: "User Login",
          statusCode: 401,
          success: false,
        })
      );
    });

    test("masks reset password tokens in recorded endpoint paths", async () => {
      const createSpy = jest.spyOn(AuditLog, "create").mockResolvedValue({});
      jest.spyOn(User, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .post("/api/auth/reset-password/super-secret-reset-token-123")
        .send({ password: "NewSecurePassword123!" });

      await new Promise((resolve) => setImmediate(resolve));

      expect(res.status).toBe(400);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "Reset Password",
          endpoint: "/api/auth/reset-password/[REDACTED]",
        })
      );
    });

    test("records worker scheduler calls as system role and skips health checks", async () => {
      const createSpy = jest.spyOn(AuditLog, "create").mockResolvedValue({});
      jest.spyOn(SystemSetting, "findOne").mockResolvedValue({ value: 30 });
      jest.spyOn(Monitor, "find").mockResolvedValue([]);

      const healthRes = await request(app).get("/api/health/live");
      expect(healthRes.status).toBe(200);
      await new Promise((resolve) => setImmediate(resolve));
      expect(createSpy).not.toHaveBeenCalled();

      const workerRes = await request(app)
        .post("/api/internal/monitor/run")
        .set("x-worker-secret", process.env.PINGPILOT_WORKER_SECRET);
      await new Promise((resolve) => setImmediate(resolve));

      expect(workerRes.status).toBe(200);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
          name: "Worker Scheduler",
          role: "system",
          action: "Run Monitoring Worker Cycle",
          method: "POST",
          endpoint: "/api/internal/monitor/run",
          statusCode: 200,
          success: true,
        })
      );
    });
  });

  describe("GET /api/admin/audit-logs", () => {
    test("rejects non-admin users with 403", async () => {
      jest.spyOn(User, "findById").mockResolvedValue({
        _id: "507f1f77bcf86cd799439022",
        name: "Dev User",
        role: "user",
        email: "dev@example.com",
        isActive: true,
      });

      const res = await request(app)
        .get("/api/admin/audit-logs")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    test("returns paginated and filtered audit logs for admin", async () => {
      jest.spyOn(User, "findById").mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        name: "Admin User",
        role: "admin",
        email: "admin@pingpilot.local",
        isActive: true,
      });

      const mockLogs = [
        {
          _id: "60d0fe4f5311236168a109ca",
          name: "Dev User",
          role: "user",
          action: "Create Monitor",
          method: "POST",
          endpoint: "/api/monitors",
          statusCode: 201,
          success: true,
          responseTime: 42,
        },
      ];

      const limitMock = jest.fn().mockResolvedValue(mockLogs);
      const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
      const sortMock = jest.fn().mockReturnValue({ skip: skipMock });
      const findSpy = jest.spyOn(AuditLog, "find").mockReturnValue({ sort: sortMock });
      const countSpy = jest.spyOn(AuditLog, "countDocuments").mockResolvedValue(1);
      jest.spyOn(AuditLog, "create").mockResolvedValue({});

      const res = await request(app)
        .get("/api/admin/audit-logs?method=post&success=true&search=Monitor&page=1&limit=10")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.logs).toEqual(mockLogs);
      expect(res.body.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        pages: 1,
      });
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          success: true,
          $or: expect.any(Array),
        })
      );
      expect(countSpy).toHaveBeenCalled();
    });
  });
});
