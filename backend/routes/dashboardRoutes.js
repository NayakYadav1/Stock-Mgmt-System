const express = require("express");
const { getSummary } = require("../controllers/dashboardController");

const router = express.Router();
router.get("/", getSummary);

module.exports = router;