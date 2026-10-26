const express = require("express");
const { createPurchase, createSale, getTransactions } = require("../controllers/transactionController");

const router = express.Router();

router.post("/purchases", createPurchase);
router.post("/sales", createSale);
router.get("/", getTransactions);

module.exports = router;