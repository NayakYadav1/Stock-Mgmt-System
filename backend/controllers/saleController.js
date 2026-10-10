const db = require("../config/db");
const MAX_PRICE = 9999999999.99;

function isValidPrice(value) {
  if (typeof value !== "number" && typeof value !== "string") {
    return false;
  }
  const text = String(value);
  return (
    /^\d{1,10}(\.\d{1,2})?$/.test(text) &&
    Number.isFinite(Number(text)) &&
    Number(text) >= 0 &&
    Number(text) <= MAX_PRICE
  );
}

function isValidId(value) {
  return (
    (typeof value === "number" || typeof value === "string") &&
    /^\d+$/.test(String(value)) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0
  );
}

function formatSaleItem(item) {
  return {
    ...item,
    product_id: Number(item.product_id),
    quantity: Number(item.quantity),
    cost_price: Number(item.cost_price),
    selling_price: Number(item.selling_price),
    line_total: Number(item.line_total),
  };
}

async function createSale(req, res) {
  const { customer_name = null, notes = null, items } = req.body;

  // Validate the sale header.
  if (
    customer_name !== null &&
    (typeof customer_name !== "string" ||
      customer_name.trim().length === 0 ||
      customer_name.trim().length > 200)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "customer_name must be a non-empty string of at most 200 characters, or null.",
    });
  }

  if (notes !== null && (typeof notes !== "string" || notes.length > 5000)) {
    return res.status(400).json({
      success: false,
      message: "notes must be a string of at most 5000 characters, or null.",
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "items must be a non-empty array.",
    });
  }

  // Validate items before opening a transaction.
  const seenProductIds = new Set();
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return res.status(400).json({
        success: false,
        message: `Item ${i + 1} must be an object.`,
      });
    }

    if (!isValidId(item.product_id)) {
      return res.status(400).json({
        success: false,
        message: `Item ${i + 1}: product_id must be a positive integer.`,
      });
    }

    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: `Item ${i + 1}: quantity must be a positive integer.`,
      });
    }

    if (
      item.selling_price !== undefined &&
      !isValidPrice(item.selling_price)
    ) {
      return res.status(400).json({
        success: false,
        message: `Item ${i + 1}: selling_price must be a valid non-negative price with up to 2 decimal places.`,
      });
    }

    const productId = String(item.product_id);

    if (seenProductIds.has(productId)) {
      return res.status(400).json({
        success: false,
        message:
          "Each product may appear only once per sale. Combine quantities for duplicate products.",
      });
    }

    seenProductIds.add(productId);
  }

  let client;
  let transactionStarted = false;

  try {
    client = await db.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    const productIds = items.map((item) => String(item.product_id));

    // Lock products in a consistent order to reduce deadlock risk.
    const productResult = await client.query(
      `SELECT id, sku, name, cost_price, selling_price, stock_quantity
       FROM products
       WHERE id = ANY($1::bigint[])
       ORDER BY id
       FOR UPDATE`,
      [productIds]
    );

    const productsById = new Map(
      productResult.rows.map((product) => [String(product.id), product])
    );

    // Reject any product ID that does not exist.
    for (const item of items) {
      if (!productsById.has(String(item.product_id))) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: `Product with ID ${item.product_id} was not found.`,
        });
      }
    }

    // Check stock and minimum selling price before writing sale records.
    const preparedItems = [];

    for (const item of items) {
      const product = productsById.get(String(item.product_id));
      const availableStock = Number(product.stock_quantity);
      const costPrice = Number(product.cost_price);

      if (availableStock < item.quantity) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          success: false,
          message: `Insufficient stock for "${product.name}".`,
          product_id: Number(product.id),
          available_stock: availableStock,
          requested_quantity: item.quantity,
        });
      }

      const sellingPrice =
        item.selling_price === undefined
          ? Number(product.selling_price)
          : Number(item.selling_price);

      if (sellingPrice < costPrice) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: `Selling price cannot be lower than cost price for "${product.name}".`,
          product_id: Number(product.id),
          cost_price: costPrice,
          requested_selling_price: sellingPrice,
        });
      }

      preparedItems.push({
        product,
        quantity: item.quantity,
        costPrice,
        sellingPrice,
      });
    }

    // Create the sale header.
    const saleResult = await client.query(
      `INSERT INTO sales (customer_name, notes)
       VALUES ($1, $2)
       RETURNING id, customer_name, sale_date, total_amount, notes, created_at`,
      [customer_name === null ? null : customer_name.trim(), notes]
    );

    const sale = saleResult.rows[0];

    // Create sale lines and deduct stock within the same transaction.
    for (const item of preparedItems) {
      await client.query(
        `INSERT INTO sale_items
           (sale_id, product_id, quantity, cost_price, selling_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          sale.id,
          item.product.id,
          item.quantity,
          item.costPrice,
          item.sellingPrice,
        ]
      );

      const stockResult = await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity - $1,
             updated_at = NOW()
         WHERE id = $2
           AND stock_quantity >= $1
         RETURNING id`,
        [item.quantity, item.product.id]
      );

      // Defensive check: never allow stock to become negative.
      if (stockResult.rowCount !== 1) {
        throw new Error(
          `Stock changed unexpectedly for product ID ${item.product.id}.`
        );
      }
    }

    // Calculate the total using the database's generated line_total values.
    const totalResult = await client.query(
      `SELECT COALESCE(SUM(line_total), 0)::numeric(14,2) AS total_amount
       FROM sale_items
       WHERE sale_id = $1`,
      [sale.id]
    );

    const totalAmount = totalResult.rows[0].total_amount;

    const updatedSaleResult = await client.query(
      `UPDATE sales
       SET total_amount = $1
       WHERE id = $2
       RETURNING id, customer_name, sale_date, total_amount, notes, created_at`,
      [totalAmount, sale.id]
    );

    const itemsResult = await client.query(
      `SELECT
         si.id,
         si.product_id,
         p.sku,
         p.name AS product_name,
         si.quantity,
         si.cost_price,
         si.selling_price,
         si.line_total
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = $1
       ORDER BY si.id`,
      [sale.id]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Sale recorded successfully.",
      data: {
        ...updatedSaleResult.rows[0],
        total_amount: Number(updatedSaleResult.rows[0].total_amount),
        items: itemsResult.rows.map(formatSaleItem),
      },
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Sale transaction rollback failed:", rollbackError.message);
      }
    }
    console.error("Create sale error:", error.message);

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "The sale references a product or record that does not exist.",
      });
    }

    if (error.code === "23514") {
      return res.status(400).json({
        success: false,
        message:
          "Sale validation failed. Check the price and quantity constraints.",
      });
    }

    if (error.code === "22003" || error.code === "22001") {
      return res.status(400).json({
        success: false,
        message: "A numeric value or text field is outside the allowed range.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to record sale. No sale or stock deduction was saved.",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function getAllSales(req, res) {
  try {
    const result = await db.query(
      `SELECT 
         s.id, 
         s.customer_name, 
         s.sale_date, 
         s.total_amount, 
         s.notes, 
         s.created_at, 
         COALESCE(
           json_agg(
             json_build_object(
               'id', si.id, 
               'product_id', si.product_id, 
               'sku', p.sku, 
               'product_name', p.name, 
               'quantity', si.quantity, 
               'cost_price', si.cost_price, 
               'selling_price', si.selling_price, 
               'line_total', si.line_total
             ) ORDER BY si.id
           ) FILTER (WHERE si.id IS NOT NULL), 
           '[]'::json
         ) AS items 
       FROM sales s 
       LEFT JOIN sale_items si ON si.sale_id = s.id 
       LEFT JOIN products p ON p.id = si.product_id 
       GROUP BY s.id 
       ORDER BY s.sale_date DESC, s.id DESC`
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get sales error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve sales.",
    });
  }
}

module.exports = {
  createSale,
  getAllSales,
};