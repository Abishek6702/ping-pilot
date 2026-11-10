const express = require("express");
const { getDashboard } = require("../controllers/dashboardController");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

router.use(protect, adminOnly);
router.get("/", getDashboard);

module.exports = router;

