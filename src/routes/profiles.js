const express = require("express");
const router = express.Router();
const {
  getAllProfiles,
  searchProfiles,
  getProfileById,
} = require("../controllers/profileController");

// IMPORTANT: /search must be registered before /:id
// otherwise Express will treat "search" as an id param
router.get("/search", searchProfiles);
router.get("/", getAllProfiles);
router.get("/:id", getProfileById);

module.exports = router;
