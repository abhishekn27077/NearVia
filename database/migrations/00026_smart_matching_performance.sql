-- ==============================================================================
-- NEARVIA Database Migration 00026: Smart Matching & Performance Indexing
-- ==============================================================================

-- 1. Composite Index on active work opportunities for fast discovery & matching
CREATE INDEX IF NOT EXISTS idx_work_opportunities_matching_active 
  ON work_opportunities(status, work_date, workers_assigned, workers_needed) 
  WHERE status IN ('PUBLISHED', 'MATCHING');

-- 2. Index for preferred worker lookup (Provider -> Worker)
CREATE INDEX IF NOT EXISTS idx_preferred_workers_provider_worker 
  ON preferred_workers(provider_id, worker_id);

-- 3. Composite Index on applications by opportunity and status for fast applicant ranking
CREATE INDEX IF NOT EXISTS idx_applications_opp_status 
  ON applications(work_opportunity_id, status);

-- 4. Composite Index for worker skills batch fetching
CREATE INDEX IF NOT EXISTS idx_worker_skills_worker_skill 
  ON worker_skills(worker_id, skill_id);

-- 5. Composite Index for work opportunity required skills batch fetching
CREATE INDEX IF NOT EXISTS idx_work_opp_skills_opp_skill 
  ON work_opportunity_skills(work_opportunity_id, skill_id);
