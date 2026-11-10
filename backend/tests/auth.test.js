const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const { generateToken } = require("../utils/generateToken");

process.env.JWT_SECRET = "test-secret-key-32-chars-long-pingpilot";
process.env.ADMIN_EMAIL = "admin@pingpilot.local";
process.env.PINGPILOT_WORKER_SECRET = "test-worker-secret-12345";

describe("Authentication & Authorization System", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Token Generation Utility", () => {
    test("generates and verifies a valid signed JWT", () => {
      const payload = { id: "507f1f77bcf86cd799439011", role: "admin", email: "admin@pingpilot.local" };
      const token = generateToken(payload);
      expect(typeof token).toBe("string");

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.id).toBe(payload.id);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.email).toBe(payload.email);
    });
  });

  describe("POST /api/auth/login", () => {
    test("rejects login if email is not the configured admin email", async () => {
      jest.spyOn(User, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "intruder@evil.com", password: "Password123!" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Invalid email or password");
    });

    test("rejects login with missing credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("rejects login when password does not match", async () => {
      jest.spyOn(User, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: "507f1f77bcf86cd799439011",
          email: "admin@pingpilot.local",
          isActive: true,
          comparePassword: jest.fn().mockResolvedValue(false),
        }),
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "admin@pingpilot.local", password: "WrongPassword!" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Invalid email or password");
    });

    test("succeeds with correct credentials and returns JWT session", async () => {
      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        name: "Admin",
        email: "admin@pingpilot.local",
        role: "admin",
        isActive: true,
        authProviders: ["local"],
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "admin@pingpilot.local", password: "CorrectPassword123!" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe("admin@pingpilot.local");
      // Verify cookie is set
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain("pingpilot_token=");
      expect(cookies[0]).toContain("HttpOnly");
    });
  });

  describe("GET /api/auth/me", () => {
    test("rejects unauthorized access when no token is provided", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Not authorized");
    });

    test("returns user profile when a valid token is provided", async () => {
      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        name: "Admin",
        email: "admin@pingpilot.local",
        role: "admin",
        isActive: true,
        authProviders: ["local"],
      };

      jest.spyOn(User, "findById").mockResolvedValue(mockUser);

      const token = generateToken({ id: mockUser._id, role: mockUser.role, email: mockUser.email });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe("admin@pingpilot.local");
    });
  });

  describe("POST /api/auth/logout", () => {
    test("clears session cookie", async () => {
      const res = await request(app).post("/api/auth/logout");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Password Reset & Change Workflows", () => {
    test("rejects forgot-password for Google-only accounts", async () => {
      jest.spyOn(User, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: "507f1f77bcf86cd799439033",
          email: "googleuser@gmail.com",
          authProviders: ["google"],
        }),
      });

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "googleuser@gmail.com" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Google Sign-In");
    });

    test("allows forgot-password for local auth accounts", async () => {
      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        name: "Admin",
        email: "admin@pingpilot.local",
        authProviders: ["local"],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "admin@pingpilot.local" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("sent to your email");
    });

    test("allows authenticated change-password for both admin and users", async () => {
      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        email: "admin@pingpilot.local",
        role: "admin",
        isActive: true,
        password: "OldHashedPassword",
        authProviders: ["local"],
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, "findById").mockImplementation((id) => ({
        select: jest.fn().mockResolvedValue(mockUser),
        _id: id,
        role: "admin",
        isActive: true,
      }));

      const token = generateToken({ id: mockUser._id, role: mockUser.role, email: mockUser.email });

      const res = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          currentPassword: "OldPassword123!",
          newPassword: "NewSuperPassword123!",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("Password changed successfully");
    });
  });
});

