-- ==============================================================================
-- Migration: 20260829000002_allow_nullable_initial_location.sql
-- Purpose: Allow initial registration before location configuration
-- ==============================================================================

-- 1. Drop NOT NULL on worker_profiles.location for graceful initial sign-up
ALTER TABLE worker_profiles ALTER COLUMN location DROP NOT NULL;

-- 2. Drop NOT NULL on provider_profiles.location for graceful initial sign-up
ALTER TABLE provider_profiles ALTER COLUMN location DROP NOT NULL;

-- 3. Set default geodesic point to Bangalore central (12.9716, 77.5946) if not provided
ALTER TABLE worker_profiles ALTER COLUMN location SET DEFAULT ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326);
ALTER TABLE provider_profiles ALTER COLUMN location SET DEFAULT ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326);
