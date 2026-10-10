const express = require("express");
const router = express.Router();

const {
createSale,
getAllSales,
} = require("../controllers/saleController");

// GET /api/sales - list sales
router.get("/", getAllSales);

// POST /api/sales - record a sale and deduct stock
router.post("/", createSale);

module.exports = router;
