const mongoose = require("mongoose");

const monitorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Monitor name is required"],
      trim: true,
      maxlength: [100, "Monitor name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    url: {
      type: String,
      required: [true, "Monitor URL is required"],
      trim: true,
    },
    method: {
      type: String,
      enum: ["GET"],
      default: "GET",
      uppercase: true,
    },
    interval: {
      type: Number,
      default: 5, // minutes
      min: [1, "Interval must be at least 1 minute"],
    },
    timeout: {
      type: Number,
      default: 15, // seconds
      min: [1, "Timeout must be at least 1 second"],
      max: [60, "Timeout cannot exceed 60 seconds"],
    },
    expectedStatusCodes: {
      type: [Number],
      default: [200],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0 && v.every((code) => code >= 100 && code <= 599);
        },
        message: "Expected status codes must be an array of valid HTTP status codes (100-599)",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    currentStatus: {
      type: String,
      enum: ["UP", "DOWN", "PAUSED", "UNKNOWN"],
      default: "UNKNOWN",
      index: true,
    },
    lastCheckedAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastResponseTime: {
      type: Number,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
    consecutiveFailures: {
      type: Number,
      default: 0,
    },
    consecutiveSuccesses: {
      type: Number,
      default: 0,
    },
    failureThreshold: {
      type: Number,
      default: 2,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

monitorSchema.index({ isActive: 1, currentStatus: 1 });

const Monitor = mongoose.models.Monitor || mongoose.model("Monitor", monitorSchema);

module.exports = Monitor;

