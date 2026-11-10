const dns = require("dns");

/**
 * Validates and normalizes environment variables for PingPilot backend
 */
function validateEnv() {
  // Support variations in key naming (e.g. trailing space or alternate names)
  if (!process.env.JWT_SECRET && process.env["JWT_SECRET "]) {
    process.env.JWT_SECRET = process.env["JWT_SECRET "].trim();
  }
  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable is missing in production");
    }
    process.env.JWT_SECRET = "pingpilot-development-secret-key-replace-in-production-32chars";
    console.warn("⚠️ Warning: JWT_SECRET not set, using development fallback.");
  }

  if (!process.env.MONGODB_URI && process.env.MONGO_URI) {
    process.env.MONGODB_URI = process.env.MONGO_URI;
  }

  if (!process.env.ADMIN_EMAIL) {
    process.env.ADMIN_EMAIL = process.env.EMAIL ;
  }

  if (!process.env.PINGPILOT_WORKER_SECRET) {
    process.env.PINGPILOT_WORKER_SECRET =
      process.env.WORKER_SECRET || "pingpilot-worker-secret-internal-key-64";
  }

  if (!process.env.PORT) {
    process.env.PORT = "4001";
  }

  if (!process.env.JWT_EXPIRES_IN) {
    process.env.JWT_EXPIRES_IN = "7d";
  }

  if (!process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL = "http://localhost:4000";
  }

  // Default public registration to true so external users and Google OAuth can sign up
  if (process.env.ALLOW_PUBLIC_REGISTRATION === undefined) {
    process.env.ALLOW_PUBLIC_REGISTRATION = "true";
  }

  // Configure reliable DNS servers fallback for MongoDB SRV lookups
  try {
    dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
  } catch (err) {
    // Ignore if environment restricts changing dns servers
  }
}

module.exports = validateEnv;
