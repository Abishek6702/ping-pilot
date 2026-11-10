const express = require("express");
const {
  login,
  register,
  googleLogin,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const {
  validateLogin,
  validateRegister,
  validateGoogleAuth,
} = require("../middleware/validators");

const router = express.Router();

router.post("/login", authLimiter, validateLogin, login);
router.post("/register", authLimiter, validateRegister, register);
router.post("/google", authLimiter, validateGoogleAuth, googleLogin);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password/:token", authLimiter, resetPassword);
router.post("/change-password", protect, changePassword);
router.post("/logout", logout);
router.get("/me", protect, getMe);

module.exports = router;

