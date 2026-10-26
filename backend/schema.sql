BEGIN;

CREATE TABLE IF NOT EXISTS products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    cost_price NUMERIC(12, 2) NOT NULL CHECK (cost_price >= 0),
    selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parties (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    party_type VARCHAR(20) NOT NULL
        CHECK (party_type IN ('customer', 'supplier', 'both')),
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(30),
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('purchase', 'sale')),
    party_id BIGINT NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transaction_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transaction_id BIGINT NOT NULL
        REFERENCES transactions(id) ON DELETE RESTRICT,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    line_total NUMERIC(14, 2)
        GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    party_id BIGINT NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    transaction_id BIGINT REFERENCES transactions(id) ON DELETE RESTRICT,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('received', 'paid')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'cash',
    reference_number VARCHAR(100),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS party_ledger_entries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    party_id BIGINT NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    entry_type VARCHAR(20) NOT NULL
        CHECK (entry_type IN ('opening', 'sale', 'purchase', 'payment')),
    transaction_id BIGINT REFERENCES transactions(id) ON DELETE RESTRICT,
    payment_id BIGINT REFERENCES payments(id) ON DELETE RESTRICT,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount <> 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (entry_type = 'opening' AND transaction_id IS NULL AND payment_id IS NULL)
        OR (entry_type IN ('sale', 'purchase')
            AND transaction_id IS NOT NULL AND payment_id IS NULL)
        OR (entry_type = 'payment'
            AND transaction_id IS NULL AND payment_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_transactions_party_date
    ON transactions(party_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction
    ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product
    ON transaction_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_party_date
    ON payments(party_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_party_ledger_party
    ON party_ledger_entries(party_id, created_at);

COMMIT;