const mongoose = require("mongoose");

const INCIDENT_STATUSES = [
  "Detected",
  "Investigating",
  "Identified",
  "Monitoring",
  "Resolved",
];

const timelineEntrySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: INCIDENT_STATUSES,
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    actorType: {
      type: String,
      enum: ["system", "user"],
      default: "system",
    },
    actorName: {
      type: String,
      default: "PingPilot Engine",
      trim: true,
      maxlength: 100,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const incidentSchema = new mongoose.Schema(
  {
    incidentKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    monitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: [true, "Monitor ID is required"],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Incident title is required"],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: INCIDENT_STATUSES,
      default: "Detected",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    downtimeDurationMs: {
      type: Number,
      default: null,
      min: 0,
    },
    affectedPingIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "PingResult",
        },
      ],
      default: [],
    },
    affectedChecksCount: {
      type: Number,
      default: 1,
      min: 0,
    },
    resolutionNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    timeline: {
      type: [timelineEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate active incidents for the same monitor even under concurrent checks
incidentSchema.index(
  { monitorId: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: "unique_active_incident_per_monitor",
  }
);

incidentSchema.index({ userId: 1, startedAt: -1 });
incidentSchema.index({ userId: 1, isActive: 1, startedAt: -1 });
incidentSchema.index({ monitorId: 1, startedAt: -1 });

const Incident = mongoose.models.Incident || mongoose.model("Incident", incidentSchema);
Incident.INCIDENT_STATUSES = INCIDENT_STATUSES;

module.exports = Incident;

