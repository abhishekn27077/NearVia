-- ==============================================================================
-- Migration: 00005_reports_disputes_safety.sql
-- Purpose: Schema enhancements for Phase 15 (Reviews, Disputes & Safety)
-- ==============================================================================

-- 1. Ensure report_status enum contains 'RESOLVED'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'report_status'::regtype 
        AND enumlabel = 'RESOLVED'
    ) THEN
        ALTER TYPE report_status ADD VALUE 'RESOLVED';
    END IF;
END $$;

-- 2. Add evidence URLs array and category column to reports
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS evidence_urls TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- 3. Add evidence URLs array to disputes
ALTER TABLE disputes
ADD COLUMN IF NOT EXISTS evidence_urls TEXT[] DEFAULT '{}';

-- 4. Create partial unique index to prevent duplicate active disputes on the same assignment by same initiator
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_dispute_per_assignment_initiator
ON disputes (assignment_id, initiator_id)
WHERE status IN ('OPEN', 'UNDER_REVIEW');

-- 5. Additional indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_disputes_initiator ON disputes(initiator_id);
CREATE INDEX IF NOT EXISTS idx_disputes_respondent ON disputes(respondent_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_entity, target_id);
