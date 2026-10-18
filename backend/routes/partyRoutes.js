const express = require("express");
const { getParties, createParty } = require("../controllers/partyController");

const router = express.Router();

router.get("/", getParties);
router.post("/", createParty);

module.exports = router;