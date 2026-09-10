-- ==============================================================================
-- NEARVIA Supabase Migration: PostGIS Spatial Indexes & Location Hardening
-- ==============================================================================

-- 1. Spatial GIST Index on attendance_records (check_in_location & check_out_location)
CREATE INDEX IF NOT EXISTS idx_attendance_records_checkin_location 
  ON attendance_records USING GIST(check_in_location);

CREATE INDEX IF NOT EXISTS idx_attendance_records_checkout_location 
  ON attendance_records USING GIST(check_out_location);

-- 2. Verify and guarantee GIST indexes on all core spatial geography columns
CREATE INDEX IF NOT EXISTS idx_worker_profiles_location 
  ON worker_profiles USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_provider_profiles_location 
  ON provider_profiles USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_work_opportunities_location 
  ON work_opportunities USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_agent_profiles_location 
  ON agent_profiles USING GIST(location);
