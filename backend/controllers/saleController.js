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
  const {
    customer_name,
    customer_phone,
    sold_by = "",
    notes = null,
    items,
    amount_paid = 0,
    payment_method = "cash",
    reference_number = null,
  } = req.body || {};

  if (
    typeof customer_name !== "string" ||
    !customer_name.trim() ||
    customer_name.trim().length > 200
  ) {
    return res.status(400).json({
      success: false,
      message: "customer_name is required and must be a non-empty string with at most 200 characters.",
    });
  }

  const normalizedName = customer_name
    .trim()
    .replace(/\s+/g, " ")
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
    .replace(/\b([A-Za-z]+)-([A-Za-z])/g, (_, before, after) => `${before}-${after.toUpperCase()}`);

  const phoneDigits = String(customer_phone ?? "")
    .replace(/[^\d]/g, "")
    .slice(-10);

  if (!/^9\d{9}$/.test(phoneDigits)) {
    return res.status(400).json({
      success: false,
      message: "customer_phone must be a 10-digit Nepali mobile number starting with 9.",
    });
  }

  if (sold_by !== null && typeof sold_by !== "string") {
    return res.status(400).json({
      success: false,
      message: "sold_by must be a string or null.",
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

  const allowedPaymentMethods = [
    "cash",
    "fonepay",
    "bank_transfer",
    "card",
    "mobile_payment",
    "other",
  ];

  if (!allowedPaymentMethods.includes(payment_method)) {
    return res.status(400).json({
      success: false,
      message: `payment_method must be one of: ${allowedPaymentMethods.join(", ")}.`,
    });
  }

  const saleAmountPaid = Number(amount_paid);
  if (!Number.isFinite(saleAmountPaid) || saleAmountPaid < 0 || saleAmountPaid > 9999999999.99) {
    return res.status(400).json({
      success: false,
      message: "amount_paid must be a valid non-negative amount.",
    });
  }

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

    if (!Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
      return res.status(400).json({
        success: false,
        message: `Item ${i + 1}: quantity must be a positive integer.`,
      });
    }

    if (item.selling_price !== undefined && !isValidPrice(item.selling_price)) {
      return res.status(400).json({
        success: false,
        message: `Item ${i + 1}: selling_price must be a valid non-negative price with up to 2 decimal places.`,
      });
    }

    const productId = String(item.product_id);
    if (seenProductIds.has(productId)) {
      return res.status(400).json({
        success: false,
        message: "Each product may appear only once per sale. Combine duplicate quantities into one item.",
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

    const productIds = items.map((item) => Number(item.product_id));
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

    const preparedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = productsById.get(String(item.product_id));
      const quantity = Number(item.quantity);
      const availableStock = Number(product.stock_quantity);

      if (availableStock < quantity) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          success: false,
          message: `Insufficient stock for "${product.name}".`,
          product_id: Number(product.id),
          available_stock: availableStock,
          requested_quantity: quantity,
        });
      }

      const sellingPrice =
        item.selling_price !== undefined
          ? Number(item.selling_price)
          : Number(product.selling_price);

      const lineTotal = Number((quantity * sellingPrice).toFixed(2));
      subtotal = Number((subtotal + lineTotal).toFixed(2));

      preparedItems.push({
        product,
        quantity,
        costPrice: Number(product.cost_price),
        sellingPrice,
      });
    }

    const vatRate = 13;
    const vatAmount = Number((subtotal * (vatRate / 100)).toFixed(2));
    const totalAmount = Number((subtotal + vatAmount).toFixed(2));

    if (saleAmountPaid > totalAmount) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "amount_paid cannot exceed the grand total.",
        total_amount: totalAmount,
        amount_paid: saleAmountPaid,
      });
    }

    const existingCustomer = await client.query(
      `SELECT id, name, phone
       FROM customers
       WHERE phone = $1
       LIMIT 1`,
      [phoneDigits]
    );

    let customerId = null;
    if (existingCustomer.rowCount > 0) {
      customerId = existingCustomer.rows[0].id;
      if (existingCustomer.rows[0].name !== normalizedName) {
        await client.query(
          `UPDATE customers
           SET name = $1
           WHERE id = $2`,
          [normalizedName, customerId]
        );
      }
    } else {
      const customerInsert = await client.query(
        `INSERT INTO customers (name, phone)
         VALUES ($1, $2)
         RETURNING id, name, phone`,
        [normalizedName, phoneDigits]
      );
      customerId = customerInsert.rows[0].id;
    }

    const dueAmount = Number((totalAmount - saleAmountPaid).toFixed(2));
    const paymentStatus =
      saleAmountPaid <= 0
        ? "UNPAID"
        : saleAmountPaid >= totalAmount
          ? "PAID"
          : "PARTIAL";

    const saleResult = await client.query(
      `INSERT INTO sales (
         customer_id,
         customer_name,
         customer_phone,
         sold_by,
         subtotal,
         vat_rate,
         vat_amount,
         total_amount,
         amount_paid,
         due_amount,
         payment_status,
         notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING
         id,
         customer_id,
         customer_name,
         customer_phone,
         sold_by,
         sale_date,
         subtotal,
         vat_rate,
         vat_amount,
         total_amount,
         amount_paid,
         due_amount,
         payment_status,
         notes,
         created_at`,
      [
        customerId,
        normalizedName,
        phoneDigits,
        sold_by ? sold_by.trim() : null,
        subtotal,
        vatRate,
        vatAmount,
        totalAmount,
        saleAmountPaid,
        dueAmount,
        paymentStatus,
        notes,
      ]
    );

    const sale = saleResult.rows[0];

    for (const item of preparedItems) {
      await client.query(
        `INSERT INTO sale_items
           (sale_id, product_id, quantity, cost_price, selling_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [sale.id, item.product.id, item.quantity, item.costPrice, item.sellingPrice]
      );

      await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity - $1,
             updated_at = NOW()
         WHERE id = $2`,
        [item.quantity, item.product.id]
      );
    }

    if (saleAmountPaid > 0) {
      await client.query(
        `INSERT INTO customer_payments (sale_id, amount, payment_method, reference_number, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [sale.id, saleAmountPaid, payment_method, reference_number, notes]
      );
    }

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
        ...sale,
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
        message: "The sale references a product or customer that does not exist.",
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A customer with this phone number already exists.",
      });
    }

    if (error.code === "23514") {
      return res.status(400).json({
        success: false,
        message: "Sale validation failed. Check the price and quantity constraints.",
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