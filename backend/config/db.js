const path = require("path");
const dns = require("dns");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

if (process.env.NODE_ENV !== "test") {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
}

try {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
} catch (e) {
  // If restricted, fallback to default resolver
}

let listenersRegistered = false;

const connectDB = async () => {
  const isTest = process.env.NODE_ENV === "test";
  const uri = isTest
    ? process.env.TEST_MONGODB_URI
    : process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    throw new Error(
      isTest
        ? "TEST_MONGODB_URI must be defined when connecting to MongoDB in test environment"
        : "MONGODB_URI (or MONGO_URI) is not defined in environment variables"
    );
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!listenersRegistered) {
    listenersRegistered = true;
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err.message || err);
    });
    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected");
    });
  }

  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log(`✅ MongoDB Connected Successfully: ${conn.connection.host}`);
  return conn.connection;
};

module.exports = connectDB;
