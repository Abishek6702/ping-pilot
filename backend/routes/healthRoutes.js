const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

router.get("/", (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;

  return res.status(isConnected ? 200 : 503).json({
    success: isConnected,
    status: isConnected ? "UP" : "DOWN",
    message: isConnected ? "PingPilot API is running" : "Database unavailable",
    database: isConnected ? "connected" : "disconnected",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

module.exports = router;
