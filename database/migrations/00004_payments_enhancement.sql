-- ==============================================================================
-- Migration: 00004_payments_enhancement.sql
-- Purpose: Phase 14 — Payments, Earnings & Settlement Enhancements
-- Adds: Idempotency keys, gateway order tracking, and index optimizations
-- ==============================================================================

-- 1. Add idempotency and gateway tracking fields to payment_records
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(255);
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(255);
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS gateway_signature VARCHAR(255);
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS amount_paise BIGINT;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- 2. Indexes for fast lookups & idempotency checking
CREATE INDEX IF NOT EXISTS idx_payment_records_idempotency ON payment_records(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payment_records_gateway_order ON payment_records(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_status ON payment_records(status);
CREATE INDEX IF NOT EXISTS idx_payment_records_recorded_at ON payment_records(recorded_at DESC);
