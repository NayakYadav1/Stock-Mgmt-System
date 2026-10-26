const partyModel = require("../models/partyModel");

async function getParties(req, res) {
  const type = req.query.type || null;

  if (type !== null && !["customer", "supplier"].includes(type)) {
    return res.status(400).json({
      success: false,
      message: "Type must be customer or supplier",
    });
  }

  try {
    const parties = await partyModel.getAll(type);
    return res.json({
      success: true,
      count: parties.length,
      data: parties.map((party) => ({
        ...party,
        balance: Number(party.balance),
      })),
    });
  } catch (error) {
    console.error("Get parties error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch parties",
    });
  }
}

async function createParty(req, res) {
  const {
    party_type,
    name,
    phone = null,
    address = null,
    opening_balance = 0,
  } = req.body || {};

  const validTypes = ["customer", "supplier", "both"];
  const validBalance =
    (typeof opening_balance === "number" ||
      typeof opening_balance === "string") &&
    /^-?\d{1,12}(\.\d{1,2})?$/.test(String(opening_balance));

  if (!validTypes.includes(party_type)) {
    return res.status(400).json({
      success: false,
      message: "party_type must be customer, supplier, or both",
    });
  }

  if (typeof name !== "string" || !name.trim() || name.trim().length > 200) {
    return res.status(400).json({
      success: false,
      message: "name must be a non-empty string of at most 200 characters",
    });
  }

  if (phone !== null && (typeof phone !== "string" || phone.length > 30)) {
    return res.status(400).json({
      success: false,
      message: "phone must be a string of at most 30 characters, or null",
    });
  }

  if (address !== null && typeof address !== "string") {
    return res.status(400).json({
      success: false,
      message: "address must be a string or null",
    });
  }

  if (!validBalance) {
    return res.status(400).json({
      success: false,
      message:
        "opening_balance must be an amount with at most two decimal places",
    });
  }

  try {
    const party = await partyModel.create({
      party_type,
      name: name.trim().replace(/\s+/g, " "),
      phone: phone ? phone.trim() : null,
      address: address ? address.trim() : null,
      opening_balance: Number(opening_balance),
    });

    return res.status(201).json({
      success: true,
      message: "Party created successfully",
      data: { ...party, balance: Number(party.balance) },
    });
  } catch (error) {
    console.error("Create party error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to create party",
    });
  }
}

async function updateParty(req, res) {
  const { id } = req.params;
  const fields = req.body || {};
  const allowedFields = ["name", "phone", "address"];
  const suppliedFields = Object.keys(fields);

  if (!/^[1-9]\d*$/.test(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid party ID" });
  }

  if (suppliedFields.some((field) => !allowedFields.includes(field))) {
    return res.status(400).json({
      success: false,
      message: "Only name, phone, and address can be updated",
    });
  }

  if (suppliedFields.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Provide at least one field to update",
    });
  }

  if (
    Object.hasOwn(fields, "name") &&
    (typeof fields.name !== "string" ||
      !fields.name.trim() ||
      fields.name.trim().length > 200)
  ) {
    return res.status(400).json({
      success: false,
      message: "name must be a non-empty string of at most 200 characters",
    });
  }

  if (
    Object.hasOwn(fields, "phone") &&
    fields.phone !== null &&
    (typeof fields.phone !== "string" || fields.phone.length > 30)
  ) {
    return res.status(400).json({
      success: false,
      message: "phone must be a string of at most 30 characters, or null",
    });
  }

  if (
    Object.hasOwn(fields, "address") &&
    fields.address !== null &&
    typeof fields.address !== "string"
  ) {
    return res.status(400).json({
      success: false,
      message: "address must be a string or null",
    });
  }

  const normalized = { ...fields };
  if (typeof normalized.name === "string") {
    normalized.name = normalized.name.trim().replace(/\s+/g, " ");
  }
  if (typeof normalized.phone === "string") {
    normalized.phone = normalized.phone.trim() || null;
  }
  if (typeof normalized.address === "string") {
    normalized.address = normalized.address.trim() || null;
  }

  try {
    const data = await partyModel.update(id, normalized);

    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: "Party not found" });
    }

    return res.json({ success: true, message: "Party updated", data });
  } catch (error) {
    console.error("Update party error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update party" });
  }
}

async function deleteParty(req, res) {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid party ID" });
  }

  try {
    const data = await partyModel.remove(id);

    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: "Party not found" });
    }

    return res.json({ success: true, message: "Party deleted", data });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a party that has transaction or ledger history",
      });
    }

    console.error("Delete party error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete party" });
  }
}

async function getPartyLedger(req, res) {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid party ID" });
  }

  try {
    const data = await partyModel.getLedger(Number(id));

    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: "Party not found" });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Get party ledger error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch party ledger",
    });
  }
}

module.exports = {
  getParties,
  createParty,
  updateParty,
  deleteParty,
  getPartyLedger,
};
