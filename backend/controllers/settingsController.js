const SystemSetting = require("../models/SystemSetting");
const User = require("../models/User");

/**
 * Get general settings and admin account info
 * GET /api/settings
 */
async function getSettings(req, res, next) {
  try {
    const settings = await SystemSetting.find();
    const settingsMap = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    // Provide defaults if not found
    const responseSettings = {
      appName: settingsMap.appName || "PingPilot",
      defaultInterval: settingsMap.defaultInterval || 5,
      defaultTimeout: settingsMap.defaultTimeout || 15,
      historyRetentionDays: settingsMap.historyRetentionDays || 30,
      failureThreshold: settingsMap.failureThreshold || 2,
    };

    return res.status(200).json({
      success: true,
      settings: responseSettings,
      account: {
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        authProviders: req.user.authProviders,
        hasGoogleAuth: Boolean(req.user.googleId),
        lastLoginAt: req.user.lastLoginAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update general settings
 * PATCH /api/settings
 */
async function updateSettings(req, res, next) {
  try {
    const {
      appName,
      defaultInterval,
      defaultTimeout,
      historyRetentionDays,
      failureThreshold,
      name,
    } = req.body;

    const updates = {};
    if (appName !== undefined) updates.appName = appName;
    if (defaultInterval !== undefined) updates.defaultInterval = Number(defaultInterval);
    if (defaultTimeout !== undefined) updates.defaultTimeout = Number(defaultTimeout);
    if (historyRetentionDays !== undefined) {
      updates.historyRetentionDays = Number(historyRetentionDays);
    }
    if (failureThreshold !== undefined) {
      updates.failureThreshold = Number(failureThreshold);
    }

    if (Object.keys(updates).length > 0) {
      if (req.user && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Only system administrators can modify platform-wide probe settings",
        });
      }

      for (const [key, value] of Object.entries(updates)) {
        await SystemSetting.findOneAndUpdate(
          { key },
          { value, updatedAt: new Date() },
          { upsert: true, new: true }
        );
      }
    }

    if (name && req.user) {
      req.user.name = name.trim();
      await req.user.save();
    }

    return res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      settings: updates,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSettings,
  updateSettings,
};

