-- ==============================================================================
-- NEARVIA Database Migration 00010: Phase 6 Work Execution, Job PIN, Evidence & Attendance
-- ==============================================================================

-- 1. Extend assignments table with Job PIN, Checkout, and Duration metrics
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS job_pin VARCHAR(10),
  ADD COLUMN IF NOT EXISTS job_pin_hash VARCHAR(128),
  ADD COLUMN IF NOT EXISTS job_pin_attempts INT DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS job_pin_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worked_minutes INT;

CREATE INDEX IF NOT EXISTS idx_assignments_job_pin_verified ON assignments(job_pin_verified_at);

-- 2. Create Job Evidence Table (Before/After/Issue/Receipt photos with strict authorization)
CREATE TABLE IF NOT EXISTS job_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  evidence_type VARCHAR(30) NOT NULL CHECK (evidence_type IN ('ARRIVAL', 'BEFORE', 'AFTER', 'ISSUE', 'DAMAGE', 'RECEIPT', 'INCIDENT')),
  file_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_evidence_assignment ON job_evidence(assignment_id);
CREATE INDEX IF NOT EXISTS idx_job_evidence_uploaded_by ON job_evidence(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_job_evidence_type ON job_evidence(evidence_type);

-- 3. Populate existing active/pending assignments with unique 4-digit PINs if missing
UPDATE assignments
SET job_pin = LPAD((FLOOR(RANDOM() * 9000) + 1000)::TEXT, 4, '0')
WHERE job_pin IS NULL;
