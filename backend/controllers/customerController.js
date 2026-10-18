const db = require("../config/db");

function normalizeSearchTerm(value) {
  return String(value || "").trim();
}

async function getCustomers(req, res) {
  try {
    const search = normalizeSearchTerm(req.query.search);
    const query = search
      ? `
        SELECT id, name, phone, created_at
        FROM customers
        WHERE LOWER(name) LIKE LOWER($1)
           OR phone LIKE $1
        ORDER BY name ASC
        LIMIT 10
      `
      : `
        SELECT id, name, phone, created_at
        FROM customers
        ORDER BY created_at DESC, id DESC
        LIMIT 10
      `;

    const values = search ? [`%${search}%`] : [];
    const result = await db.query(query, values);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get customers error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
    });
  }
}

module.exports = {
  getCustomers,
};
