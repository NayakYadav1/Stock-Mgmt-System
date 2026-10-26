const db = require("../config/db");

function makeError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function createPurchase({
  partyId,
  items,
  amountPaid,
  paymentMethod,
  referenceNumber,
  notes,
}) {
  const client = await db.connect();
  let started = false;

  try {
    await client.query("BEGIN");
    started = true;

    const party = await client.query(
      "SELECT id, party_type FROM parties WHERE id = $1 FOR UPDATE",
      [partyId]
    );

    if (!party.rowCount) throw makeError(404, "Supplier not found");
    if (!["supplier", "both"].includes(party.rows[0].party_type)) {
      throw makeError(400, "Party is not a supplier");
    }

    const ids = [...new Set(items.map((item) => item.product_id))];
    const products = await client.query(
      `SELECT id FROM products
       WHERE id = ANY($1::bigint[])
       ORDER BY id FOR UPDATE`,
      [ids]
    );

    if (products.rowCount !== ids.length) {
      throw makeError(404, "One or more products were not found");
    }

    const created = await client.query(
      `INSERT INTO transactions (transaction_type, party_id, notes)
       VALUES ('purchase', $1, $2)
       RETURNING id, transaction_type, party_id, transaction_date`,
      [partyId, notes]
    );

    const transaction = created.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO transaction_items
           (transaction_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [transaction.id, item.product_id, item.quantity, item.unit_price]
      );

      await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    const total = await client.query(
      `SELECT COALESCE(SUM(line_total), 0)::numeric(14, 2) AS amount
       FROM transaction_items WHERE transaction_id = $1`,
      [transaction.id]
    );

    const amount = total.rows[0].amount;

    if (amountPaid > Number(amount)) {
      throw makeError(400, "amount_paid cannot exceed the purchase total");
    }

    await client.query(
      "UPDATE transactions SET total_amount = $1 WHERE id = $2",
      [amount, transaction.id]
    );

    if (Number(amount) > 0) {
      await client.query(
        `INSERT INTO party_ledger_entries
           (party_id, entry_type, transaction_id, amount)
         VALUES ($1, 'purchase', $2, -$3::numeric)`,
        [partyId, transaction.id, amount]
      );
      if (amountPaid > 0) {
  const payment = await client.query(
    `INSERT INTO payments
       (party_id, transaction_id, direction, amount, payment_method,
        reference_number, notes)
     VALUES ($1, $2, 'paid', $3, $4, $5, $6)
     RETURNING id`,
    [partyId, transaction.id, amountPaid, paymentMethod, referenceNumber, notes]
  );

  await client.query(
    `INSERT INTO party_ledger_entries
       (party_id, entry_type, payment_id, amount)
     VALUES ($1, 'payment', $2, $3::numeric)`,
    [partyId, payment.rows[0].id, amountPaid]
  );
}
    }

    await client.query("COMMIT");
    started = false;

    return {
  ...transaction,
  total_amount: Number(amount),
  amount_paid: amountPaid,
  outstanding_balance: Number((Number(amount) - amountPaid).toFixed(2)),
};
  } catch (error) {
    if (started) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Implement Sale Out
async function createSale({
  partyId,
  items,
  amountReceived,
  paymentMethod,
  referenceNumber,
  notes,
}) {
  const client = await db.connect();
  let started = false;

  try {
    await client.query("BEGIN");
    started = true;

    const party = await client.query(
      "SELECT id, party_type FROM parties WHERE id = $1 FOR UPDATE",
      [partyId]
    );

    if (!party.rowCount) throw makeError(404, "Customer not found");
    if (!["customer", "both"].includes(party.rows[0].party_type)) {
      throw makeError(400, "Party is not a customer");
    }

    const ids = [...new Set(items.map((item) => item.product_id))];
    const result = await client.query(
      `SELECT id, selling_price, stock_quantity
       FROM products
       WHERE id = ANY($1::bigint[])
       ORDER BY id FOR UPDATE`,
      [ids]
    );

    if (result.rowCount !== ids.length) {
      throw makeError(404, "One or more products were not found");
    }

    const products = new Map(result.rows.map((p) => [Number(p.id), p]));
    const transactionResult = await client.query(
      `INSERT INTO transactions (transaction_type, party_id, notes)
       VALUES ('sale', $1, $2)
       RETURNING id, transaction_type, party_id, transaction_date`,
      [partyId, notes]
    );
    const transaction = transactionResult.rows[0];

    for (const item of items) {
      const product = products.get(item.product_id);
      const price = item.unit_price ?? Number(product.selling_price);

      if (Number(product.stock_quantity) < item.quantity) {
        throw makeError(409, `Insufficient stock for product ${item.product_id}`);
      }

      await client.query(
        `INSERT INTO transaction_items
           (transaction_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [transaction.id, item.product_id, item.quantity, price]
      );

      const stockUpdate = await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity - $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND stock_quantity >= $1
         RETURNING id`,
        [item.quantity, item.product_id]
      );

      if (!stockUpdate.rowCount) {
        throw makeError(409, `Insufficient stock for product ${item.product_id}`);
      }
    }

    const totalResult = await client.query(
      `SELECT COALESCE(SUM(line_total), 0)::numeric(14, 2) AS amount
       FROM transaction_items WHERE transaction_id = $1`,
      [transaction.id]
    );
    const total = Number(totalResult.rows[0].amount);

    if (amountReceived > total) {
      throw makeError(400, "amount_received cannot exceed the sale total");
    }

    await client.query(
      "UPDATE transactions SET total_amount = $1 WHERE id = $2",
      [total, transaction.id]
    );

    if (total > 0) {
      await client.query(
        `INSERT INTO party_ledger_entries
           (party_id, entry_type, transaction_id, amount)
         VALUES ($1, 'sale', $2, $3::numeric)`,
        [partyId, transaction.id, total]
      );
    }

    if (amountReceived > 0) {
      const payment = await client.query(
        `INSERT INTO payments
           (party_id, transaction_id, direction, amount, payment_method,
            reference_number, notes)
         VALUES ($1, $2, 'received', $3, $4, $5, $6)
         RETURNING id`,
        [partyId, transaction.id, amountReceived, paymentMethod, referenceNumber, notes]
      );

      await client.query(
        `INSERT INTO party_ledger_entries
           (party_id, entry_type, payment_id, amount)
         VALUES ($1, 'payment', $2, -($3::numeric))`,
        [partyId, payment.rows[0].id, amountReceived]
      );
    }

    await client.query("COMMIT");
    started = false;

    return {
      ...transaction,
      total_amount: total,
      amount_received: amountReceived,
      outstanding_balance: Number((total - amountReceived).toFixed(2)),
    };
  } catch (error) {
    if (started) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getAll() {
  const result = await db.query(`
    SELECT t.id, t.transaction_type, t.party_id, p.name AS party_name,
           t.transaction_date, t.total_amount, t.notes,
           COALESCE((
             SELECT json_agg(json_build_object(
               'product_id', i.product_id,
               'sku', pr.sku,
               'product_name', pr.name,
               'quantity', i.quantity,
               'unit_price', i.unit_price,
               'line_total', i.line_total
             ) ORDER BY i.id)
             FROM transaction_items i
             JOIN products pr ON pr.id = i.product_id
             WHERE i.transaction_id = t.id
           ), '[]'::json) AS items
    FROM transactions t
    JOIN parties p ON p.id = t.party_id
    ORDER BY t.transaction_date DESC, t.id DESC
  `);

  return result.rows;
}

module.exports = { createPurchase, createSale, getAll };