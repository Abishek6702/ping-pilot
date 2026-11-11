const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const Monitor = require("../models/Monitor");
const User = require("../models/User");
const NotificationLog = require("../models/NotificationLog");
const { generateToken } = require("../utils/generateToken");
const { validateUrlForMonitoring } = require("../utils/ssrfFilter");
const renderTemplate = require("../utils/renderTemplate");
const {
  sendMailWithRetry,
  dispatchIncidentNotification,
} = require("../services/notificationService");
const sendMail = require("../utils/sendMail");

jest.mock("../utils/sendMail", () => jest.fn());

process.env.JWT_SECRET = "test-secret-key-32-chars-long-pingpilot";
process.env.ADMIN_EMAIL = "admin@pingpilot.local";
delete process.env.MONGO_URI;
delete process.env.MONGODB_URI;

describe("Phase 5: Security Hardening, Notifications & Health Readiness", () => {
  const userId = "507f1f77bcf86cd799439022";
  const monitorId = "60d0fe4f5311236168a109ca";
  const regularUser = {
    _id: userId,
    name: "Regular User",
    email: "user@example.com",
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
    jest.spyOn(User, "findById").mockResolvedValue(regularUser);
  });

  describe("Ownership IDOR & Admin Guards", () => {
    test("denies regular users from reading or updating legacy monitors with null userId", async () => {
      jest.spyOn(Monitor, "findById").mockResolvedValue({
        _id: monitorId,
        userId: null,
        name: "System Monitor",
      });

      const monRes = await request(app)
        .get(`/api/monitors/${monitorId}`)
        .set("Authorization", `Bearer ${userToken}`);
      expect(monRes.status).toBe(403);

      const histRes = await request(app)
        .get(`/api/monitors/${monitorId}/history`)
        .set("Authorization", `Bearer ${userToken}`);
      expect(histRes.status).toBe(403);
    });
  });

  describe("SSRF Hardening (IPv6 Brackets, Credentials & Redirects)", () => {
    const originalFetch = global.fetch;
    afterEach(() => {
      global.fetch = originalFetch;
    });

    test("blocks bracketed IPv6 loopback and embedded URL credentials", async () => {
      const ipv6Res = await validateUrlForMonitoring("http://[::1]:8080/health");
      expect(ipv6Res.valid).toBe(false);

      const credRes = await validateUrlForMonitoring("https://admin:secret@8.8.8.8/api");
      expect(credRes.valid).toBe(false);
    });

    test("API tester blocks 302 redirect targeting internal metadata / localhost", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 302,
        headers: new Map([["location", "http://127.0.0.1/latest/meta-data/"]]),
        body: { cancel: jest.fn().mockResolvedValue(undefined) },
      });

      const res = await request(app)
        .post("/api/tester/run")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ url: "https://8.8.8.8/redirect-trap", method: "GET" });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Redirect SSRF Blocked");
    });
  });

  describe("Notification Retries, Deduplication & XSS Escaping", () => {
    test("HTML-escapes untrusted monitor names and errors in alert templates", () => {
      const html = renderTemplate("serviceDown", {
        serviceName: '<script>alert("xss")</script>',
        url: "https://example.com",
        failureCount: 3,
        errorMessage: '<img src=x onerror="steal()">',
        time: "Wed, 11 Nov 2026 10:00:00 GMT",
        incidentKey: "INC-1",
      });

      expect(html).not.toContain("<script>");
      expect(html).not.toContain("<img src=x");
      expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    });

    test("sendMailWithRetry retries transient failures and succeeds on 3rd attempt", async () => {
      const op = jest
        .fn()
        .mockRejectedValueOnce(new Error("SMTP ETIMEDOUT"))
        .mockRejectedValueOnce(new Error("SMTP ECONNRESET"))
        .mockResolvedValueOnce({ messageId: "msg-123" });

      const result = await sendMailWithRetry(op, {
        maxAttempts: 3,
        baseDelayMs: 0,
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(result.result.messageId).toBe("msg-123");
    });

    test("dispatchIncidentNotification deduplicates same incident+type via NotificationLog", async () => {
      jest.spyOn(NotificationLog, "findOneAndUpdate").mockResolvedValueOnce({
        _id: "existing-log",
        status: "SENT",
      });

      const outcome = await dispatchIncidentNotification({
        type: "DOWN",
        incident: { _id: "60d0fe4f5311236168a10aa1", incidentKey: "INC-1" },
        monitor: { _id: monitorId, name: "API", url: "https://8.8.8.8", userId },
        user: regularUser,
      });

      expect(outcome.skipped).toBe(true);
      expect(sendMail).not.toHaveBeenCalled();
    });

    test("dispatchIncidentNotification logs error safely when SMTP delivery fails", async () => {
      jest.spyOn(NotificationLog, "findOneAndUpdate").mockResolvedValueOnce(null);
      jest.spyOn(NotificationLog, "findOne").mockResolvedValueOnce({ _id: "log-1" });
      const updateSpy = jest
        .spyOn(NotificationLog, "updateOne")
        .mockResolvedValue({ modifiedCount: 1 });
      sendMail.mockRejectedValue(new Error("Relay denied"));

      const outcome = await dispatchIncidentNotification({
        type: "DOWN",
        incident: { _id: "60d0fe4f5311236168a10aa2", incidentKey: "INC-2" },
        monitor: { _id: monitorId, name: "API", url: "https://8.8.8.8", userId },
        user: regularUser,
        maxAttempts: 2,
        baseDelayMs: 0,
      });

      expect(outcome.success).toBe(false);
      expect(outcome.attempts).toBe(2);
      expect(updateSpy).toHaveBeenCalledWith(
        { _id: "log-1" },
        expect.objectContaining({
          $set: expect.objectContaining({ status: "FAILED", lastError: "Relay denied" }),
        })
      );
    });
  });

  describe("Health & Readiness Probes", () => {
    test("GET /api/health/live returns 200 and /ready reports 503 when disconnected", async () => {
      const liveRes = await request(app).get("/api/health/live");
      expect(liveRes.status).toBe(200);
      expect(liveRes.body.success).toBe(true);
      expect(liveRes.body.status).toBe("LIVE");

      const readyRes = await request(app).get("/api/health/ready");
      expect(readyRes.status).toBe(503);
      expect(readyRes.body.ready).toBe(false);
      expect(readyRes.body.database).toBe("disconnected");
    });
  });
});

