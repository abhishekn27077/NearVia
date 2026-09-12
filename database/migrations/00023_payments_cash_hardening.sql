-- ==============================================================================
-- NEARVIA Database Migration 00023: Payments, Cash & Settlement Hardening
-- ==============================================================================

-- 1. Enforce amount_paise > 0 constraint
ALTER TABLE payment_records 
  DROP CONSTRAINT IF EXISTS chk_payment_records_amount_paise_positive;

ALTER TABLE payment_records 
  ADD CONSTRAINT chk_payment_records_amount_paise_positive 
  CHECK (amount_paise IS NULL OR amount_paise > 0);

-- 2. Prevent duplicate successful settlements for the same assignment
-- Exactly one CONFIRMED payment record may exist per assignment
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_records_unique_settled_assignment 
  ON payment_records (assignment_id) 
  WHERE status = 'CONFIRMED';

-- 3. Optimized index for pending cash settlements
CREATE INDEX IF NOT EXISTS idx_payment_records_cash_pending 
  ON payment_records (assignment_id) 
  WHERE payment_method = 'CASH' AND status = 'PENDING';

-- 4. Audit timestamp index for worker earnings
CREATE INDEX IF NOT EXISTS idx_payment_records_payee_status_recorded
  ON payment_records (payee_id, status, recorded_at DESC);

-- 5. Audit timestamp index for provider payments
CREATE INDEX IF NOT EXISTS idx_payment_records_payer_status_recorded
  ON payment_records (payer_id, status, recorded_at DESC);
