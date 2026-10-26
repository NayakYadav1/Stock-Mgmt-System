const db = require("../config/db");

function makeError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function settle({ partyId, amount, paymentMethod, referenceNumber, notes }) {
  const client = await db.connect();
  let started = false;

  try {
    await client.query("BEGIN");
    started = true;

    const party = await client.query(
      "SELECT id FROM parties WHERE id = $1 FOR UPDATE",
      [partyId]
    );
    if (!party.rowCount) throw makeError(404, "Party not found");

    const current = await client.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric(14, 2) AS balance
       FROM party_ledger_entries WHERE party_id = $1`,
      [partyId]
    );
    const balance = Number(current.rows[0].balance);

    if (balance === 0) throw makeError(409, "Party has no outstanding balance");
    if (amount > Math.abs(balance)) {
      throw makeError(400, "Payment cannot exceed the outstanding balance");
    }

    const direction = balance > 0 ? "received" : "paid";
    const payment = await client.query(
      `INSERT INTO payments
         (party_id, direction, amount, payment_method, reference_number, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, party_id, direction, amount, payment_date, payment_method`,
      [partyId, direction, amount, paymentMethod, referenceNumber, notes]
    );

    await client.query(
      `INSERT INTO party_ledger_entries
         (party_id, entry_type, payment_id, amount)
       VALUES ($1, 'payment', $2,
         CASE WHEN $3 = 'received' THEN -$4::numeric ELSE $4::numeric END)`,
      [partyId, payment.rows[0].id, direction, amount]
    );

    const updated = await client.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric(14, 2) AS balance
       FROM party_ledger_entries WHERE party_id = $1`,
      [partyId]
    );

    await client.query("COMMIT");
    started = false;

    return {
      ...payment.rows[0],
      amount: Number(payment.rows[0].amount),
      balance: Number(updated.rows[0].balance),
    };
  } catch (error) {
    if (started) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { settle };