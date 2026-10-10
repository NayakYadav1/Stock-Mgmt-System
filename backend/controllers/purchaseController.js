
const db = require("../config/db");

// POST /api/purchases
// Create a purchase bill and increase product stock atomically.
async function createPurchase(req, res) {
  const { supplier_name, notes = null, items } = req.body || {};

  // Validate the supplier.
  if (
    typeof supplier_name !== "string" ||
    !supplier_name.trim() ||
    supplier_name.trim().length > 200
  ) {
    return res.status(400).json({
      success: false,
      message: "A valid supplier name is required",
    });
  }

  if (notes !== null && typeof notes !== "string") {
    return res.status(400).json({
      success: false,
      message: "Notes must be a string or null",
    });
  }

  // Require at least one purchase line.
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one purchase item is required",
    });
  }

  // Validate every line before opening a transaction.
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return res.status(400).json({
        success: false,
        message: `Purchase item ${i + 1} must be an object`,
      });
    }

    if (
      item.product_id === undefined ||
      item.product_id === null ||
      typeof item.product_id === "boolean" ||
      !/^[1-9]\d*$/.test(String(item.product_id)) ||
      !Number.isSafeInteger(Number(item.product_id))
    ) {
      return res.status(400).json({
        success: false,
        message: `Purchase item ${i + 1} has an invalid product_id`,
      });
    }

    if (
      typeof item.quantity === "boolean" ||
      !Number.isSafeInteger(Number(item.quantity)) ||
      Number(item.quantity) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: `Purchase item ${i + 1} quantity must be a positive integer`,
      });
    }

    if (
      item.unit_cost === undefined ||
      item.unit_cost === null ||
      typeof item.unit_cost === "boolean" ||
      !/^\d+(\.\d{1,2})?$/.test(String(item.unit_cost)) ||
      !Number.isFinite(Number(item.unit_cost)) ||
      Number(item.unit_cost) > 9999999999.99
    ) {
      return res.status(400).json({
        success: false,
        message: `Purchase item ${i + 1} unit_cost must be a non-negative amount with at most two decimal places`,
      });
    }
  }

  // Obtain a dedicated client for the entire transaction.
  let client;

  try {
    client = await db.connect();
    await client.query("BEGIN");

    // Lock referenced product rows in a consistent order.
    // This prevents stock changes from racing with other
    // transactions and detects nonexistent products.
    const productIds = [
      ...new Set(items.map((item) => String(item.product_id))),
    ];

    const productResult = await client.query(
      `SELECT id
       FROM products
       WHERE id = ANY($1::bigint[])
       ORDER BY id
       FOR UPDATE`,
      [productIds]
    );

    const foundIds = new Set(
      productResult.rows.map((row) => String(row.id))
    );

    const missingIds = productIds.filter((id) => !foundIds.has(id));

    if (missingIds.length > 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "One or more products do not exist",
        product_ids: missingIds,
      });
    }

    // 1. Insert the purchase bill header.
    const purchaseResult = await client.query(
      `INSERT INTO purchases (supplier_name, notes)
       VALUES ($1, $2)
       RETURNING id, supplier_name, purchase_date, total_amount, notes, created_at`,
      [supplier_name.trim(), notes === null ? null : notes.trim()]
    );

    const purchase = purchaseResult.rows[0];

    // 2. Insert line items and increase stock.
    for (const item of items) {
      const productId = String(item.product_id);
      const quantity = Number(item.quantity);
      const unitCost = String(item.unit_cost);

      await client.query(
        `INSERT INTO purchase_items
           (purchase_id, product_id, quantity, unit_cost)
         VALUES ($1, $2, $3, $4)`,
        [purchase.id, productId, quantity, unitCost]
      );

      const stockResult = await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id`,
        [quantity, productId]
      );

      if (stockResult.rowCount !== 1) {
        throw new Error(`Failed to update stock for product ${productId}`);
      }
    }

    // 3. Calculate the total using PostgreSQL NUMERIC arithmetic.
    const totalResult = await client.query(
      `SELECT COALESCE(SUM(line_total), 0)::numeric(14, 2) AS total_amount
       FROM purchase_items
       WHERE purchase_id = $1`,
      [purchase.id]
    );

    const totalAmount = totalResult.rows[0].total_amount;

    // 4. Save the calculated total in the purchase header.
    const updatedPurchaseResult = await client.query(
      `UPDATE purchases
       SET total_amount = $1
       WHERE id = $2
       RETURNING id, supplier_name, purchase_date, total_amount, notes, created_at`,
      [totalAmount, purchase.id]
    );

    // 5. Read the inserted bill lines for the response.
    const itemsResult = await client.query(
      `SELECT
         pi.id,
         pi.product_id,
         p.sku,
         p.name AS product_name,
         pi.quantity,
         pi.unit_cost,
         pi.line_total
       FROM purchase_items pi
       JOIN products p ON p.id = pi.product_id
       WHERE pi.purchase_id = $1
       ORDER BY pi.id`,
      [purchase.id]
    );

    // Nothing is persisted until all operations succeed.
    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Purchase recorded successfully",
      data: {
        ...updatedPurchaseResult.rows[0],
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Purchase rollback error:", rollbackError.message);
      }
    }

    console.error("Create purchase error:", error.message);

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "A referenced product does not exist",
      });
    }

    if (error.code === "22003") {
      return res.status(400).json({
        success: false,
        message: "A quantity or monetary total exceeds the database limit",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create purchase",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// GET /api/purchases
// List purchase bills, including their line items.
async function getAllPurchases(req, res) {
  try {
    const result = await db.query(
      `SELECT
         pu.id,
         pu.supplier_name,
         pu.purchase_date,
         pu.total_amount,
         pu.notes,
         pu.created_at,
         COALESCE(
           (
             SELECT json_agg(
               json_build_object(
                 'id', pi.id,
                 'product_id', pi.product_id,
                 'sku', p.sku,
                 'product_name', p.name,
                 'quantity', pi.quantity,
                 'unit_cost', pi.unit_cost,
                 'line_total', pi.line_total
               )
               ORDER BY pi.id
             )
             FROM purchase_items pi
             JOIN products p ON p.id = pi.product_id
             WHERE pi.purchase_id = pu.id
           ),
           '[]'::json
         ) AS items
       FROM purchases pu
       ORDER BY pu.id DESC`
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get purchases error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchases",
    });
  }
}

module.exports = {
  createPurchase,
  getAllPurchases,
};