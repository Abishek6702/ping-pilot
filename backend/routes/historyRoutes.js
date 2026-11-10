const express = require("express");
const { getHistory } = require("../controllers/historyController");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

router.use(protect, adminOnly);
router.get("/", getHistory);

module.exports = router;

