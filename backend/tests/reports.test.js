const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const Incident = require("../models/Incident");
const User = require("../models/User");
const { generateToken } = require("../utils/generateToken");
const { sanitizeCsvCell } = require("../services/reportService");

process.env.JWT_SECRET = "test-secret-key-32-chars-long-pingpilot";
delete process.env.MONGO_URI;
delete process.env.MONGODB_URI;

describe("Phase 4: Reports & Exports (CSV / PDF / Preview)", () => {
  const userId = "507f1f77bcf86cd799439022";
  const otherUserId = "507f1f77bcf86cd799439077";
  const monitorId = "60d0fe4f5311236168a109ca";

  const regularUser = {
    _id: userId,
    name: "Reports User",
    email: "reports@example.com",
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

  test("sanitizeCsvCell prevents formula injection and escapes RFC-4180 delimiters", () => {
    expect(sanitizeCsvCell("=CMD('calc')")).toBe("'=CMD('calc')");
    expect(sanitizeCsvCell("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
    expect(sanitizeCsvCell("-1+1")).toBe("'-1+1");
    expect(sanitizeCsvCell("@HYPERLINK")).toBe("'@HYPERLINK");
    expect(sanitizeCsvCell('Service "Core", v2')).toBe('"Service ""Core"", v2"');
    expect(sanitizeCsvCell(99.95)).toBe("99.95");
  });

  test("validates report type, format, timezone, and monitor ownership", async () => {
    jest.spyOn(Monitor, "find").mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const badType = await request(app)
      .get("/api/reports/preview?type=invalidtype")
      .set("Authorization", `Bearer ${userToken}`);
    expect(badType.status).toBe(400);

    const badTz = await request(app)
      .get("/api/reports/preview?type=summary&timezone=Mars/Phobos")
      .set("Authorization", `Bearer ${userToken}`);
    expect(badTz.status).toBe(400);

    const badFormat = await request(app)
      .get("/api/reports/export?format=xlsx")
      .set("Authorization", `Bearer ${userToken}`);
    expect(badFormat.status).toBe(400);

    jest.spyOn(Monitor, "findById").mockResolvedValue({
      _id: monitorId,
      userId: otherUserId,
      name: "Other Users Service",
    });
    const forbidden = await request(app)
      .get(`/api/reports/preview?monitorId=${monitorId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(forbidden.status).toBe(403);
  });

  test("GET /api/reports/export?format=csv streams CSV attachment with formula escaping", async () => {
    const mObjId = new mongoose.Types.ObjectId(monitorId);
    jest.spyOn(Monitor, "find").mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: mObjId,
          userId,
          name: "=MALICIOUS_FORMULA",
          url: "https://api.example.com",
          method: "GET",
          isActive: true,
          currentStatus: "UP",
          monitoringInterval: 5,
        },
      ]),
    });

    jest.spyOn(PingResult, "aggregate").mockResolvedValue([
      {
        _id: mObjId,
        totalChecks: 10,
        successfulChecks: 10,
        failedChecks: 0,
        avgResponseTime: 120,
        minResponseTime: 100,
        maxResponseTime: 140,
      },
    ]);
    jest.spyOn(Incident, "find").mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app)
      .get("/api/reports/export?type=summary&format=csv&range=7d")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("attachment;");
    expect(res.text).toContain("'=MALICIOUS_FORMULA");
    expect(res.text).toContain("Service Name");
  });

  test("GET /api/reports/export?format=pdf streams valid binary PDF for both populated and empty datasets", async () => {
    jest.spyOn(Monitor, "find").mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app)
      .get("/api/reports/export?type=incidents&format=pdf&range=7d")
      .set("Authorization", `Bearer ${userToken}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain(".pdf");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });
});

