const express = require("express");
const { settlePayment } = require("../controllers/paymentController");

const router = express.Router();
router.post("/", settlePayment);

module.exports = router;