const db = require("../config/db");

async function getSummary() {
  const totals = await db.query(`
    WITH party_balances AS (
      SELECT p.id, p.party_type, COALESCE(SUM(l.amount), 0) AS balance
      FROM parties p
      LEFT JOIN party_ledger_entries l ON l.party_id = p.id
      GROUP BY p.id
    )
    SELECT
      (SELECT COUNT(*) FROM products)::int AS total_products,
      (SELECT COALESCE(SUM(stock_quantity * cost_price), 0)
       FROM products)::numeric(14, 2) AS inventory_value,
      COALESCE(SUM(balance) FILTER (
        WHERE balance > 0 AND party_type IN ('customer', 'both')
      ), 0)::numeric(14, 2) AS receivables,
      COALESCE(SUM(-balance) FILTER (
        WHERE balance < 0 AND party_type IN ('supplier', 'both')
      ), 0)::numeric(14, 2) AS payables
    FROM party_balances
  `);

  const lowStock = await db.query(`
    SELECT id, sku, name, stock_quantity, low_stock_threshold
    FROM products
    WHERE stock_quantity <= low_stock_threshold
    ORDER BY stock_quantity ASC, name ASC
  `);

  const row = totals.rows[0];

  return {
    total_products: Number(row.total_products),
    inventory_value: Number(row.inventory_value),
    receivables: Number(row.receivables),
    payables: Number(row.payables),
    low_stock_products: lowStock.rows.map((product) => ({
      ...product,
      stock_quantity: Number(product.stock_quantity),
      low_stock_threshold: Number(product.low_stock_threshold),
    })),
  };
}

module.exports = { getSummary };