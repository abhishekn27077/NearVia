-- ==============================================================================
-- NEARVIA Database Migration 00003: Phase 10 Work Execution & Attendance Fields
-- ==============================================================================

-- 1. Add Execution Timestamps, Cancellation, and Check-In Fields to assignments
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS completion_notes TEXT,
  ADD COLUMN IF NOT EXISTS check_in_location GEOGRAPHY(Point, 4326),
  ADD COLUMN IF NOT EXISTS check_in_distance_meters NUMERIC(10, 2);

-- 2. Create Attendance Records Table for granular attendance and verification audit trail
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE RESTRICT,
  check_in_time TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  check_in_location GEOGRAPHY(Point, 4326),
  distance_meters NUMERIC(10, 2),
  verified_by_provider BOOLEAN DEFAULT FALSE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_assignment ON attendance_records(assignment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_worker ON attendance_records(worker_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_checkin_time ON attendance_records(check_in_time);
