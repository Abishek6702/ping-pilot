const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { COOKIE_NAME } = require("../utils/generateToken");

/**
 * Protect routes: verify JWT from cookies or Authorization header
 */
async function protect(req, res, next) {
  try {
    let token;

    // 1. Check cookies first
    if (req.cookies && req.cookies[COOKIE_NAME]) {
      token = req.cookies[COOKIE_NAME];
    }
    // 2. Fallback to Bearer token in headers
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Not authorized, no token provided",
      });
    }

    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.id || decoded._id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User belonging to this token no longer exists",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: "Account is deactivated",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "Token has expired. Please log in again.",
        code: "TOKEN_EXPIRED",
      });
    }
    return res.status(401).json({
      success: false,
      error: "Not authorized, invalid token",
    });
  }
}

/**
 * Require admin role
 */
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "Access forbidden: admin privileges required",
    });
  }
  next();
}

/**
 * Authenticate internal worker requests via PINGPILOT_WORKER_SECRET
 */
function workerAuth(req, res, next) {
  const configuredSecret = process.env.PINGPILOT_WORKER_SECRET;
  if (!configuredSecret) {
    return res.status(500).json({
      success: false,
      error: "Worker secret is not configured on the server",
    });
  }

  // Check custom header or Bearer header
  const headerSecret =
    req.headers["x-worker-secret"] ||
    (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (!headerSecret || headerSecret !== configuredSecret) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid or missing worker authentication secret",
    });
  }

  next();
}

module.exports = {
  protect,
  adminOnly,
  workerAuth,
};

