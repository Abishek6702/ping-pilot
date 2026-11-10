const express = require("express");
const {
  getMonitors,
  createMonitor,
  getMonitorById,
  updateMonitor,
  deleteMonitor,
  toggleMonitor,
  pingMonitorNow,
} = require("../controllers/monitorController");
const { getMonitorHistory, getMonitorStats } = require("../controllers/historyController");
const { protect, adminOnly } = require("../middleware/auth");
const { validateMonitorInput, validateMonitorUpdate } = require("../middleware/validators");

const router = express.Router();

router.use(protect);

router.route("/")
  .get(getMonitors)
  .post(validateMonitorInput, createMonitor);

router.route("/:id")
  .get(getMonitorById)
  .patch(validateMonitorUpdate, updateMonitor)
  .delete(deleteMonitor);

router.patch("/:id/toggle", toggleMonitor);
router.post("/:id/ping", pingMonitorNow);
router.get("/:id/history", getMonitorHistory);
router.get("/:id/stats", getMonitorStats);

module.exports = router;

