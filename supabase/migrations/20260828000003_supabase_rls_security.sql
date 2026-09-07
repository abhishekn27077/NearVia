-- ==============================================================================
-- Migration: 20260828000003_supabase_rls_security.sql
-- Purpose: Supabase Row Level Security (RLS) and Security Policies
-- ==============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_opportunity_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_worker_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Public Read Policies for Taxonomy & Public Discovery
DROP POLICY IF EXISTS "Allow public read on active categories" ON categories;
CREATE POLICY "Allow public read on active categories"
  ON categories FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Allow public read on active skills" ON skills;
CREATE POLICY "Allow public read on active skills"
  ON skills FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Allow public read on published work opportunities" ON work_opportunities;
CREATE POLICY "Allow public read on published work opportunities"
  ON work_opportunities FOR SELECT
  USING (status IN ('PUBLISHED', 'MATCHING', 'PARTIALLY_FILLED'));

DROP POLICY IF EXISTS "Allow public read on work opportunity skills" ON work_opportunity_skills;
CREATE POLICY "Allow public read on work opportunity skills"
  ON work_opportunity_skills FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Allow public read on worker profiles for matching" ON worker_profiles;
CREATE POLICY "Allow public read on worker profiles for matching"
  ON worker_profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Allow public read on provider profiles" ON provider_profiles;
CREATE POLICY "Allow public read on provider profiles"
  ON provider_profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Allow public read on reviews" ON reviews;
CREATE POLICY "Allow public read on reviews"
  ON reviews FOR SELECT USING (TRUE);

-- 3. Service Role & Authenticated Access (API Gateway Service Role Bypass)
-- When accessed via the Node.js/Express backend using the service_role key or direct connection string,
-- Postgres bypasses RLS, ensuring high performance server-side validation and authorization.
