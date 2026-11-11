const express = require("express");
const { previewReport, exportReport } = require("../controllers/reportController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.get("/preview", previewReport);
router.get("/export", exportReport);

module.exports = router;

