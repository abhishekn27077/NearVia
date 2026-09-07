-- ==============================================================================
-- Migration: 20260829000001_profiles_and_verification.sql
-- Purpose: User Profile Enhancements, Verification Statuses, and Constraints
-- ==============================================================================

-- 1. Add verification and metadata columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT 'English';
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_text TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_provider VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_reference VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

-- 2. Ensure applications has unique constraint on (work_opportunity_id, worker_id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_applications_job_worker'
  ) THEN
    ALTER TABLE applications ADD CONSTRAINT uq_applications_job_worker UNIQUE (work_opportunity_id, worker_id);
  END IF;
END $$;

-- 3. Add is_demo flag to work_opportunities for safe demo data identification
ALTER TABLE work_opportunities ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

-- 4. Create or replace profiles compatibility view
CREATE OR REPLACE VIEW profiles AS
SELECT 
  u.id,
  u.auth_id,
  u.full_name,
  u.email,
  u.phone,
  u.role,
  u.avatar_url,
  u.language,
  u.latitude,
  u.longitude,
  u.location_text,
  u.mobile_verified,
  u.mobile_verified_at,
  u.identity_verified,
  u.identity_verified_at,
  u.verification_provider,
  u.verification_reference,
  u.profile_completed,
  u.is_demo,
  u.is_active,
  u.created_at,
  u.updated_at
FROM users u;
