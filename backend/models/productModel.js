const db = require("../config/db");

async function getAll() {
  const result = await db.query(`
    SELECT id, sku, name, cost_price, selling_price,
           stock_quantity, low_stock_threshold, created_at, updated_at
    FROM products
    ORDER BY id DESC
  `);

  return result.rows;
}

module.exports = { getAll };