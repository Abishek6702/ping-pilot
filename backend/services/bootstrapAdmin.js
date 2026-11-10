const User = require("../models/User");
const SystemSetting = require("../models/SystemSetting");

const DEFAULT_SETTINGS = {
  appName: "PingPilot",
  defaultInterval: 5,
  defaultTimeout: 15,
  historyRetentionDays: 30,
  failureThreshold: 2,
};

async function bootstrapAdmin() {
  try {
    const adminEmail = (
      process.env.ADMIN_EMAIL ||
      process.env.EMAIL ||
      "admin@pingpilot.local"
    )
      .toLowerCase()
      .trim();

    const existingAdmin = await User.findOne({ email: adminEmail }).select("+password");

    const configuredPassword =
      process.env.ADMIN_INITIAL_PASSWORD || "Pingpilot";

    if (!existingAdmin) {
      const adminUser = new User({
        name: "Admin",
        email: adminEmail,
        password: configuredPassword,
        role: "admin",
        authProviders: ["local"],
        isActive: true,
      });

      await adminUser.save();
      console.log(`🚀 Admin account bootstrapped successfully for: ${adminEmail}`);
    } else {
      // If configured password differs from existing, synchronize it
      const matches = await existingAdmin.comparePassword(configuredPassword);
      if (!matches) {
        existingAdmin.password = configuredPassword;
        await existingAdmin.save();
        console.log(`🔐 Admin password synchronized from ADMIN_INITIAL_PASSWORD for: ${adminEmail}`);
      }
    }

    // Initialize system settings if absent
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      const existing = await SystemSetting.findOne({ key });
      if (!existing) {
        await SystemSetting.create({ key, value });
      }
    }
  } catch (err) {
    console.error("Failed to bootstrap admin account:", err.message);
  }
}

module.exports = {
  bootstrapAdmin,
  DEFAULT_SETTINGS,
};
