
-- =========================================================
-- Stock Management System
-- Module 2: Database Schema
-- PostgreSQL 15
-- =========================================================

BEGIN;

-- ---------------------------------------------------------
-- 1. PRODUCTS
-- Stores products and current stock information.
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    cost_price NUMERIC(12, 2) NOT NULL CHECK (cost_price >= 0),
    selling_price NUMERIC(12, 2) NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0
        CHECK (stock_quantity >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT products_selling_price_check
        CHECK (selling_price >= cost_price)
);

-- ---------------------------------------------------------
-- 2. PURCHASES
-- Stores purchase transactions from suppliers.
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS purchases (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_name VARCHAR(200) NOT NULL,
    purchase_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0
        CHECK (total_amount >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- 3. PURCHASE ITEMS
-- Products and quantities belonging to each purchase.
-- ---------------------------------------------------------

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

-- ---------------------------------------------------------
-- 4. SALES
-- Stores sales transactions.
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS sales (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_name VARCHAR(200),
    sale_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0
        CHECK (total_amount >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- 5. SALE ITEMS
-- Products and quantities belonging to each sale.
-- Selling price must never be below cost price.
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS sale_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    cost_price NUMERIC(12, 2) NOT NULL CHECK (cost_price >= 0),
    selling_price NUMERIC(12, 2) NOT NULL,
    line_total NUMERIC(14, 2)
        GENERATED ALWAYS AS (quantity * selling_price) STORED,

    CONSTRAINT sale_items_selling_price_check
        CHECK (selling_price >= cost_price),

    CONSTRAINT sale_items_sale_fk
        FOREIGN KEY (sale_id)
        REFERENCES sales(id)
        ON DELETE CASCADE,

    CONSTRAINT sale_items_product_fk
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
);

-- ---------------------------------------------------------
-- 6. CUSTOMER PAYMENTS
-- Records payments received against individual sales.
-- Multiple payments can be recorded for one sale.
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS customer_payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_id BIGINT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
    reference_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT customer_payments_sale_fk
        FOREIGN KEY (sale_id)
        REFERENCES sales(id)
        ON DELETE RESTRICT
);

-- ---------------------------------------------------------
-- Indexes for common relationship lookups.
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id
    ON purchase_items(purchase_id);

CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id
    ON purchase_items(product_id);

CREATE INDEX IF NOT EXISTS idx_sales_sale_date
    ON sales(sale_date);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id
    ON sale_items(sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_product_id
    ON sale_items(product_id);

CREATE INDEX IF NOT EXISTS idx_customer_payments_sale_id
    ON customer_payments(sale_id);

CREATE INDEX IF NOT EXISTS idx_customer_payments_payment_date
    ON customer_payments(payment_date);

COMMIT;