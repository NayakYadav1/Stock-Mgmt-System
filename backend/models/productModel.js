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

async function create(product) {
  const result = await db.query(
    `INSERT INTO products
   (sku, name, cost_price, selling_price, low_stock_threshold)
 VALUES ($1, $2, $3, $4, $5)
 RETURNING id, sku, name, cost_price, selling_price,
           stock_quantity, low_stock_threshold, created_at, updated_at`,
    [
      product.sku,
      product.name,
      product.cost_price,
      product.selling_price,
      product.low_stock_threshold,
    ],
  );

  return result.rows[0];
}

module.exports = { getAll, create };
