const express = require("express");
const { getPublicStatusPageBySlug } = require("../controllers/statusPageController");
const { publicStatusLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.get("/:slug", publicStatusLimiter, getPublicStatusPageBySlug);

module.exports = router;

