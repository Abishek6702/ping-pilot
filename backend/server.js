const dotenv = require("dotenv");

// Load env vars before requiring anything else
dotenv.config();

const validateEnv = require("./config/validateEnv");
validateEnv();

const connectDB = require("./config/db");
const app = require("./app");
const { bootstrapAdmin } = require("./services/bootstrapAdmin");
const { startRecurringWorker } = require("./services/recurringService");

const PORT = process.env.PORT || 5000;
let server;
let stopRecurringWorker;

async function start() {
  try {
    await connectDB();
    await bootstrapAdmin();

    stopRecurringWorker = startRecurringWorker({ logger: console });

    server = app.listen(PORT, () => {
      console.log(`🚀 PingPilot Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup error:", error.message || error);
    process.exit(1);
  }
}

function shutdown() {
  console.log("Shutting down PingPilot server...");
  stopRecurringWorker?.();
  if (server) {
    server.close(() => {
      console.log("Server closed.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

void start();

// Handle unhandled promise rejections globally
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err.message || err);
  stopRecurringWorker?.();
  if (server) server.close(() => process.exit(1));
  else process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message || err);
  stopRecurringWorker?.();
  if (server) server.close(() => process.exit(1));
  else process.exit(1);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
