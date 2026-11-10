const express = require("express");
const { getSettings, updateSettings } = require("../controllers/settingsController");
const { protect, adminOnly } = require("../middleware/auth");
const { validateSettingsInput } = require("../middleware/validators");

const router = express.Router();

router.use(protect, adminOnly);

router.route("/")
  .get(getSettings)
  .patch(validateSettingsInput, updateSettings);

module.exports = router;

