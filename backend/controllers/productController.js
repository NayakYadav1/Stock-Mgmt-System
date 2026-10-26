const productModel = require("../models/productModel");
const pool = require("../config/db");

// Validate a product ID from the URL.
function isValidId(id) {
  return /^\d+$/.test(id) && BigInt(id) > 0n;
}

// Convert database numeric values into JSON numbers.
function formatProduct(product) {
  return {
    ...product,
    cost_price: Number(product.cost_price),
    selling_price: Number(product.selling_price),
    stock_quantity: Number(product.stock_quantity),
    low_stock_threshold: Number(product.low_stock_threshold),
  };
}

// GET /api/products
// Fetch all products and the most recent purchase unit cost.
async function getAllProducts(req, res) {
  try {
    const products = await productModel.getAll();

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products.map((product) => ({
        ...product,
        cost_price: Number(product.cost_price),
        selling_price: Number(product.selling_price),
        stock_quantity: Number(product.stock_quantity),
        low_stock_threshold: Number(product.low_stock_threshold),
      })),
    });
  } catch (error) {
    console.error("Get products error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
}

// POST /api/products
// Create a new product.
async function createProduct(req, res) {
  const {
    sku,
    name,
    cost_price,
    selling_price,
    low_stock_threshold = 5,
  } = req.body || {};

  const validPrice = (value) =>
    (typeof value === "number" || typeof value === "string") &&
    /^\d{1,10}(\.\d{1,2})?$/.test(String(value)) &&
    Number.isFinite(Number(value));

  if (typeof sku !== "string" || !sku.trim() || sku.trim().length > 100) {
    return res.status(400).json({
      success: false,
      message: "Valid SKU is required (max 100 characters)",
    });
  }

  if (typeof name !== "string" || !name.trim() || name.trim().length > 200) {
    return res.status(400).json({
      success: false,
      message: "Valid product name is required (max 200 characters)",
    });
  }

  if (!validPrice(cost_price) || !validPrice(selling_price)) {
    return res.status(400).json({
      success: false,
      message:
        "Prices must be non-negative amounts with at most two decimal places",
    });
  }

  if (
    typeof low_stock_threshold === "boolean" ||
    !Number.isSafeInteger(Number(low_stock_threshold)) ||
    Number(low_stock_threshold) < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Low-stock threshold must be a non-negative integer",
    });
  }

  try {
    const product = await productModel.create({
      sku: sku.trim(),
      name: name.trim().replace(/\s+/g, " "),
      cost_price: Number(cost_price),
      selling_price: Number(selling_price),
      low_stock_threshold: Number(low_stock_threshold),
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: {
        ...product,
        cost_price: Number(product.cost_price),
        selling_price: Number(product.selling_price),
        stock_quantity: Number(product.stock_quantity),
        low_stock_threshold: Number(product.low_stock_threshold),
      },
    });
  } catch (error) {
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ success: false, message: "SKU already exists" });
    }

    console.error("Create product error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create product" });
  }
}

// PUT /api/products/:id
// Update the supplied product fields.
// Omitted fields keep their current values.
async function updateProduct(req, res) {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID",
    });
  }

  const allowedFields = [
    "sku",
    "name",
    "cost_price",
    "selling_price",
    "low_stock_threshold",
  ];

  const suppliedFields = Object.keys(req.body || {});
  const unknownFields = suppliedFields.filter(
    (field) => !allowedFields.includes(field),
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Unsupported fields: ${unknownFields.join(", ")}`,
    });
  }

  if (suppliedFields.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Provide at least one field to update",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      `SELECT * FROM products WHERE id = $1 FOR UPDATE`,
      [id],
    );

    if (currentResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const current = currentResult.rows[0];
    const next = { ...current };

    for (const field of suppliedFields) {
      const value = req.body[field];

      if (field === "sku" || field === "name") {
        const maxLength = field === "sku" ? 100 : 200;

        if (
          typeof value !== "string" ||
          !value.trim() ||
          value.trim().length > maxLength
        ) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            message: `${field} must be a non-empty string of at most ${maxLength} characters`,
          });
        }

        next[field] =
          field === "name" ? value.trim().replace(/\s+/g, " ") : value.trim();
      } else if (field === "low_stock_threshold") {
        if (
          typeof value === "boolean" ||
          !Number.isSafeInteger(Number(value)) ||
          Number(value) < 0
        ) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            message: "low_stock_threshold must be a non-negative integer",
          });
        }

        next.low_stock_threshold = Number(value);
      } else if (field === "cost_price" || field === "selling_price") {
        if (
          value === null ||
          typeof value === "boolean" ||
          !Number.isFinite(Number(value)) ||
          Number(value) < 0 ||
          !Number.isSafeInteger(Math.round(Number(value) * 100))
        ) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            message: `${field} must be a valid non-negative monetary amount`,
          });
        }

        next[field] = Number(value);
      }
    }

    const updateQuery = `
    UPDATE products
    SET
      sku = $1,
      name = $2,
      cost_price = $3,
      selling_price = $4,
      low_stock_threshold = $5,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $6 
    RETURNING
      id, sku, name, cost_price, selling_price,
      stock_quantity, low_stock_threshold, created_at, updated_at
  `;

    const values = [
      next.sku,
      next.name,
      next.cost_price,
      next.selling_price,
      next.low_stock_threshold,
      id,
    ];

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: formatProduct(result.rows[0]),
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Update rollback error:", rollbackError.message);
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A product with this SKU already exists",
      });
    }

    console.error("Update product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update product",
    });
  } finally {
    client.release();
  }
}

// DELETE /api/products/:id
// Refuse to delete products with purchase or sales history.
async function deleteProduct(req, res) {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM products WHERE id = $1 RETURNING id, sku, name`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    // Foreign-key violations protect purchase and sales history.
    if (error.code === "23503") {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete this product because it is referenced by transaction history",
      });
    }

    console.error("Delete product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
}

module.exports = {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};
