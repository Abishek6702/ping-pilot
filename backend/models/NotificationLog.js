const mongoose = require("mongoose");

const notificationLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    monitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: true,
      index: true,
    },
    incidentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ["DOWN", "RECOVERED"],
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ["EMAIL"],
      default: "EMAIL",
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    dedupeKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "SENT", "FAILED", "SKIPPED"],
      default: "PENDING",
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    lastError: {
      type: String,
      default: null,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    messageId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

notificationLogSchema.index({ userId: 1, createdAt: -1 });
notificationLogSchema.index({ incidentId: 1, type: 1 });

const NotificationLog =
  mongoose.models.NotificationLog || mongoose.model("NotificationLog", notificationLogSchema);

module.exports = NotificationLog;

