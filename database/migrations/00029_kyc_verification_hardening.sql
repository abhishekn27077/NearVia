-- ==============================================================================
-- Migration 00029: KYC Verification Hardening & Private Storage Integration
-- ==============================================================================
-- 1. Add RESUBMISSION_REQUIRED status to verification_status enum
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'RESUBMISSION_REQUIRED';

-- 2. Add notes column for internal admin review commentary & audit context
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Add storage_path column for private Supabase Storage object reference
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500);

-- 4. Composite index for fast user verification status lookups
CREATE INDEX IF NOT EXISTS idx_verifications_target_status ON verifications (target_id, status);
