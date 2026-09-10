-- ==============================================================================
-- NEARVIA Database Migration: Marketplace Lifecycle Integrity & Concurrency
-- Mirror of 00021_marketplace_lifecycle_integrity.sql
-- ==============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_assignment_active_application 
ON assignments(application_id) 
WHERE status NOT IN ('CANCELLED', 'NO_SHOW', 'REPLACED');

CREATE INDEX IF NOT EXISTS idx_applications_opp_status 
ON applications(work_opportunity_id, status);

CREATE INDEX IF NOT EXISTS idx_assignments_opp_status 
ON assignments(work_opportunity_id, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_assigned_count'
  ) THEN
    ALTER TABLE work_opportunities 
    ADD CONSTRAINT chk_assigned_count CHECK (workers_assigned <= workers_needed);
  END IF;
END $$;
