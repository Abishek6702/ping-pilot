const express = require("express");
const {
  getAdminOverview,
  getAdminUsers,
  toggleUserStatus,
  getAdminMonitors,
  getAdminAuditLogs,
} = require("../controllers/adminController");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

// Only admin users can access this router
router.use(protect, adminOnly);

router.get("/overview", getAdminOverview);
router.get("/users", getAdminUsers);
router.patch("/users/:id/toggle", toggleUserStatus);
router.get("/monitors", getAdminMonitors);
router.get("/audit-logs", getAdminAuditLogs);

module.exports = router;

