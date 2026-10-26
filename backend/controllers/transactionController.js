const transactionModel = require("../models/transactionModel");

async function createPurchase(req, res) {
  const {
    party_id,
    items,
    amount_paid = 0,
    payment_method = "cash",
    reference_number = null,
    notes = null,
  } = req.body || {};

  if (!/^[1-9]\d*$/.test(String(party_id))) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid party_id" });
  }

  if (notes !== null && typeof notes !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "notes must be a string or null" });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "At least one item is required" });
  }

  for (const item of items) {
    if (
      !item ||
      !Number.isSafeInteger(Number(item.product_id)) ||
      Number(item.product_id) <= 0 ||
      !Number.isSafeInteger(Number(item.quantity)) ||
      Number(item.quantity) <= 0 ||
      !/^\d{1,10}(\.\d{1,2})?$/.test(String(item.unit_price))
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Each item needs a valid product_id, positive quantity, and non-negative unit_price",
      });
    }
  }

  if (!/^\d{1,12}(\.\d{1,2})?$/.test(String(amount_paid))) {
    return res.status(400).json({
      success: false,
      message:
        "amount_paid must be a non-negative amount with at most two decimal places",
    });
  }

  const methods = [
    "cash",
    "fonepay",
    "bank_transfer",
    "card",
    "mobile_payment",
    "other",
  ];
  if (!methods.includes(payment_method)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid payment_method" });
  }

  if (
    reference_number !== null &&
    (typeof reference_number !== "string" || reference_number.length > 100)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "reference_number must be a string of at most 100 characters, or null",
    });
  }

  try {
    const data = await transactionModel.createPurchase({
      partyId: Number(party_id),
      items: items.map((item) => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
      })),
      amountPaid: Number(amount_paid),
      paymentMethod: payment_method,
      referenceNumber: reference_number,
      notes: notes === null ? null : notes.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Purchase recorded",
      data,
    });
  } catch (error) {
    if (error.status) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }

    console.error("Create purchase error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to record purchase" });
  }
}

async function createSale(req, res) {
  const {
    party_id,
    items,
    amount_received = 0,
    payment_method = "cash",
    reference_number = null,
    notes = null,
  } = req.body || {};

  if (!/^[1-9]\d*$/.test(String(party_id))) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid party_id" });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "At least one item is required" });
  }

  const seen = new Set();
  for (const item of items) {
    const id = Number(item?.product_id);
    const quantity = Number(item?.quantity);

    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      (item.unit_price !== undefined &&
        !/^\d{1,10}(\.\d{1,2})?$/.test(String(item.unit_price)))
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Each item needs a valid product_id, positive quantity, and optional valid unit_price",
      });
    }

    if (seen.has(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Each product may appear only once; combine duplicate quantities",
      });
    }
    seen.add(id);
  }

  if (!/^\d{1,12}(\.\d{1,2})?$/.test(String(amount_received))) {
    return res.status(400).json({
      success: false,
      message:
        "amount_received must be a non-negative amount with at most two decimal places",
    });
  }

  if (
    ![
      "cash",
      "fonepay",
      "bank_transfer",
      "card",
      "mobile_payment",
      "other",
    ].includes(payment_method)
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid payment_method" });
  }

  if (reference_number !== null && typeof reference_number !== "string") {
    return res
      .status(400)
      .json({
        success: false,
        message: "reference_number must be a string or null",
      });
  }

  if (notes !== null && typeof notes !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "notes must be a string or null" });
  }

  try {
    const data = await transactionModel.createSale({
      partyId: Number(party_id),
      items: items.map((item) => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        ...(item.unit_price === undefined
          ? {}
          : { unit_price: Number(item.unit_price) }),
      })),
      amountReceived: Number(amount_received),
      paymentMethod: payment_method,
      referenceNumber: reference_number,
      notes: notes === null ? null : notes.trim(),
    });

    return res
      .status(201)
      .json({ success: true, message: "Sale recorded", data });
  } catch (error) {
    if (error.status) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }

    console.error("Create sale error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to record sale" });
  }
}

async function getTransactions(req, res) {
  try {
    const data = await transactionModel.getAll();
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("Get transactions error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
    });
  }
}

module.exports = { createPurchase, createSale, getTransactions };
