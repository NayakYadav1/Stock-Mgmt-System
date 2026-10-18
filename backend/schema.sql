
-- =========================================================
-- Stock Management System
-- Module 2: Database Schema
-- PostgreSQL 15
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    cost_price NUMERIC(12, 2) NOT NULL CHECK (cost_price >= 0),
    selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchases (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_name VARCHAR(200) NOT NULL,
    bill_no VARCHAR(100) NOT NULL DEFAULT '',
    purchased_by VARCHAR(200) NOT NULL,
    purchase_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    purchase_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0),
    line_total NUMERIC(14, 2)
        GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    CONSTRAINT purchase_items_purchase_fk
        FOREIGN KEY (purchase_id)
        REFERENCES purchases(id)
        ON DELETE CASCADE,
    CONSTRAINT purchase_items_product_fk
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sales (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT,
    customer_name VARCHAR(200),
    customer_phone VARCHAR(20),
    sold_by VARCHAR(200),
    sale_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (vat_rate >= 0),
    vat_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    due_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (due_amount >= 0),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID'
        CHECK (payment_status IN ('UNPAID', 'PARTIAL', 'PAID')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sales_customer_fk
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    cost_price NUMERIC(12, 2) NOT NULL CHECK (cost_price >= 0),
    selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
    line_total NUMERIC(14, 2)
        GENERATED ALWAYS AS (quantity * selling_price) STORED,
    CONSTRAINT sale_items_sale_fk
        FOREIGN KEY (sale_id)
        REFERENCES sales(id)
        ON DELETE CASCADE,
    CONSTRAINT sale_items_product_fk
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS customer_payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_id BIGINT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash'
        CHECK (payment_method IN ('cash','fonepay','bank_transfer','card','mobile_payment','other')),
    reference_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customer_payments_sale_fk
        FOREIGN KEY (sale_id)
        REFERENCES sales(id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id ON purchase_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_sale_id ON customer_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_payment_date ON customer_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'products'::regclass
          AND conname = 'products_selling_price_check'
    ) THEN
        ALTER TABLE products DROP CONSTRAINT products_selling_price_check;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sale_items'::regclass
          AND conname = 'sale_items_selling_price_check'
    ) THEN
        ALTER TABLE sale_items DROP CONSTRAINT sale_items_selling_price_check;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'customer_name'
    ) THEN
        ALTER TABLE sales ADD COLUMN customer_name VARCHAR(200);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'customer_phone'
    ) THEN
        ALTER TABLE sales ADD COLUMN customer_phone VARCHAR(20);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'sold_by'
    ) THEN
        ALTER TABLE sales ADD COLUMN sold_by VARCHAR(200);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'subtotal'
    ) THEN
        ALTER TABLE sales ADD COLUMN subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'vat_rate'
    ) THEN
        ALTER TABLE sales ADD COLUMN vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'vat_amount'
    ) THEN
        ALTER TABLE sales ADD COLUMN vat_amount NUMERIC(14, 2) NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'amount_paid'
    ) THEN
        ALTER TABLE sales ADD COLUMN amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'due_amount'
    ) THEN
        ALTER TABLE sales ADD COLUMN due_amount NUMERIC(14, 2) NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE sales ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchases' AND column_name = 'bill_no'
    ) THEN
        ALTER TABLE purchases ADD COLUMN bill_no VARCHAR(100) NOT NULL DEFAULT '';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchases' AND column_name = 'purchased_by'
    ) THEN
        ALTER TABLE purchases ADD COLUMN purchased_by VARCHAR(200) NOT NULL DEFAULT '';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE sales ADD COLUMN customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL;
    END IF;
END $$;

ALTER TABLE sales
    ALTER COLUMN payment_status TYPE VARCHAR(20),
    ALTER COLUMN total_amount SET DEFAULT 0,
    ALTER COLUMN amount_paid SET DEFAULT 0,
    ALTER COLUMN due_amount SET DEFAULT 0,
    ALTER COLUMN payment_status SET DEFAULT 'UNPAID';

COMMIT;