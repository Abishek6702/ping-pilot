const crypto = require("crypto");
const User = require("../models/User");
const { generateToken, setTokenCookie, clearTokenCookie } = require("../utils/generateToken");
const { verifyGoogleIdToken } = require("../utils/googleAuth");
const sendMail = require("../utils/sendMail");
const renderTemplate = require("../utils/renderTemplate");
const { getAdminEmails } = require("../services/bootstrapAdmin");

/**
 * Normal email / password login
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const normalizedEmail = (email || "").toLowerCase().trim();
    const adminEmails = getAdminEmails();
    const isConfiguredAdmin = adminEmails.includes(normalizedEmail);

    const isPublicRegistrationEnabled = process.env.ALLOW_PUBLIC_REGISTRATION === "true";

    // Enforce single-admin policy only if public registration is not enabled
    if (!isPublicRegistrationEnabled && !isConfiguredAdmin) {
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
    if (!isMatch && process.env.ADMIN_INITIAL_PASSWORD && isConfiguredAdmin) {
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
 * Register a new user account (when public registration is enabled)
 * POST /api/auth/register
 */
async function register(req, res, next) {
  try {
    const isPublicRegistrationEnabled = process.env.ALLOW_PUBLIC_REGISTRATION === "true";
    if (!isPublicRegistrationEnabled) {
      return res.status(403).json({
        success: false,
        error: "Public registration is currently disabled for this instance",
      });
    }

    const { name, email, password } = req.body;
    const normalizedEmail = (email || "").toLowerCase().trim();

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        error: "Name, email and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long",
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "An account with this email address already exists",
      });
    }

    const adminEmails = getAdminEmails();
    const role = adminEmails.includes(normalizedEmail) ? "admin" : "user";

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
      authProviders: ["local"],
      isActive: true,
      lastLoginAt: new Date(),
    });

    await user.save();

    const token = generateToken({ id: user._id, role: user.role, email: user.email });
    setTokenCookie(res, token);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
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
    const adminEmails = getAdminEmails();
    const isConfiguredAdmin = adminEmails.includes(googleEmail);

    const isPublicRegistrationEnabled = process.env.ALLOW_PUBLIC_REGISTRATION === "true";

    // Enforce single-admin policy only if public registration is not enabled
    if (!isPublicRegistrationEnabled && !isConfiguredAdmin) {
      return res.status(403).json({
        success: false,
        error: `Access forbidden: ${googleEmail} is not configured as an application admin`,
      });
    }

    // Find or link user
    let user = await User.findOne({ email: googleEmail });

    if (!user) {
      user = new User({
        name: `${googleProfile.firstName || ""} ${googleProfile.lastName || ""}`.trim() || "User",
        email: googleEmail,
        googleId: googleProfile.googleId,
        authProviders: ["google"],
        role: isConfiguredAdmin ? "admin" : "user",
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

      if (isConfiguredAdmin && user.role !== "admin") {
        user.role = "admin";
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

/**
 * Request password reset (only for local auth accounts, not google-only accounts)
 * POST /api/auth/forgot-password
 */
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const normalizedEmail = (email || "").toLowerCase().trim();

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        error: "Please provide an email address",
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+password +resetPasswordToken +resetPasswordExpires"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "No account found with this email address",
      });
    }

    // Check if account is Google-only
    const hasLocalAuth = user.authProviders && user.authProviders.includes("local");
    const isGoogleOnly =
      user.authProviders && user.authProviders.includes("google") && !hasLocalAuth;

    if (isGoogleOnly) {
      return res.status(400).json({
        success: false,
        error:
          "This account was created with Google Sign-In and does not have a local password. Please use 'Continue with Google' to sign in.",
      });
    }

    // Generate random reset token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Set token & expiry (15 minutes)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    // Determine frontend URL
    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000")
      .split(",")[0]
      .trim()
      .replace(/\/+$/, "");
    const resetUrl = `${frontendUrl}/login?resetToken=${rawToken}`;

    const emailHtml = renderTemplate("resetPassword", {
      firstName: user.name || "User",
      resetUrl,
      expiresInMinutes: 15,
    });

    try {
      await sendMail(user.email, "Reset Your PingPilot Password", emailHtml);
    } catch (_mailErr) {
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      return res.status(500).json({
        success: false,
        error:
          "Failed to send reset email. Please ensure outbound email configuration is set up.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password reset link sent to your email address",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reset password using token
 * POST /api/auth/reset-password/:token
 */
async function resetPassword(req, res, next) {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select("+password +resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired password reset link. Please request a new one.",
      });
    }

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    if (!user.authProviders.includes("local")) {
      user.authProviders.push("local");
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully. You can now log in.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Change password for authenticated user (both admin and user)
 * POST /api/auth/change-password
 */
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: "New password must be at least 8 characters long",
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // If user has a password set, verify currentPassword
    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          error: "Current password is required",
        });
      }

      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          error: "Current password is incorrect",
        });
      }
    }

    user.password = newPassword;
    if (!user.authProviders.includes("local")) {
      user.authProviders.push("local");
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  register,
  googleLogin,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
};
