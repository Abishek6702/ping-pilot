const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

const validateEnv = require("./config/validateEnv");
validateEnv();

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const app = require("./app");
const { bootstrapAdmin } = require("./services/bootstrapAdmin");
const { startRecurringWorker } = require("./services/recurringService");

const PORT = process.env.PORT || 5000;
let server;
let stopRecurringWorker;
let isShuttingDown = false;

async function start() {
  try {
    await connectDB();
    await bootstrapAdmin();

    stopRecurringWorker = startRecurringWorker({ logger: console });

    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 PingPilot Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup error:", error.message || error);
    process.exit(1);
  }
}

async function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("Shutting down PingPilot server...");
  stopRecurringWorker?.();

  // Safety timeout to guarantee process exit if connections hang
  const forceExitTimer = setTimeout(() => {
    console.error("Forced exit after shutdown timeout");
    process.exit(exitCode || 1);
  }, 10000);
  forceExitTimer.unref();

  try {
    if (server) {
      await new Promise((resolve) => {
        server.close(() => {
          console.log("Server closed.");
          resolve();
        });
      });
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("MongoDB connection closed.");
    }
  } catch (err) {
    console.error("Error during shutdown:", err.message || err);
    process.exit(1);
  }

  clearTimeout(forceExitTimer);
  process.exit(exitCode);
}

void start();

// Handle unhandled promise rejections globally
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err?.message || err);
  void shutdown(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err?.message || err);
  void shutdown(1);
});

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
