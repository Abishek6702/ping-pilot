const { body, validationResult } = require("express-validator");

function checkValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: errors.array().map((err) => err.msg).join(", "),
      details: errors.array(),
    });
  }
  next();
}

const validateLogin = [
  body("email").trim().isEmail().withMessage("Please provide a valid email address"),
  body("password").trim().notEmpty().withMessage("Password is required"),
  checkValidationErrors,
];

const validateRegister = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 60 })
    .withMessage("Name cannot exceed 60 characters"),
  body("email").trim().isEmail().withMessage("Please provide a valid email address"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
  checkValidationErrors,
];

const validateGoogleAuth = [
  body("idToken").trim().notEmpty().withMessage("Google ID token is required"),
  checkValidationErrors,
];

const validateMonitorInput = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Monitor name is required")
    .isLength({ max: 100 })
    .withMessage("Monitor name cannot exceed 100 characters"),
  body("url")
    .trim()
    .notEmpty()
    .withMessage("Monitor URL is required")
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("Must be a valid HTTP or HTTPS URL"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
  body("interval")
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage("Interval must be between 1 and 1440 minutes"),
  body("timeout")
    .optional()
    .isInt({ min: 1, max: 60 })
    .withMessage("Timeout must be between 1 and 60 seconds"),
  body("expectedStatusCodes")
    .optional()
    .isArray({ min: 1 })
    .withMessage("Expected status codes must be a non-empty array")
    .custom((codes) => {
      if (!codes.every((c) => Number.isInteger(c) && c >= 100 && c <= 599)) {
        throw new Error("Each status code must be a valid HTTP status (100-599)");
      }
      return true;
    }),
  checkValidationErrors,
];

const validateMonitorUpdate = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Monitor name cannot be empty")
    .isLength({ max: 100 })
    .withMessage("Monitor name cannot exceed 100 characters"),
  body("url")
    .optional()
    .trim()
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("Must be a valid HTTP or HTTPS URL"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
  body("interval")
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage("Interval must be between 1 and 1440 minutes"),
  body("timeout")
    .optional()
    .isInt({ min: 1, max: 60 })
    .withMessage("Timeout must be between 1 and 60 seconds"),
  body("expectedStatusCodes")
    .optional()
    .isArray({ min: 1 })
    .withMessage("Expected status codes must be a non-empty array")
    .custom((codes) => {
      if (!codes.every((c) => Number.isInteger(c) && c >= 100 && c <= 599)) {
        throw new Error("Each status code must be a valid HTTP status (100-599)");
      }
      return true;
    }),
  checkValidationErrors,
];

const validateSettingsInput = [
  body("appName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Application name must be between 2 and 50 characters"),
  body("defaultTimeout")
    .optional()
    .isInt({ min: 1, max: 60 })
    .withMessage("Default timeout must be between 1 and 60 seconds"),
  body("defaultInterval")
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage("Default interval must be between 1 and 1440 minutes"),
  body("historyRetentionDays")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("History retention days must be between 1 and 365"),
  body("failureThreshold")
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage("Failure threshold must be between 1 and 10"),
  checkValidationErrors,
];

module.exports = {
  validateLogin,
  validateRegister,
  validateGoogleAuth,
  validateMonitorInput,
  validateMonitorUpdate,
  validateSettingsInput,
};

