-- ==============================================================================
-- NEARVIA Database Migration 00009: Phase 5 Real-Time Marketplace & Workforce Radar
-- ==============================================================================

-- 1. Extend worker_profiles with availability preferences
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS preferred_job_types TEXT[] DEFAULT ARRAY['HOURLY', 'DAILY', 'TASK', 'SHIFT'],
  ADD COLUMN IF NOT EXISTS preferred_categories UUID[],
  ADD COLUMN IF NOT EXISTS preferred_skills UUID[];

-- 2. Extend work_opportunities with recurring schedule and instant job metadata
ALTER TABLE work_opportunities
  ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(20) DEFAULT 'ONE_TIME' NOT NULL CHECK (schedule_type IN ('ONE_TIME', 'RECURRING')),
  ADD COLUMN IF NOT EXISTS recurring_pattern VARCHAR(100),
  ADD COLUMN IF NOT EXISTS recurring_days VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_instant BOOLEAN DEFAULT FALSE NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_opportunities_schedule_type ON work_opportunities(schedule_type);
CREATE INDEX IF NOT EXISTS idx_work_opportunities_is_instant ON work_opportunities(is_instant) WHERE is_instant = TRUE;

-- 3. Create Preferred Workers Table (Provider -> Worker affinity)
CREATE TABLE IF NOT EXISTS preferred_workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(provider_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_preferred_workers_provider ON preferred_workers(provider_id);
CREATE INDEX IF NOT EXISTS idx_preferred_workers_worker ON preferred_workers(worker_id);

-- 4. Create Preferred Providers Table (Worker -> Provider affinity)
CREATE TABLE IF NOT EXISTS preferred_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(worker_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_preferred_providers_worker ON preferred_providers(worker_id);
CREATE INDEX IF NOT EXISTS idx_preferred_providers_provider ON preferred_providers(provider_id);

-- 5. Create Replacement Requests Table (No-Show / Unavailability Replacement Audit)
CREATE TABLE IF NOT EXISTS replacement_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  previous_worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING', 'MATCHED', 'ASSIGNED', 'CANCELLED')),
  replacement_assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_replacement_requests_orig_assignment ON replacement_requests(original_assignment_id);
CREATE INDEX IF NOT EXISTS idx_replacement_requests_provider ON replacement_requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_replacement_requests_status ON replacement_requests(status);
