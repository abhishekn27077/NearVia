-- NEARVIA Database Migration 00027: Workforce Radar & Demand Intelligence Performance
-- High-throughput partial spatial indexes and composite query indexes for hyperlocal demand and availability aggregations.

-- 1. Partial GIST index on worker_profiles for online, available workers
CREATE INDEX IF NOT EXISTS idx_worker_profiles_available_gist 
ON worker_profiles USING GIST(location) 
WHERE is_available_now = TRUE AND availability_status != 'OFFLINE';

-- 2. Partial GIST index on work_opportunities for active, published gigs
CREATE INDEX IF NOT EXISTS idx_work_opportunities_active_gist
ON work_opportunities USING GIST(location)
WHERE status IN ('PUBLISHED', 'MATCHING');

-- 3. Composite index on work_opportunities for status, category, and creation date
CREATE INDEX IF NOT EXISTS idx_work_opportunities_status_cat_created
ON work_opportunities(status, category_id, created_at);

-- 4. Composite index on agent_worker_relationships for active linked workers
CREATE INDEX IF NOT EXISTS idx_agent_worker_rel_status
ON agent_worker_relationships(agent_id, status);

-- 5. Index on completed work opportunities for recent activity analytics
CREATE INDEX IF NOT EXISTS idx_work_opportunities_completed_recent
ON work_opportunities(status, updated_at)
WHERE status = 'COMPLETED';
