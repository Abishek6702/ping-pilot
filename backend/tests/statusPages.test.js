const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const StatusPage = require("../models/StatusPage");
const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const Incident = require("../models/Incident");
const User = require("../models/User");
const { generateToken } = require("../utils/generateToken");
const { clearPublicStatusCache } = require("../controllers/statusPageController");

process.env.JWT_SECRET = "test-secret-key-32-chars-long-pingpilot";
delete process.env.MONGO_URI;
delete process.env.MONGODB_URI;

describe("Phase 3: Public Status Pages API", () => {
  const userId = "507f1f77bcf86cd799439022";
  const otherUserId = "507f1f77bcf86cd799439088";
  const monitorId = "60d0fe4f5311236168a109ca";

  const regularUser = {
    _id: userId,
    name: "Status Owner",
    email: "owner@example.com",
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
    clearPublicStatusCache();
    jest.spyOn(User, "findById").mockResolvedValue(regularUser);
  });

  describe("Authenticated Status Page Management", () => {
    test("rejects reserved slugs, invalid logo protocols, and cross-user monitors", async () => {
      const reservedRes = await request(app)
        .post("/api/status-pages")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ name: "Admin", slug: "admin" });
      expect(reservedRes.status).toBe(400);

      const xssLogoRes = await request(app)
        .post("/api/status-pages")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          name: "My Status",
          slug: "my-status-page",
          logoUrl: "javascript:alert(1)",
        });
      expect(xssLogoRes.status).toBe(400);

      jest.spyOn(Monitor, "find").mockResolvedValue([
        { _id: monitorId, userId: otherUserId, name: "Stolen Monitor" },
      ]);

      const idorRes = await request(app)
        .post("/api/status-pages")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          name: "My Status",
          slug: "my-status-page",
          monitorIds: [monitorId],
        });
      expect(idorRes.status).toBe(403);
    });

    test("returns 409 Conflict when slug already exists", async () => {
      jest.spyOn(Monitor, "find").mockResolvedValue([]);
      jest.spyOn(StatusPage, "findOne").mockResolvedValue({ _id: "existing", slug: "acme-api" });

      const res = await request(app)
        .post("/api/status-pages")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ name: "Acme", slug: "acme-api", monitorIds: [] });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("already exists");
    });

    test("creates valid status page with showUrls defaulting to false", async () => {
      jest.spyOn(Monitor, "find").mockResolvedValue([
        { _id: monitorId, userId, name: "Gateway", url: "https://internal.example.com" },
      ]);
      jest.spyOn(StatusPage, "findOne").mockResolvedValue(null);
      const createSpy = jest.spyOn(StatusPage, "create").mockResolvedValue({
        _id: "60d0fe4f5311236168a10bb1",
        userId,
        name: "Acme Cloud Status",
        slug: "acme-cloud",
        showUrls: false,
        isPublic: true,
      });

      const res = await request(app)
        .post("/api/status-pages")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          name: "Acme Cloud Status",
          slug: "acme-cloud",
          monitorIds: [monitorId],
        });

      expect(res.status).toBe(201);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(String),
          slug: "acme-cloud",
          showUrls: false,
          isPublic: true,
        })
      );
    });
  });

  describe("Unauthenticated Public Endpoint Privacy & Sanitization", () => {
    test("returns 404 when status page is missing or private", async () => {
      jest.spyOn(StatusPage, "findOne").mockResolvedValue(null);
      const res = await request(app).get("/api/public/status/hidden-internal-page");
      expect(res.status).toBe(404);
    });

    test("strips private monitor URLs when showUrls=false and includes zero owner secrets", async () => {
      const monObjId = new mongoose.Types.ObjectId(monitorId);
      jest.spyOn(StatusPage, "findOne").mockResolvedValue({
        _id: "60d0fe4f5311236168a10bb1",
        userId,
        name: "Acme Status",
        slug: "acme-status",
        description: "Production infrastructure",
        accentColor: "#0E7A88",
        isPublic: true,
        showUrls: false,
        showIncidents: true,
        monitorIds: [monObjId],
      });

      jest.spyOn(Monitor, "find").mockReturnValue({
        select: jest.fn().mockResolvedValue([
          {
            _id: monObjId,
            userId,
            name: "Core API",
            url: "https://secret-internal-origin.example.com/health?token=abc",
            currentStatus: "UP",
            isActive: true,
            lastCheckedAt: new Date(),
            lastResponseTime: 112,
          },
        ]),
      });

      jest
        .spyOn(PingResult, "aggregate")
        .mockResolvedValueOnce([
          { _id: monObjId, totalChecks: 50, successfulChecks: 50, avgResponseTime: 110 },
        ])
        .mockResolvedValueOnce([
          { _id: { monitorId: monObjId, day: "2026-11-11" }, total: 50, up: 50 },
        ]);

      jest.spyOn(Incident, "find").mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      const res = await request(app).get("/api/public/status/acme-status");

      expect(res.status).toBe(200);
      expect(res.body.data.overallStatus).toBe("operational");
      expect(res.body.data.userId).toBeUndefined();
      expect(res.body.data.services).toHaveLength(1);
      expect(res.body.data.services[0].name).toBe("Core API");
      expect(res.body.data.services[0].url).toBeUndefined();
      expect(res.body.data.services[0].dailyBars).toHaveLength(1);
    });
  });
});

