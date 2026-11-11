const User = require("../models/User");
const Monitor = require("../models/Monitor");
const PingResult = require("../models/PingResult");
const AuditLog = require("../models/AuditLog");
const { getAdminEmails } = require("../services/bootstrapAdmin");

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Get system-wide administrative overview
 * GET /api/admin/overview
 */
async function getAdminOverview(req, res, next) {
  try {
    const [
      totalUsers,
      totalMonitors,
      activeMonitors,
      downMonitors,
      totalPings,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments(),
      Monitor.countDocuments(),
      Monitor.countDocuments({ isActive: true, currentStatus: "UP" }),
      Monitor.countDocuments({ isActive: true, currentStatus: "DOWN" }),
      PingResult.countDocuments(),
      User.find().sort({ createdAt: -1 }).limit(5).select("-password"),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalMonitors,
        activeMonitors,
        downMonitors,
        totalPings,
      },
      recentUsers,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all registered users with their monitor count
 * GET /api/admin/users
 */
async function getAdminUsers(req, res, next) {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || process.env.EMAIL || "").toLowerCase().trim();
    const users = await User.find().sort({ createdAt: -1 }).select("-password");

    // Aggregate monitor counts per user
    const monitorCounts = await Monitor.aggregate([
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 },
          activeCount: { $sum: { $cond: ["$isActive", 1, 0] } },
        },
      },
    ]);

    const countMap = new Map();
    monitorCounts.forEach((c) => {
      if (c._id) {
        countMap.set(c._id.toString(), {
          total: c.count,
          active: c.activeCount,
        });
      }
    });

    // Exclude the portal admins from external tenant users list
    const adminEmails = getAdminEmails();
    const externalUsers = users.filter((u) => !adminEmails.includes(u.email.toLowerCase()));

    const userList = externalUsers.map((u) => {
      const counts = countMap.get(u._id.toString()) || { total: 0, active: 0 };
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        authProviders: u.authProviders,
        isActive: u.isActive,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        monitorsCount: counts.total,
        activeMonitorsCount: counts.active,
      };
    });

    return res.status(200).json({
      success: true,
      users: userList,
      total: userList.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Toggle user active/deactivated status
 * PATCH /api/admin/users/:id/toggle
 */
async function toggleUserStatus(req, res, next) {
  try {
    const { id } = req.params;
    const targetUser = await User.findById(id);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const adminEmails = getAdminEmails();
    if (adminEmails.includes(targetUser.email.toLowerCase().trim())) {
      return res.status(400).json({
        success: false,
        error: "Cannot deactivate a system administrator account",
      });
    }

    targetUser.isActive = !targetUser.isActive;
    await targetUser.save();

    return res.status(200).json({
      success: true,
      message: `User account ${targetUser.isActive ? "activated" : "deactivated"} successfully`,
      user: {
        id: targetUser._id,
        email: targetUser.email,
        isActive: targetUser.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all monitors across the system with user details
 * GET /api/admin/monitors
 */
async function getAdminMonitors(req, res, next) {
  try {
    const monitors = await Monitor.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      monitors,
      total: monitors.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get paginated and filterable platform audit logs
 * GET /api/admin/audit-logs
 */
async function getAdminAuditLogs(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const { method, success, role, search } = req.query;

    const query = {};

    if (method && method !== "ALL") {
      query.method = String(method).toUpperCase().trim();
    }

    if (success === "true" || success === "false") {
      query.success = success === "true";
    }

    if (role && role !== "ALL") {
      query.role = String(role).trim();
    }

    if (search && String(search).trim()) {
      const regex = new RegExp(escapeRegex(String(search).trim()), "i");
      query.$or = [
        { name: regex },
        { action: regex },
        { endpoint: regex },
        { ipAddress: regex },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      AuditLog.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAdminOverview,
  getAdminUsers,
  toggleUserStatus,
  getAdminMonitors,
  getAdminAuditLogs,
};

