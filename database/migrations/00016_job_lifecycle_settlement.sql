-- ==============================================================================
-- NEARVIA Database Migration 00016: Phase 11 Job Lifecycle Settlement & Concurrency
-- ==============================================================================

-- 1. Extend work_opportunity_status enum with settlement and completion states
ALTER TYPE work_opportunity_status ADD VALUE IF NOT EXISTS 'SETTLEMENT_PENDING';
ALTER TYPE work_opportunity_status ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE work_opportunity_status ADD VALUE IF NOT EXISTS 'CLOSED';

-- 2. Extend assignment_status enum with settlement states if not present
ALTER TYPE assignment_status ADD VALUE IF NOT EXISTS 'SETTLEMENT_PENDING';
ALTER TYPE assignment_status ADD VALUE IF NOT EXISTS 'CLOSED';

-- 3. Prevent duplicate active assignments per worker on the same work opportunity
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_unique_active_worker 
ON assignments (work_opportunity_id, worker_id) 
WHERE status IN ('ASSIGNED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS');
