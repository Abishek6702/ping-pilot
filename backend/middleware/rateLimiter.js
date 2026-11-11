const rateLimit = require("express-rate-limit");

/**
 * General API rate limiter
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // max 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests from this IP, please try again after 15 minutes",
  },
  skip: (req) => {
    // Skip internal worker requests from rate limiting
    return req.path.startsWith("/internal/");
  },
});

/**
 * Stricter rate limiter for authentication endpoints
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 login attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many login attempts. Please try again after 15 minutes.",
  },
});

/**
 * Rate limiter for unauthenticated public status page endpoints
 */
const publicStatusLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // max 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many status page requests. Please try again shortly.",
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  publicStatusLimiter,
};

