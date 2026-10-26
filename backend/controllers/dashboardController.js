const dashboardModel = require("../models/dashboardModel");

async function getSummary(req, res) {
  try {
    const data = await dashboardModel.getSummary();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Get dashboard summary error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard summary",
    });
  }
}

module.exports = { getSummary };