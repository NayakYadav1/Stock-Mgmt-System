const express = require("express");
const { getParties, createParty,updateParty, deleteParty, getPartyLedger } = require("../controllers/partyController");

const router = express.Router();

router.get("/", getParties);
router.post("/", createParty);
router.patch("/:id", updateParty);
router.delete("/:id", deleteParty);
router.get("/:id/ledger", getPartyLedger);

module.exports = router;