-- ==============================================================================
-- Migration: 00003_agent_worker_relationships.sql
-- Purpose: Phase 13 — Agent-Assisted Job Access
-- Adds: agent_worker_relationships table, agent profile enhancements,
--        assisted_by_agent_id on applications
-- ==============================================================================

-- 1. ENUM for agent-worker relationship status
DO $$ BEGIN
  CREATE TYPE agent_worker_status AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Agent-Worker Relationships (Consent-based)
CREATE TABLE IF NOT EXISTS agent_worker_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE RESTRICT,
  worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE RESTRICT,
  status agent_worker_status DEFAULT 'PENDING' NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by VARCHAR(10), -- 'WORKER' or 'AGENT'
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(agent_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_awr_agent ON agent_worker_relationships(agent_id);
CREATE INDEX IF NOT EXISTS idx_awr_worker ON agent_worker_relationships(worker_id);
CREATE INDEX IF NOT EXISTS idx_awr_status ON agent_worker_relationships(status);

-- 3. Enhance agent_profiles with description, languages, and location
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS location GEOGRAPHY(Point, 4326);
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS address_approximate TEXT;

-- 4. Add assisted_by_agent_id to applications for audit
ALTER TABLE applications ADD COLUMN IF NOT EXISTS assisted_by_agent_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL;
