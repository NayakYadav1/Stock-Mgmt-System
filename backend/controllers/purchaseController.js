
const db = require("../config/db");

function normalizeProductName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-");
}

function generateProductSku(name) {
  const slug = normalizeProductName(name)
    .replace(/[^a-zA-Z0-9- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toUpperCase();

  const base = slug || "PROD";
  const suffix = String(Date.now()).slice(-6);
  return `${base.slice(0, 20)}-${suffix}`;
}

function parseMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  return Number(num.toFixed(2));
}

async function createPurchase(req, res) {
  const { supplier_name, bill_no = "", purchased_by = "", notes = null, items } = req.body || {};

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

  if (typeof bill_no !== "string" || bill_no.length > 100) {
    return res.status(400).json({
      success: false,
      message: "bill_no must be a string with at most 100 characters",
    });
  }

  if (typeof purchased_by !== "string" || !purchased_by.trim() || purchased_by.trim().length > 200) {
    return res.status(400).json({
      success: false,
      message: "purchased_by must be a non-empty string with at most 200 characters",
    });
  }

  if (notes !== null && typeof notes !== "string") {
    return res.status(400).json({
      success: false,
      message: "Notes must be a string or null",
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one purchase item is required",
    });
  }

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return res.status(400).json({
        success: false,
        message: `Purchase item ${i + 1} must be an object`,
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

    const unitCost = parseMoney(item.unit_cost);
    if (unitCost === null || unitCost < 0) {
      return res.status(400).json({
        success: false,
        message: `Purchase item ${i + 1} unit_cost must be a valid non-negative amount`,
      });
    }

    const hasExistingProduct = item.product_id !== undefined && item.product_id !== null && item.product_id !== "";
    const hasNewProduct = item.new_product && typeof item.new_product === "object";

    if (!hasExistingProduct && !hasNewProduct) {
      return res.status(400).json({
        success: false,
        message: `Purchase item ${i + 1} must include either product_id or new_product`,
      });
    }

    if (hasExistingProduct) {
      if (
        typeof item.product_id === "boolean" ||
        !/^[1-9]\d*$/.test(String(item.product_id)) ||
        !Number.isSafeInteger(Number(item.product_id))
      ) {
        return res.status(400).json({
          success: false,
          message: `Purchase item ${i + 1} has an invalid product_id`,
        });
      }
    }

    if (hasNewProduct) {
      const productName = normalizeProductName(item.new_product.name);
      const productSellingPrice = parseMoney(item.new_product.selling_price ?? item.new_product.sellingPrice ?? item.unit_cost);

      if (!productName || productName.length > 200) {
        return res.status(400).json({
          success: false,
          message: `Purchase item ${i + 1} new_product.name must be a valid product name`,
        });
      }

      if (productSellingPrice === null || productSellingPrice < 0) {
        return res.status(400).json({
          success: false,
          message: `Purchase item ${i + 1} new_product.selling_price must be a valid non-negative amount`,
        });
      }
    }
  }

  let client;

  try {
    client = await db.connect();
    await client.query("BEGIN");

    const purchaseResult = await client.query(
      `INSERT INTO purchases (supplier_name, bill_no, purchased_by, total_amount, notes)
       VALUES ($1, $2, $3, 0, $4)
       RETURNING id, supplier_name, bill_no, purchased_by, purchase_date, total_amount, notes, created_at`,
      [supplier_name.trim(), bill_no.trim(), purchased_by.trim(), notes === null ? null : notes.trim()]
    );

    const purchase = purchaseResult.rows[0];
    let totalAmount = 0;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const quantity = Number(item.quantity);
      const unitCost = parseMoney(item.unit_cost);
      const hasExistingProduct = item.product_id !== undefined && item.product_id !== null && item.product_id !== "";

      let productId;
      let productName;
      let productSku;
      let productSellingPrice;

      if (hasExistingProduct) {
        const existingResult = await client.query(
          `SELECT id, name, cost_price, selling_price, stock_quantity
           FROM products
           WHERE id = $1
           FOR UPDATE`,
          [Number(item.product_id)]
        );

        if (existingResult.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            success: false,
            message: `Product with ID ${item.product_id} was not found`,
          });
        }

        const product = existingResult.rows[0];
        productId = Number(product.id);
        productName = product.name;
        productSku = null;
        productSellingPrice = Number(product.selling_price);
      } else {
        const productNameInput = normalizeProductName(item.new_product.name);
        const existingNameCheck = await client.query(
          `SELECT id
           FROM products
           WHERE LOWER(TRIM(name)) = LOWER($1)
           LIMIT 1`,
          [productNameInput]
        );

        if (existingNameCheck.rowCount > 0) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            success: false,
            message: `A product named "${productNameInput}" already exists`,
          });
        }

        const generatedSku = generateProductSku(productNameInput);
        const sellingPrice = parseMoney(item.new_product.selling_price ?? item.new_product.sellingPrice ?? item.unit_cost);
        const productInsert = await client.query(
          `INSERT INTO products (sku, name, description, cost_price, selling_price, stock_quantity)
           VALUES ($1, $2, $3, $4, $5, 0)
           RETURNING id, sku, name, selling_price`,
          [generatedSku, productNameInput, item.new_product.description ?? null, unitCost, sellingPrice]
        );

        const product = productInsert.rows[0];
        productId = Number(product.id);
        productName = product.name;
        productSku = product.sku;
        productSellingPrice = Number(product.selling_price);
      }

      const lineTotal = Number((quantity * unitCost).toFixed(2));
      totalAmount = Number((totalAmount + lineTotal).toFixed(2));

      await client.query(
        `INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost)
         VALUES ($1, $2, $3, $4)`,
        [purchase.id, productId, quantity, unitCost]
      );

      await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [quantity, productId]
      );

      if (hasExistingProduct && productSellingPrice === 0 && Number(item.unit_cost) > 0) {
        // keep stock and purchase history without rewriting product prices
      }
    }

    const purchaseUpdate = await client.query(
      `UPDATE purchases
       SET total_amount = $1
       WHERE id = $2
       RETURNING id, supplier_name, bill_no, purchased_by, purchase_date, total_amount, notes, created_at`,
      [totalAmount, purchase.id]
    );

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

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Purchase recorded successfully",
      data: {
        ...purchaseUpdate.rows[0],
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

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A product with the same SKU or name already exists",
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