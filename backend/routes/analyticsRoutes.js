const express = require("express");
const {
  getAnalytics,
  getMonitorAnalytics,
} = require("../controllers/analyticsController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.get("/", getAnalytics);
router.get("/monitors/:id", getMonitorAnalytics);

module.exports = router;

