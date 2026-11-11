const express = require("express");
const {
  getStatusPages,
  createStatusPage,
  updateStatusPage,
  deleteStatusPage,
} = require("../controllers/statusPageController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.route("/")
  .get(getStatusPages)
  .post(createStatusPage);

router.route("/:id")
  .patch(updateStatusPage)
  .delete(deleteStatusPage);

module.exports = router;

