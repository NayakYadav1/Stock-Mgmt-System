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
    latest_unit_cost:
      product.latest_unit_cost === null
        ? null
        : Number(product.latest_unit_cost),
  };
}

// GET /api/products
// Fetch all products and the most recent purchase unit cost.
async function getAllProducts(req, res) {
  try {
    const query = `
      SELECT
        p.id,
        p.sku,
        p.name,
        p.description,
        p.cost_price,
        p.selling_price,
        p.stock_quantity,
        p.created_at,
        p.updated_at,
        latest.unit_cost AS latest_unit_cost
      FROM products AS p
      LEFT JOIN LATERAL (
        SELECT pi.unit_cost
        FROM purchase_items AS pi
        WHERE pi.product_id = p.id
        ORDER BY pi.id DESC
        LIMIT 1
      ) AS latest ON TRUE
      ORDER BY p.id DESC
    `;

    const result = await pool.query(query);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows.map(formatProduct),
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
  try {
    const {
      sku,
      name,
      description = null,
      cost_price,
      selling_price,
      stock_quantity = 0,
    } = req.body;

    // Validate required text fields.
    if (
      typeof sku !== "string" ||
      !sku.trim() ||
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "SKU and product name are required",
      });
    }

    if (sku.trim().length > 100 || name.trim().length > 200) {
      return res.status(400).json({
        success: false,
        message: "SKU or product name exceeds the maximum length",
      });
    }

    if (
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be a string or null",
      });
    }

    // Validate prices.
    if (
      cost_price === undefined ||
      cost_price === null ||
      selling_price === undefined ||
      selling_price === null ||
      typeof cost_price === "boolean" ||
      typeof selling_price === "boolean" ||
      !Number.isFinite(Number(cost_price)) ||
      !Number.isFinite(Number(selling_price))
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid cost_price and selling_price are required",
      });
    }

    const cost = Number(cost_price);
    const selling = Number(selling_price);

    if (
      cost < 0 ||
      selling < 0 ||
      !Number.isSafeInteger(Math.round(cost * 100)) ||
      !Number.isSafeInteger(Math.round(selling * 100))
    ) {
      return res.status(400).json({
        success: false,
        message: "Prices must be non-negative valid monetary amounts",
      });
    }

    if (selling < cost) {
      return res.status(400).json({
        success: false,
        message: "Selling price cannot be lower than cost price",
      });
    }

    // Validate opening stock quantity.
    if (
      typeof stock_quantity === "boolean" ||
      !Number.isSafeInteger(Number(stock_quantity)) ||
      Number(stock_quantity) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Stock quantity must be a non-negative integer",
      });
    }

    const stock = Number(stock_quantity);

    const query = `
      INSERT INTO products (
        sku,
        name,
        description,
        cost_price,
        selling_price,
        stock_quantity
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id, sku, name, description, cost_price,
        selling_price, stock_quantity, created_at, updated_at
    `;

    const values = [
      sku.trim(),
      name.trim(),
      description === null ? null : description.trim(),
      cost,
      selling,
      stock,
    ];

    const result = await pool.query(query, values);

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: formatProduct({
        ...result.rows[0],
        latest_unit_cost: null,
      }),
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A product with this SKU already exists",
      });
    }

    console.error("Create product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
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
    "description",
    "cost_price",
    "selling_price",
    "stock_quantity",
  ];

  const suppliedFields = Object.keys(req.body || {});
  const unknownFields = suppliedFields.filter(
    (field) => !allowedFields.includes(field)
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
      [id]
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

        next[field] = value.trim();
      } else if (field === "description") {
        if (value !== null && typeof value !== "string") {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            message: "Description must be a string or null",
          });
        }

        next.description = value === null ? null : value.trim();
      } else if (
        field === "cost_price" ||
        field === "selling_price"
      ) {
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
      } else if (field === "stock_quantity") {
        if (
          typeof value === "boolean" ||
          !Number.isSafeInteger(Number(value)) ||
          Number(value) < 0
        ) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            message: "Stock quantity must be a non-negative integer",
          });
        }

        next.stock_quantity = Number(value);
      }
    }

    if (Number(next.selling_price) < Number(next.cost_price)) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Selling price cannot be lower than cost price",
      });
    }

    const updateQuery = `
      UPDATE products
      SET
        sku = $1,
        name = $2,
        description = $3,
        cost_price = $4,
        selling_price = $5,
        stock_quantity = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING
        id, sku, name, description, cost_price,
        selling_price, stock_quantity, created_at, updated_at
    `;

    const values = [
      next.sku,
      next.name,
      next.description,
      next.cost_price,
      next.selling_price,
      next.stock_quantity,
      id,
    ];

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: formatProduct({
        ...result.rows[0],
        latest_unit_cost: null,
      }),
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
      [id]
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
          "Cannot delete this product because it is referenced by purchase or sales history",
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