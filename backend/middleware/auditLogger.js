const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const { logEvent } = require("../utils/logger");

const OBJECT_ID_SEGMENT = /^[a-f0-9]{24}$/i;

const ACTION_MAP = {
  "POST /api/auth/login": "User Login",
  "POST /api/auth/register": "User Registration",
  "POST /api/auth/google": "Google OAuth Login",
  "POST /api/auth/logout": "User Logout",
  "GET /api/auth/me": "Verify Session",
  "POST /api/auth/forgot-password": "Request Password Reset",
  "POST /api/auth/reset-password/:token": "Reset Password",
  "POST /api/auth/change-password": "Change Password",
  "GET /api/dashboard": "View Dashboard",
  "GET /api/monitors": "List Monitors",
  "POST /api/monitors": "Create Monitor",
  "GET /api/monitors/:id": "View Monitor Details",
  "PATCH /api/monitors/:id": "Update Monitor",
  "DELETE /api/monitors/:id": "Delete Monitor",
  "PATCH /api/monitors/:id/toggle": "Toggle Monitor Status",
  "POST /api/monitors/:id/ping": "Manual Monitor Ping",
  "GET /api/monitors/:id/history": "View Monitor History",
  "GET /api/monitors/:id/stats": "View Monitor Stats",
  "GET /api/history": "View Monitoring History",
  "GET /api/settings": "View System Settings",
  "PATCH /api/settings": "Update System Settings",
  "POST /api/tester/run": "Run API Endpoint Test",
  "GET /api/admin/overview": "View Admin Overview",
  "GET /api/admin/users": "List Platform Users",
  "PATCH /api/admin/users/:id/toggle": "Toggle User Status",
  "GET /api/admin/monitors": "List All Platform Monitors",
  "GET /api/admin/audit-logs": "View Audit Logs",
  "POST /api/internal/monitor/run": "Run Monitoring Worker Cycle",
};

function canUseAuditDb() {
  if (mongoose.connection.readyState === 1) {
    return true;
  }
  return Boolean(AuditLog.create && AuditLog.create._isMockFunction);
}

function sanitizeEndpoint(originalUrl) {
  const rawPath = String(originalUrl || "/").split("?")[0] || "/";
  return rawPath.replace(/^(\/api\/auth\/reset-password\/).+$/, "$1[REDACTED]");
}

function normalizePatternPath(sanitizedPath) {
  if (sanitizedPath.startsWith("/api/auth/reset-password/")) {
    return "/api/auth/reset-password/:token";
  }

  return sanitizedPath
    .split("/")
    .map((segment) => (OBJECT_ID_SEGMENT.test(segment) ? ":id" : segment))
    .join("/");
}

function resolveAuditAction(method, sanitizedEndpoint, customAction) {
  if (customAction) return customAction;
  const patternKey = `${method} ${normalizePatternPath(sanitizedEndpoint)}`;
  return ACTION_MAP[patternKey] || `${method} ${sanitizedEndpoint}`;
}

function extractClientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || undefined;
}

function extractActor(req, res) {
  const actor = res.locals?.auditUser || req.user;
  if (actor) {
    return {
      userId: actor._id || actor.id || null,
      name: actor.name || "User",
      role: actor.role || "user",
    };
  }

  if (req.isWorker) {
    return {
      userId: null,
      name: "Worker Scheduler",
      role: "system",
    };
  }

  return {
    userId: null,
    name: "Anonymous",
    role: "Guest",
  };
}

function shouldAuditRequest(req, endpoint) {
  if (req.method === "OPTIONS") return false;
  if (!endpoint.startsWith("/api/")) return false;
  if (endpoint === "/api/health" || endpoint.startsWith("/api/health/")) return false;
  return true;
}

/**
 * Express middleware that records API requests into the AuditLog collection once the response finishes.
 */
function auditLogger(req, res, next) {
  const endpoint = sanitizeEndpoint(req.originalUrl || req.url);
  if (!shouldAuditRequest(req, endpoint)) {
    return next();
  }

  const startMs = Date.now();

  res.on("finish", () => {
    if (!canUseAuditDb()) return;

    const statusCode = res.statusCode || 500;
    const method = (req.method || "GET").toUpperCase();
    const actor = extractActor(req, res);
    const userAgentHeader = req.headers?.["user-agent"];

    const entry = {
      userId: actor.userId,
      name: actor.name,
      role: actor.role,
      action: resolveAuditAction(method, endpoint, res.locals?.auditAction),
      method,
      endpoint,
      statusCode,
      success: statusCode >= 200 && statusCode < 400,
      ipAddress: extractClientIp(req),
      userAgent: typeof userAgentHeader === "string" ? userAgentHeader.slice(0, 512) : undefined,
      responseTime: Math.max(0, Date.now() - startMs),
    };

    Promise.resolve(AuditLog.create(entry)).catch((err) => {
      logEvent("warn", "audit.log_write_failed", {
        endpoint,
        method,
        error: err.message,
      });
    });
  });

  return next();
}

module.exports = {
  auditLogger,
  sanitizeEndpoint,
  resolveAuditAction,
  extractClientIp,
};

