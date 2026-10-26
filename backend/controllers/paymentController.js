const paymentModel = require("../models/paymentModel");

async function settlePayment(req, res) {
  const {
    party_id,
    amount,
    payment_method = "cash",
    reference_number = null,
    notes = null,
  } = req.body || {};

  if (!/^[1-9]\d*$/.test(String(party_id))) {
    return res.status(400).json({ success: false, message: "Invalid party_id" });
  }

  if (!/^\d{1,12}(\.\d{1,2})?$/.test(String(amount)) || Number(amount) <= 0) {
    return res.status(400).json({
      success: false,
      message: "amount must be positive with at most two decimal places",
    });
  }

  const methods = ["cash", "fonepay", "bank_transfer", "card", "mobile_payment", "other"];
  if (!methods.includes(payment_method)) {
    return res.status(400).json({ success: false, message: "Invalid payment_method" });
  }

  if (reference_number !== null && typeof reference_number !== "string") {
    return res.status(400).json({
      success: false,
      message: "reference_number must be a string or null",
    });
  }

  if (notes !== null && typeof notes !== "string") {
    return res.status(400).json({ success: false, message: "notes must be a string or null" });
  }

  try {
    const data = await paymentModel.settle({
      partyId: Number(party_id),
      amount: Number(amount),
      paymentMethod: payment_method,
      referenceNumber: reference_number,
      notes: notes === null ? null : notes.trim(),
    });

    return res.status(201).json({ success: true, message: "Payment recorded", data });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    console.error("Settle payment error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to record payment" });
  }
}

module.exports = { settlePayment };