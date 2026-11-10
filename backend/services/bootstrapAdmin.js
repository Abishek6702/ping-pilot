const User = require("../models/User");
const SystemSetting = require("../models/SystemSetting");

const DEFAULT_SETTINGS = {
  appName: "PingPilot",
  defaultInterval: 5,
  defaultTimeout: 15,
  historyRetentionDays: 30,
  failureThreshold: 2,
};

function getAdminEmails() {
  const adminEnvList = (process.env.ADMIN_EMAIL || "").split(/[,;\s]+/).filter(Boolean);
  const emailEnvList = (process.env.EMAIL || "").split(/[,;\s]+/).filter(Boolean);
  const configured = [
    ...adminEnvList,
    ...emailEnvList,
    "abishekkrishnat@gmail.com",
    "abishek.k@sece.ac.in",
  ];
  return Array.from(
    new Set(
      configured
        .filter((e) => e && typeof e === "string" && e.includes("@"))
        .map((e) => e.toLowerCase().trim())
    )
  );
}

async function bootstrapAdmin() {
  try {
    const adminEmails = getAdminEmails();
    const configuredPassword = process.env.ADMIN_INITIAL_PASSWORD || "Pingpilot";

    for (const email of adminEmails) {
      const existing = await User.findOne({ email }).select("+password");

      if (!existing) {
        const adminUser = new User({
          name: email.split("@")[0] || "Admin",
          email,
          password: configuredPassword,
          role: "admin",
          authProviders: ["local"],
          isActive: true,
        });

        await adminUser.save();
        console.log(`🚀 Admin account bootstrapped successfully for: ${email}`);
      } else {
        let changed = false;
        if (existing.role !== "admin") {
          existing.role = "admin";
          changed = true;
        }
        if (!existing.isActive) {
          existing.isActive = true;
          changed = true;
        }
        const matches = await existing.comparePassword(configuredPassword);
        if (!matches && existing.authProviders.includes("local")) {
          existing.password = configuredPassword;
          changed = true;
          console.log(`🔐 Admin password synchronized from ADMIN_INITIAL_PASSWORD for: ${email}`);
        }
        if (changed) {
          await existing.save();
        }
      }
    }

    // Initialize system settings if absent
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      const existing = await SystemSetting.findOne({ key });
      if (!existing) {
        await SystemSetting.create({ key, value });
      }
    }
  } catch (error) {
    console.error("Failed to bootstrap admin account:", error.message || error);
  }
}

module.exports = {
  bootstrapAdmin,
  getAdminEmails,
};
