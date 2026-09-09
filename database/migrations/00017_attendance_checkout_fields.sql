-- ==============================================================================
-- NEARVIA Database Migration 00017: Attendance Check-Out, Proximity & Job PIN Enhancements
-- ==============================================================================

-- 1. Extend attendance_records with Check-Out timestamps and location metrics
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS check_out_location GEOGRAPHY(Point, 4326),
  ADD COLUMN IF NOT EXISTS check_out_distance_meters NUMERIC(10, 2);

-- 2. Extend assignments table with check_out_distance_meters
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS check_out_distance_meters NUMERIC(10, 2);

-- 3. Ensure assignments.job_pin has a default 4-digit generator
ALTER TABLE assignments
  ALTER COLUMN job_pin SET DEFAULT LPAD((FLOOR(RANDOM() * 9000) + 1000)::TEXT, 4, '0');

-- 4. Populate any existing assignments with NULL job_pin
UPDATE assignments
SET job_pin = LPAD((FLOOR(RANDOM() * 9000) + 1000)::TEXT, 4, '0')
WHERE job_pin IS NULL;

-- 5. Add indexes for performance & fast lookup
CREATE INDEX IF NOT EXISTS idx_attendance_records_assignment_id ON attendance_records(assignment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_checkout_time ON attendance_records(check_out_time);
