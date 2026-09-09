-- Migration: 00015_worker_availability_freshness.sql
-- Adds availability timestamps and freshness indexes to worker_profiles

ALTER TABLE worker_profiles 
ADD COLUMN IF NOT EXISTS availability_updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill any existing records
UPDATE worker_profiles 
SET availability_updated_at = COALESCE(updated_at, NOW()),
    last_seen_at = COALESCE(updated_at, NOW())
WHERE availability_updated_at IS NULL;

-- Index for fast querying of fresh, available workers
CREATE INDEX IF NOT EXISTS idx_worker_profiles_availability_freshness 
ON worker_profiles(is_available_now, availability_updated_at)
WHERE is_available_now = TRUE;
