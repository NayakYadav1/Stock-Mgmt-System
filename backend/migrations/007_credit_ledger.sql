ALTER TABLE sales
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(14, 2),
ADD COLUMN IF NOT EXISTS due_amount NUMERIC(14, 2),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20);

-- Initialize existing sales as unpaid.
-- Only backfill rows where the new fields have not been initialized.
UPDATE sales
SET
amount_paid = COALESCE(amount_paid, 0),
due_amount = COALESCE(due_amount, total_amount),
payment_status = COALESCE(
payment_status,
CASE
WHEN COALESCE(total_amount, 0) = 0 THEN 'PAID'
ELSE 'UNPAID'
END
)
WHERE amount_paid IS NULL
OR due_amount IS NULL
OR payment_status IS NULL;

ALTER TABLE sales
ALTER COLUMN amount_paid SET DEFAULT 0,
ALTER COLUMN amount_paid SET NOT NULL,
ALTER COLUMN due_amount SET NOT NULL,
ALTER COLUMN payment_status SET DEFAULT 'UNPAID',
ALTER COLUMN payment_status SET NOT NULL;

ALTER TABLE sales
ADD CONSTRAINT sales_amount_paid_nonnegative
CHECK (amount_paid >= 0),
ADD CONSTRAINT sales_due_amount_nonnegative
CHECK (due_amount >= 0),
ADD CONSTRAINT sales_payment_status_valid
CHECK (payment_status IN ('UNPAID', 'PARTIAL', 'PAID')),
ADD CONSTRAINT sales_payment_totals_match
CHECK (amount_paid + due_amount = total_amount);
