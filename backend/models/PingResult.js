const mongoose = require("mongoose");

const pingResultSchema = new mongoose.Schema(
  {
    monitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: [true, "Monitor ID is required"],
      index: true,
    },
    status: {
      type: String,
      enum: ["UP", "DOWN"],
      required: true,
      index: true,
    },
    statusCode: {
      type: Number,
      default: null,
    },
    responseTime: {
      type: Number,
      required: true, // in milliseconds
    },
    errorMessage: {
      type: String,
      default: null,
    },
    checkedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

pingResultSchema.index({ monitorId: 1, checkedAt: -1 });
pingResultSchema.index({ checkedAt: -1 });

const PingResult = mongoose.models.PingResult || mongoose.model("PingResult", pingResultSchema);

module.exports = PingResult;

