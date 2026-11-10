const request = require("supertest");
const app = require("../app");
const { generateToken } = require("../utils/generateToken");
const User = require("../models/User");

describe("API Tester Endpoint: POST /api/tester/run", () => {
  let authToken;

  beforeAll(() => {
    authToken = generateToken({
      id: "507f1f77bcf86cd799439011",
      email: "user@example.com",
      role: "user",
    });

    jest.spyOn(User, "findById").mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      name: "Test User",
      email: "user@example.com",
      role: "user",
      isActive: true,
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app)
      .post("/api/tester/run")
      .send({ url: "https://example.com", method: "GET" });

    expect(res.status).toBe(401);
  });

  it("rejects request if URL is missing", async () => {
    const res = await request(app)
      .post("/api/tester/run")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ method: "GET" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("URL is required");
  });

  it("rejects SSRF cloud metadata endpoints", async () => {
    const res = await request(app)
      .post("/api/tester/run")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ url: "http://169.254.169.254/latest/meta-data/", method: "GET" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("SSRF Blocked");
  });

  it("rejects invalid HTTP method", async () => {
    const res = await request(app)
      .post("/api/tester/run")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ url: "https://example.com", method: "INVALID_METHOD" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid HTTP method");
  });

  it("successfully tests a single method when mocked", async () => {
    const mockFetch = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      text: jest.fn().mockResolvedValueOnce(JSON.stringify({ status: "alive" })),
    });

    const res = await request(app)
      .post("/api/tester/run")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        url: "https://example.com/api/test",
        method: "GET",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mode).toBe("single");
    expect(res.body.result).toHaveProperty("status", 200);
    expect(res.body.result).toHaveProperty("responseTime");
    expect(res.body.result).toHaveProperty("isJson", true);

    mockFetch.mockRestore();
  });

  it("successfully executes ALL methods scan", async () => {
    const mockFetch = jest.spyOn(global, "fetch").mockImplementation((_url, opts) => {
      const method = opts?.method || "GET";
      const status = method === "GET" ? 200 : method === "POST" ? 201 : 405;
      return Promise.resolve({
        status,
        statusText: status === 200 ? "OK" : status === 201 ? "Created" : "Method Not Allowed",
        headers: new Headers({ "content-type": "application/json" }),
        text: jest.fn().mockResolvedValueOnce(JSON.stringify({ method })),
      });
    });

    const res = await request(app)
      .post("/api/tester/run")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        url: "https://example.com/api/test",
        method: "ALL",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mode).toBe("all");
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBe(7); // GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
    expect(res.body.results.some((r) => r.method === "GET" && r.status === 200)).toBe(true);

    mockFetch.mockRestore();
  });
});

