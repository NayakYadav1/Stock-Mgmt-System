const express = require("express");
const router = express.Router();

const {
getDueLedger,
recordPayment,
} = require("../controllers/ledgerController");

router.get("/due", getDueLedger);
router.post("/pay", recordPayment);

module.exports = router;
