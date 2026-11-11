const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

function buildHealthPayload() {
  const isConnected = mongoose.connection.readyState === 1;
  return {
    success: isConnected,
    status: isConnected ? "UP" : "DOWN",
    message: isConnected ? "PingPilot API is running" : "Database unavailable",
    database: isConnected ? "connected" : "disconnected",
    readyState: mongoose.connection.readyState,
    uptime: Math.floor(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    timestamp: new Date().toISOString(),
    version: "1.1.0",
  };
}

router.get("/", (req, res) => {
  const payload = buildHealthPayload();
  return res.status(payload.success ? 200 : 503).json(payload);
});

router.get("/live", (req, res) => {
  return res.status(200).json({
    success: true,
    status: "LIVE",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

router.get("/ready", (req, res) => {
  const payload = buildHealthPayload();
  return res.status(payload.success ? 200 : 503).json({
    ...payload,
    ready: payload.success,
  });
});

module.exports = router;
