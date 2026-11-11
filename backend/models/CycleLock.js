const mongoose = require("mongoose");

const cycleLockSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    owner: {
      type: String,
      required: true,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    acquiredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

const CycleLock = mongoose.models.CycleLock || mongoose.model("CycleLock", cycleLockSchema);

module.exports = CycleLock;

