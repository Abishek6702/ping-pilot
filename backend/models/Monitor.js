const mongoose = require("mongoose");
const {
  ALLOWED_MONITORING_INTERVALS,
  DEFAULT_MONITORING_INTERVAL,
} = require("../constants/monitorConstants");

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
    monitoringInterval: {
      type: Number,
      enum: {
        values: ALLOWED_MONITORING_INTERVALS,
        message: "Monitoring interval must be one of: 1, 5, 10, 15, 30, or 60 minutes",
      },
      default: DEFAULT_MONITORING_INTERVAL,
      validate: {
        validator: function (v) {
          return Number.isInteger(v) && ALLOWED_MONITORING_INTERVALS.includes(v);
        },
        message: "Monitoring interval must be 1, 5, 10, 15, 30, or 60 minutes",
      },
    },
    interval: {
      type: Number,
      default: DEFAULT_MONITORING_INTERVAL, // Kept in sync with monitoringInterval for backward compatibility
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
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
    nextCheckAt: {
      type: Date,
      default: null,
      index: true,
    },
    claimOwner: {
      type: String,
      default: null,
    },
    claimExpiresAt: {
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
monitorSchema.index({ isActive: 1, nextCheckAt: 1, claimExpiresAt: 1 });

monitorSchema.pre("validate", function () {
  if (this.monitoringInterval === undefined || this.monitoringInterval === null) {
    if (this.interval !== undefined && this.interval !== null) {
      this.monitoringInterval = this.interval;
    } else {
      this.monitoringInterval = DEFAULT_MONITORING_INTERVAL;
    }
  } else if (this.isModified("interval") && !this.isModified("monitoringInterval")) {
    this.monitoringInterval = this.interval;
  }

  const parsed = Number(this.monitoringInterval);
  if (Number.isInteger(parsed) && ALLOWED_MONITORING_INTERVALS.includes(parsed)) {
    this.monitoringInterval = parsed;
    this.interval = parsed;
  }
});

const Monitor = mongoose.models.Monitor || mongoose.model("Monitor", monitorSchema);

module.exports = Monitor;

