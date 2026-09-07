-- ==============================================================================
-- NEARVIA Database Migration 00011: Phase 7 Payment Operations, Cash, Receipts & Reconciliation
-- ==============================================================================

-- 1. Extend payment_records table with cash dual-confirmation, PIN security, platform fee and reconciliation
ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS amount_paise INT,
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
  ADD COLUMN IF NOT EXISTS platform_fee_paise INT DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS net_payout NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS net_payout_paise INT,
  ADD COLUMN IF NOT EXISTS payment_pin VARCHAR(10),
  ADD COLUMN IF NOT EXISTS payment_pin_attempts INT DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS payment_pin_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cash_confirmed_by_payer_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cash_confirmed_by_payee_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(30) DEFAULT 'MATCHED' NOT NULL,
  ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- 2. Extend assignments table with payment_method and payment_reference
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255);

-- 3. Indexes for high-throughput lookup & reconciliation
CREATE INDEX IF NOT EXISTS idx_payment_records_gateway_order ON payment_records(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_idempotency ON payment_records(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payment_records_method ON payment_records(payment_method);
CREATE INDEX IF NOT EXISTS idx_payment_records_reconciliation ON payment_records(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_payment_records_status_recorded ON payment_records(status, recorded_at DESC);

-- 4. Backfill amount_paise and net_payout for existing payment records
UPDATE payment_records
SET amount_paise = ROUND(amount * 100),
    net_payout = amount - platform_fee,
    net_payout_paise = ROUND((amount - platform_fee) * 100)
WHERE amount_paise IS NULL;
