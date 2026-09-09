-- ==============================================================================
-- Migration: 00014_v1_email_verification_and_optional_phone.sql
-- Purpose: NEARVIA V1 Free-First Authentication
--          1. Make phone column optional (DROP NOT NULL)
--          2. Add email_verified and email_verified_at columns to users
--          3. Deprecate otp_challenges table for V1
-- ==============================================================================

-- 1. Make phone optional on public.users
ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;

-- 2. Add email verification columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- 3. Mark existing demo/seed users as email verified
UPDATE public.users 
SET email_verified = TRUE, email_verified_at = NOW() 
WHERE email_verified IS FALSE 
  AND (email LIKE '%@nearvia.test' OR email LIKE '%@nearvia.in');

-- 4. Deprecate otp_challenges table for V1 (retained for schema compatibility / V2)
COMMENT ON TABLE otp_challenges IS 'DEPRECATED FOR V1: SMS OTP is excluded from V1 in favor of free Supabase email verification';
