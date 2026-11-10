const express = require("express");
const { login, googleLogin, logout, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const { validateLogin, validateGoogleAuth } = require("../middleware/validators");

const router = express.Router();

router.post("/login", authLimiter, validateLogin, login);
router.post("/google", authLimiter, validateGoogleAuth, googleLogin);
router.post("/logout", logout);
router.get("/me", protect, getMe);

module.exports = router;

