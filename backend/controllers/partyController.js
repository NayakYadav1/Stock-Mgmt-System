const partyModel = require("../models/partyModel");

async function getParties(req, res) {
  try {
    const parties = await partyModel.getAll();
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
    (typeof opening_balance === "number" || typeof opening_balance === "string") &&
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
      message: "opening_balance must be an amount with at most two decimal places",
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

module.exports = { getParties, createParty };