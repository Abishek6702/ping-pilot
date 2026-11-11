const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const { apiLimiter } = require("./middleware/rateLimiter");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { logEvent } = require("./utils/logger");

const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const monitorRoutes = require("./routes/monitorRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const historyRoutes = require("./routes/historyRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const workerRoutes = require("./routes/workerRoutes");
const adminRoutes = require("./routes/adminRoutes");
const testerRoutes = require("./routes/testerRoutes");
const incidentRoutes = require("./routes/incidentRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const statusPageRoutes = require("./routes/statusPageRoutes");
const publicStatusRoutes = require("./routes/publicStatusRoutes");
const reportRoutes = require("./routes/reportRoutes");

const app = express();

// 1. Set Security HTTP Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// 2. Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// 3. CORS configuration
const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4000",
  "http://localhost:4002",
  "http://localhost:5000",
  "http://localhost:8080",
];

const customOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((url) => url.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...customOrigins]));

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/+$/, "");
      if (
        allowedOrigins.includes(normalizedOrigin) ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "x-worker-secret",
    ],
  })
);

// 4. Rate Limiting for public API endpoints
app.use("/api/", apiLimiter);

// 5. Body Parsers and Cookie Parser
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

// 6. Response Compression
app.use(compression());

// 7. Structured operational telemetry for slow or failed API requests
if (process.env.NODE_ENV !== "test") {
  app.use((req, res, next) => {
    const startTime = Date.now();
    res.on("finish", () => {
      const durationMs = Date.now() - startTime;
      if (res.statusCode >= 500 || durationMs >= 2000) {
        logEvent(res.statusCode >= 500 ? "error" : "warn", "http.request", {
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs,
        });
      }
    });
    next();
  });
}

// --- ROUTES ---
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/monitors", monitorRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/internal", workerRoutes);
app.use("/api/tester", testerRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/status-pages", statusPageRoutes);
app.use("/api/public/status", publicStatusRoutes);
app.use("/api/reports", reportRoutes);

// --- ERROR HANDLING ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
