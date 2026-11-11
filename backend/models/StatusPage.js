const mongoose = require("mongoose");

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const RESERVED_SLUGS = new Set([
  "api",
  "admin",
  "dashboard",
  "monitors",
  "history",
  "tester",
  "incidents",
  "analytics",
  "reports",
  "status-pages",
  "settings",
  "login",
  "register",
  "public",
  "health",
]);

const statusPageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner user ID is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Status page name is required"],
      trim: true,
      maxlength: [120, "Status page name cannot exceed 120 characters"],
    },
    slug: {
      type: String,
      required: [true, "Status page slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, "Slug must be at least 3 characters"],
      maxlength: [60, "Slug cannot exceed 60 characters"],
      match: [SLUG_REGEX, "Slug must use lowercase letters, numbers, and single hyphens"],
      index: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    logoUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Logo URL cannot exceed 500 characters"],
    },
    accentColor: {
      type: String,
      default: "#0E7A88",
      trim: true,
      match: [HEX_COLOR_REGEX, "Accent color must be a valid 6-digit hex color"],
    },
    isPublic: {
      type: Boolean,
      default: true,
      index: true,
    },
    showUrls: {
      type: Boolean,
      default: false,
    },
    showIncidents: {
      type: Boolean,
      default: true,
    },
    monitorIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Monitor",
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const StatusPage =
  mongoose.models.StatusPage || mongoose.model("StatusPage", statusPageSchema);

StatusPage.SLUG_REGEX = SLUG_REGEX;
StatusPage.HEX_COLOR_REGEX = HEX_COLOR_REGEX;
StatusPage.RESERVED_SLUGS = RESERVED_SLUGS;

module.exports = StatusPage;

