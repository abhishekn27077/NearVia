-- ==============================================================================
-- Migration: 00024_agent_assisted_workflow_hardening.sql
-- Purpose: Prompt 10 — Agent-Assisted Worker Workflow Hardening
-- Adds:
--   1. Self-relationship prevention trigger on agent_worker_relationships
--   2. Composite index for active agent-worker relationships
--   3. Index for agent-assisted applications
-- ==============================================================================

-- 1. Self-relationship prevention trigger
CREATE OR REPLACE FUNCTION check_agent_worker_distinct_users()
RETURNS TRIGGER AS $$
DECLARE
  v_agent_user_id UUID;
  v_worker_user_id UUID;
BEGIN
  SELECT user_id INTO v_agent_user_id FROM agent_profiles WHERE id = NEW.agent_id;
  SELECT user_id INTO v_worker_user_id FROM worker_profiles WHERE id = NEW.worker_id;

  IF v_agent_user_id IS NOT NULL AND v_worker_user_id IS NOT NULL AND v_agent_user_id = v_worker_user_id THEN
    RAISE EXCEPTION 'An agent cannot establish an assistance relationship with themselves';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_agent_worker_distinct_users ON agent_worker_relationships;
CREATE TRIGGER trg_check_agent_worker_distinct_users
BEFORE INSERT OR UPDATE OF agent_id, worker_id ON agent_worker_relationships
FOR EACH ROW
EXECUTE FUNCTION check_agent_worker_distinct_users();

-- 2. Performance indexes for agent-worker lookups
CREATE INDEX IF NOT EXISTS idx_awr_agent_worker_active
  ON agent_worker_relationships(agent_id, worker_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_applications_assisted_by_agent
  ON applications(assisted_by_agent_id)
  WHERE assisted_by_agent_id IS NOT NULL;
