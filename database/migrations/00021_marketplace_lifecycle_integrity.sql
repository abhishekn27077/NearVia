-- ==============================================================================
-- NEARVIA Database Migration 00021: Complete Marketplace Lifecycle Integrity
-- ==============================================================================

-- 1. Ensure exactly one active assignment per application
-- If an application has an active (non-cancelled, non-no-show) assignment,
-- prevent creating a duplicate assignment for the same application.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_assignment_active_application 
ON assignments(application_id) 
WHERE status NOT IN ('CANCELLED', 'NO_SHOW', 'REPLACED');

-- 2. Performance & Concurrency Indexes for Lifecycle State Queries
-- Fast lookup and atomic locking for applications by opportunity and status
CREATE INDEX IF NOT EXISTS idx_applications_opp_status 
ON applications(work_opportunity_id, status);

-- Fast lookup for assignments by opportunity and status (for capacity counts and settlement)
CREATE INDEX IF NOT EXISTS idx_assignments_opp_status 
ON assignments(work_opportunity_id, status);

-- 3. Ensure workers_assigned <= workers_needed constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_assigned_count'
  ) THEN
    ALTER TABLE work_opportunities 
    ADD CONSTRAINT chk_assigned_count CHECK (workers_assigned <= workers_needed);
  END IF;
END $$;
