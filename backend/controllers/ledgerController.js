const db = require("../config/db");
const MAX_AMOUNT = 999999999999.99;

function isValidMoney(value) {
  if (typeof value !== "number" && typeof value !== "string") {
    return false;
  }
  const text = String(value);
  return (
    /^\d{1,12}(\.\d{1,2})?$/.test(text) &&
    Number.isFinite(Number(text)) &&
    Number(text) > 0 &&
    Number(text) <= MAX_AMOUNT
  );
}

function isValidPositiveId(value) {
  return (
    (typeof value === "number" || typeof value === "string") &&
    /^\d+$/.test(String(value)) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0
  );
}

/**
 * GET /api/ledger/due
 * Returns sales with outstanding balances and their payment histories.
 */
async function getDueLedger(req, res) {
  try {
    const result = await db.query(
      `SELECT 
         s.id AS sale_id, 
         s.customer_name, 
         s.sale_date, 
         s.total_amount, 
         s.amount_paid, 
         s.due_amount, 
         s.payment_status, 
         s.notes, 
         COALESCE(
           (
             SELECT json_agg(
               json_build_object(
                 'id', cp.id, 
                 'amount', cp.amount, 
                 'payment_date', cp.payment_date, 
                 'payment_method', cp.payment_method, 
                 'reference_number', cp.reference_number, 
                 'notes', cp.notes
               ) ORDER BY cp.payment_date DESC, cp.id DESC
             ) 
             FROM customer_payments cp 
             WHERE cp.sale_id = s.id
           ), 
           '[]'::json
         ) AS payment_history 
       FROM sales s 
       WHERE s.due_amount > 0 
         AND s.payment_status IN ('UNPAID', 'PARTIAL') 
       ORDER BY s.sale_date ASC, s.id ASC`
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get due ledger error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve the credit ledger.",
    });
  }
}

/**
 * POST /api/ledger/pay
 * Records a payment and updates the sale balance atomically.
 */
async function recordPayment(req, res) {
  const {
    sale_id,
    amount_received,
    payment_method = "cash",
    reference_number = null,
    notes = null,
  } = req.body;

  if (!isValidPositiveId(sale_id)) {
    return res.status(400).json({
      success: false,
      message: "sale_id must be a positive integer.",
    });
  }

  if (!isValidMoney(amount_received)) {
    return res.status(400).json({
      success: false,
      message: "amount_received must be a positive amount with up to 2 decimal places.",
    });
  }

  const allowedPaymentMethods = [
    "cash",
    "bank_transfer",
    "card",
    "mobile_payment",
    "other",
  ];

  if (
    typeof payment_method !== "string" ||
    !allowedPaymentMethods.includes(payment_method)
  ) {
    return res.status(400).json({
      success: false,
      message: `payment_method must be one of: ${allowedPaymentMethods.join(", ")}.`,
    });
  }

  if (
    reference_number !== null &&
    (typeof reference_number !== "string" ||
      reference_number.length > 200)
  ) {
    return res.status(400).json({
      success: false,
      message: "reference_number must be a string of at most 200 characters, or null.",
    });
  }

  if (
    notes !== null &&
    (typeof notes !== "string" || notes.length > 5000)
  ) {
    return res.status(400).json({
      success: false,
      message: "notes must be a string of at most 5000 characters, or null.",
    });
  }

  let client;
  let transactionStarted = false;

  try {
    client = await db.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    // Lock the sale so simultaneous payment requests cannot overpay it.
    const saleResult = await client.query(
      `SELECT
         id,
         customer_name,
         total_amount,
         amount_paid,
         due_amount,
         payment_status
       FROM sales
       WHERE id = $1
       FOR UPDATE`,
      [sale_id]
    );

    if (saleResult.rowCount === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: `Sale with ID ${sale_id} was not found.`,
      });
    }

    const sale = saleResult.rows[0];
    const amountReceived = Number(amount_received);
    const currentDue = Number(sale.due_amount);

    if (currentDue <= 0 || sale.payment_status === "PAID") {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message: "This sale has already been paid in full.",
        sale_id: Number(sale.id),
        due_amount: currentDue,
      });
    }

    if (amountReceived > currentDue) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "Payment cannot exceed the outstanding balance.",
        sale_id: Number(sale.id),
        due_amount: currentDue,
        amount_received: amountReceived,
      });
    }

    // Save the payment record.
    const paymentResult = await client.query(
      `INSERT INTO customer_payments
         (sale_id, amount, payment_method, reference_number, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING
         id,
         sale_id,
         amount,
         payment_date,
         payment_method,
         reference_number,
         notes`,
      [
        sale.id,
        amount_received,
        payment_method,
        reference_number,
        notes,
      ]
    );

    // Update paid and due totals in the same transaction.
    const updatedSaleResult = await client.query(
      `UPDATE sales
       SET
         due_amount = due_amount - $1,
         amount_paid = amount_paid + $1,
         payment_status = CASE
           WHEN due_amount - $1 = 0 THEN 'PAID'
           WHEN amount_paid + $1 > 0 THEN 'PARTIAL'
           ELSE 'UNPAID'
         END
       WHERE id = $2
       RETURNING
         id AS sale_id,
         customer_name,
         total_amount,
         amount_paid,
         due_amount,
         payment_status`,
      [amount_received, sale.id]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    const updatedSale = updatedSaleResult.rows[0];
    const payment = paymentResult.rows[0];

    return res.status(201).json({
      success: true,
      message: "Payment recorded successfully.",
      data: {
        payment: {
          ...payment,
          sale_id: Number(payment.sale_id),
          amount: Number(payment.amount),
        },
        sale: {
          ...updatedSale,
          sale_id: Number(updatedSale.sale_id),
          total_amount: Number(updatedSale.total_amount),
          amount_paid: Number(updatedSale.amount_paid),
          due_amount: Number(updatedSale.due_amount),
        },
      },
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Payment transaction rollback failed:",
          rollbackError.message
        );
      }
    }
    console.error("Record payment error:", error.message);

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "The payment references a sale that does not exist.",
      });
    }

    if (error.code === "23514" || error.code === "22003") {
      return res.status(400).json({
        success: false,
        message: "Payment data violates a database constraint or numeric limit.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to record payment. No payment changes were saved.",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

module.exports = {
  getDueLedger,
  recordPayment,
};