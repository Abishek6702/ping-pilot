const User = require("../models/User");
const { generateToken, setTokenCookie, clearTokenCookie } = require("../utils/generateToken");
const { verifyGoogleIdToken } = require("../utils/googleAuth");

/**
 * Normal email / password login
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const normalizedEmail = (email || "").toLowerCase().trim();
    const adminEmail = (
      process.env.ADMIN_EMAIL ||
      process.env.EMAIL ||
      "admin@pingpilot.local"
    )
      .toLowerCase()
      .trim();

    // Verify against single-admin policy
    if (normalizedEmail !== adminEmail) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: "Account is deactivated. Please contact support.",
      });
    }

    let isMatch = await user.comparePassword(password);
    if (!isMatch && process.env.ADMIN_INITIAL_PASSWORD) {
      if (password.toLowerCase() === process.env.ADMIN_INITIAL_PASSWORD.toLowerCase()) {
        user.password = password;
        await user.save();
        isMatch = true;
      }
    }
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken({ id: user._id, role: user.role, email: user.email });
    setTokenCookie(res, token);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        authProviders: user.authProviders,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Google OAuth login
 * POST /api/auth/google
 */
async function googleLogin(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: "Missing Google ID token",
      });
    }

    // Verify token with Google
    const googleProfile = await verifyGoogleIdToken(idToken);
    const googleEmail = (googleProfile.email || "").toLowerCase().trim();

    const adminEmail = (
      process.env.ADMIN_EMAIL ||
      process.env.EMAIL ||
      "admin@pingpilot.local"
    )
      .toLowerCase()
      .trim();

    // Enforce single-admin security rule
    if (googleEmail !== adminEmail) {
      return res.status(403).json({
        success: false,
        error: `Access forbidden: ${googleEmail} is not configured as the application admin`,
      });
    }

    // Find or link admin user
    let user = await User.findOne({ email: googleEmail });

    if (!user) {
      user = new User({
        name: `${googleProfile.firstName || ""} ${googleProfile.lastName || ""}`.trim() || "Admin",
        email: googleEmail,
        googleId: googleProfile.googleId,
        authProviders: ["google"],
        role: "admin",
        isActive: true,
        lastLoginAt: new Date(),
      });
      await user.save();
    } else {
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          error: "Account is deactivated",
        });
      }

      user.googleId = googleProfile.googleId;
      if (!user.authProviders.includes("google")) {
        user.authProviders.push("google");
      }
      user.lastLoginAt = new Date();
      await user.save();
    }

    const token = generateToken({ id: user._id, role: user.role, email: user.email });
    setTokenCookie(res, token);

    return res.status(200).json({
      success: true,
      message: "Google login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        authProviders: user.authProviders,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error.message || "Google authentication failed",
    });
  }
}

/**
 * Logout
 * POST /api/auth/logout
 */
function logout(req, res) {
  clearTokenCookie(res);
  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
}

/**
 * Get current authenticated user
 * GET /api/auth/me
 */
function getMe(req, res) {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      authProviders: req.user.authProviders,
      lastLoginAt: req.user.lastLoginAt,
      createdAt: req.user.createdAt,
    },
  });
}

module.exports = {
  login,
  googleLogin,
  logout,
  getMe,
};

