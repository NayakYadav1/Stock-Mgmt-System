
const express = require("express");

const {
  createPurchase,
  getAllPurchases,
} = require("../controllers/purchaseController");

const router = express.Router();

router.get("/", getAllPurchases);
router.post("/", createPurchase);

module.exports = router;