const express = require("express");
const { protect } = require("../middleware/auth");
const { testEndpoint } = require("../controllers/testerController");

const router = express.Router();

// Allow all authenticated users (both admin and regular users) to use API tester
router.use(protect);

router.post("/run", testEndpoint);

module.exports = router;

