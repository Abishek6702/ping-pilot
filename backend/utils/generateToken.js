const jwt = require("jsonwebtoken");

const COOKIE_NAME = "pingpilot_token";

/**
 * Generate a signed JWT for a user
 */
function generateToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Get cookie options tailored to current environment
 */
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  };

  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  return options;
}

/**
 * Set the authentication cookie on the response
 */
function setTokenCookie(res, token) {
  res.cookie(COOKIE_NAME, token, getCookieOptions());
}

/**
 * Clear the authentication cookie
 */
function clearTokenCookie(res) {
  const isProduction = process.env.NODE_ENV === "production";
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  };
  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }
  res.clearCookie(COOKIE_NAME, options);
}

module.exports = {
  COOKIE_NAME,
  generateToken,
  getCookieOptions,
  setTokenCookie,
  clearTokenCookie,
};

