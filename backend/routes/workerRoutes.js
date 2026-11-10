const express = require("express");
const { runMonitoringCycle } = require("../controllers/workerController");
const { workerAuth } = require("../middleware/auth");

const router = express.Router();

// Internal worker endpoint authenticated via secret
router.post("/monitor/run", workerAuth, runMonitoringCycle);

module.exports = router;

