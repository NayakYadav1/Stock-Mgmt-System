const db = require("../config/db");

async function getAll(type) {
  const result = await db.query(
    `SELECT p.id, p.party_type, p.name, p.phone, p.address, p.created_at,
          COALESCE(SUM(l.amount), 0)::numeric(14, 2) AS balance
   FROM parties p
   LEFT JOIN party_ledger_entries l ON l.party_id = p.id
   WHERE ($1::text IS NULL OR p.party_type = $1 OR p.party_type = 'both')
   GROUP BY p.id
   ORDER BY p.name ASC`,
    [type]
  );

  return result.rows;
}

async function create(party) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO parties (party_type, name, phone, address)
       VALUES ($1, $2, $3, $4)
       RETURNING id, party_type, name, phone, address, created_at`,
      [party.party_type, party.name, party.phone, party.address],
    );

    const created = result.rows[0];

    if (party.opening_balance !== 0) {
      await client.query(
        `INSERT INTO party_ledger_entries (party_id, entry_type, amount)
         VALUES ($1, 'opening', $2)`,
        [created.id, party.opening_balance],
      );
    }

    await client.query("COMMIT");
    return { ...created, balance: party.opening_balance };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function update(partyId, fields) {
  const result = await db.query(
    `UPDATE parties
     SET name = CASE WHEN $2 THEN $3 ELSE name END,
         phone = CASE WHEN $4 THEN $5 ELSE phone END,
         address = CASE WHEN $6 THEN $7 ELSE address END
     WHERE id = $1
     RETURNING id, party_type, name, phone, address, created_at`,
    [
      partyId,
      Object.hasOwn(fields, "name"),
      fields.name,
      Object.hasOwn(fields, "phone"),
      fields.phone,
      Object.hasOwn(fields, "address"),
      fields.address,
    ]
  );

  return result.rows[0] || null;
}

async function remove(partyId) {
  const result = await db.query(
    `DELETE FROM parties
     WHERE id = $1
     RETURNING id, party_type, name, phone, address`,
    [partyId]
  );

  return result.rows[0] || null;
}

async function getLedger(partyId) {
  const partyResult = await db.query(
    `SELECT p.id, p.party_type, p.name, p.phone, p.address,
            COALESCE(SUM(l.amount), 0)::numeric(14, 2) AS balance
     FROM parties p
     LEFT JOIN party_ledger_entries l ON l.party_id = p.id
     WHERE p.id = $1
     GROUP BY p.id`,
    [partyId],
  );

  if (!partyResult.rowCount) return null;

  const entriesResult = await db.query(
    `SELECT l.id, l.entry_type, l.amount, l.created_at,
            t.id AS transaction_id, t.transaction_type,
            pay.id AS payment_id, pay.direction AS payment_direction,
            pay.payment_method, pay.reference_number,
            COALESCE(t.notes, pay.notes) AS notes
     FROM party_ledger_entries l
     LEFT JOIN transactions t ON t.id = l.transaction_id
     LEFT JOIN payments pay ON pay.id = l.payment_id
     WHERE l.party_id = $1
     ORDER BY l.created_at DESC, l.id DESC`,
    [partyId],
  );

  return {
    ...partyResult.rows[0],
    balance: Number(partyResult.rows[0].balance),
    entries: entriesResult.rows.map((entry) => ({
      ...entry,
      amount: Number(entry.amount),
    })),
  };
}

module.exports = { getAll, create, getLedger, update, remove };
