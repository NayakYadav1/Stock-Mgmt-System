const db = require("../config/db");

async function getAll() {
  const result = await db.query(`
    SELECT p.id, p.party_type, p.name, p.phone, p.address, p.created_at,
           COALESCE(SUM(l.amount), 0)::numeric(14, 2) AS balance
    FROM parties p
    LEFT JOIN party_ledger_entries l ON l.party_id = p.id
    GROUP BY p.id
    ORDER BY p.name ASC
  `);

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
      [party.party_type, party.name, party.phone, party.address]
    );

    const created = result.rows[0];

    if (party.opening_balance !== 0) {
      await client.query(
        `INSERT INTO party_ledger_entries (party_id, entry_type, amount)
         VALUES ($1, 'opening', $2)`,
        [created.id, party.opening_balance]
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

module.exports = { getAll, create };