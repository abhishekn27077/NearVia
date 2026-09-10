-- ==============================================================================
-- Supabase Migration: 20260909000001_final_rls_and_integrity.sql
-- Purpose: Complete Supabase / PostgreSQL RLS & Database Integrity Hardening (Prompt 2)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Ensure Table Structure & Missing Tables (e.g. webhook_events, job_evidence)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(50) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  status VARCHAR(30) DEFAULT 'PROCESSED' NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_provider_event_id UNIQUE (provider, event_id)
);

CREATE TABLE IF NOT EXISTS job_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  evidence_type VARCHAR(30) NOT NULL CHECK (evidence_type IN ('ARRIVAL', 'BEFORE', 'AFTER', 'ISSUE', 'DAMAGE', 'RECEIPT', 'INCIDENT')),
  file_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_assistance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE RESTRICT,
  worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE RESTRICT,
  work_opportunity_id UUID REFERENCES work_opportunities(id) ON DELETE SET NULL,
  interaction_type VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 2. Performance & Integrity Indexes (Spatial, FK, and Concurrency Defense)
-- ------------------------------------------------------------------------------

-- Concurrency / Duplicate Active Assignment Defense (In-flight assignments only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_assignment_worker 
  ON assignments(work_opportunity_id, worker_id) 
  WHERE status IN ('ASSIGNED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS');

-- Spatial GIST Index on Agent Location
CREATE INDEX IF NOT EXISTS idx_agent_profiles_location 
  ON agent_profiles USING GIST(location);

-- Missing Foreign Key & Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_assignments_application 
  ON assignments(application_id);

CREATE INDEX IF NOT EXISTS idx_applications_assisted_by_agent 
  ON applications(assisted_by_agent_id);

CREATE INDEX IF NOT EXISTS idx_worker_profiles_assisted_by_agent 
  ON worker_profiles(assisted_by_agent_id);

CREATE INDEX IF NOT EXISTS idx_conversations_application 
  ON conversations(application_id);

CREATE INDEX IF NOT EXISTS idx_conversations_assignment 
  ON conversations(assignment_id);

CREATE INDEX IF NOT EXISTS idx_replacement_requests_replacement 
  ON replacement_requests(replacement_assignment_id);

CREATE INDEX IF NOT EXISTS idx_disputes_respondent 
  ON disputes(respondent_id);

CREATE INDEX IF NOT EXISTS idx_disputes_initiator 
  ON disputes(initiator_id);

CREATE INDEX IF NOT EXISTS idx_reports_reporter 
  ON reports(reporter_id);

CREATE INDEX IF NOT EXISTS idx_verifications_reviewed_by 
  ON verifications(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_job_evidence_assignment 
  ON job_evidence(assignment_id);

CREATE INDEX IF NOT EXISTS idx_job_evidence_uploaded_by 
  ON job_evidence(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_event 
  ON webhook_events(provider, event_id);

-- ------------------------------------------------------------------------------
-- 3. Security Definer Helper Functions for RLS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
  SELECT id FROM users 
  WHERE auth_id = auth.uid()::text OR id::text = auth.uid()::text 
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS user_role AS $$
  SELECT role FROM users 
  WHERE auth_id = auth.uid()::text OR id::text = auth.uid()::text 
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 4. Enable RLS Across All Application Tables (Dynamically and Safely)
-- ------------------------------------------------------------------------------

DO $$ 
DECLARE 
  tbl text;
  tables text[] := ARRAY[
    'users', 'worker_profiles', 'provider_profiles', 'agent_profiles', 
    'categories', 'skills', 'worker_skills', 'work_opportunities', 
    'work_opportunity_skills', 'worker_availability', 'applications', 
    'assignments', 'attendance_records', 'agent_worker_relationships', 
    'agent_assistance', 'verifications', 'reviews', 'payment_records', 
    'disputes', 'reports', 'notifications', 'conversations', 'messages', 
    'job_evidence', 'preferred_workers', 'preferred_providers', 
    'replacement_requests', 'otp_challenges', 'market_wage_benchmarks', 
    'voice_assistance_logs', 'platform_events', 'audit_logs', 'webhook_events'
  ];
BEGIN 
  FOREACH tbl IN ARRAY tables LOOP 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    END IF;
  END LOOP; 
END $$;

-- ------------------------------------------------------------------------------
-- 5. Drop Insecure Permissive Policies
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow public read on worker profiles for matching" ON worker_profiles;
DROP POLICY IF EXISTS "Allow public read on provider profiles" ON provider_profiles;
DROP POLICY IF EXISTS "Allow public read on reviews" ON reviews;

-- ------------------------------------------------------------------------------
-- 6. Comprehensive Granular RLS Policies (Separating SELECT / INSERT / UPDATE / DELETE)
-- ------------------------------------------------------------------------------

-- 6.1 USERS
DROP POLICY IF EXISTS "users_select_policy" ON users;
CREATE POLICY "users_select_policy" ON users FOR SELECT
  USING (
    auth_id = auth.uid()::text 
    OR id = current_user_id()
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "users_insert_policy" ON users;
CREATE POLICY "users_insert_policy" ON users FOR INSERT
  WITH CHECK (
    (auth_id = auth.uid()::text AND role IN ('WORKER', 'PROVIDER', 'AGENT'))
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "users_update_policy" ON users;
CREATE POLICY "users_update_policy" ON users FOR UPDATE
  USING (
    auth_id = auth.uid()::text 
    OR id = current_user_id()
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "users_delete_policy" ON users;
CREATE POLICY "users_delete_policy" ON users FOR DELETE
  USING (current_user_role() = 'ADMIN');

-- 6.2 WORKER PROFILES
DROP POLICY IF EXISTS "worker_profiles_select_policy" ON worker_profiles;
CREATE POLICY "worker_profiles_select_policy" ON worker_profiles FOR SELECT
  USING (
    user_id = current_user_id()
    OR current_user_role() = 'ADMIN'
    OR EXISTS (
      SELECT 1 FROM agent_worker_relationships awr
      JOIN agent_profiles ap ON awr.agent_id = ap.id
      WHERE ap.user_id = current_user_id() 
        AND awr.worker_id = worker_profiles.id 
        AND awr.status = 'ACTIVE'
    )
    OR EXISTS (
      SELECT 1 FROM applications a
      JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
      JOIN provider_profiles pp ON wo.provider_id = pp.id
      WHERE a.worker_id = worker_profiles.id 
        AND pp.user_id = current_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM assignments asg
      JOIN provider_profiles pp ON asg.provider_id = pp.id
      WHERE asg.worker_id = worker_profiles.id 
        AND pp.user_id = current_user_id()
    )
  );

DROP POLICY IF EXISTS "worker_profiles_insert_policy" ON worker_profiles;
CREATE POLICY "worker_profiles_insert_policy" ON worker_profiles FOR INSERT
  WITH CHECK (
    (user_id = current_user_id() AND current_user_role() = 'WORKER')
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "worker_profiles_update_policy" ON worker_profiles;
CREATE POLICY "worker_profiles_update_policy" ON worker_profiles FOR UPDATE
  USING (
    user_id = current_user_id()
    OR current_user_role() = 'ADMIN'
    OR EXISTS (
      SELECT 1 FROM agent_worker_relationships awr
      JOIN agent_profiles ap ON awr.agent_id = ap.id
      WHERE ap.user_id = current_user_id() 
        AND awr.worker_id = worker_profiles.id 
        AND awr.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "worker_profiles_delete_policy" ON worker_profiles;
CREATE POLICY "worker_profiles_delete_policy" ON worker_profiles FOR DELETE
  USING (user_id = current_user_id() OR current_user_role() = 'ADMIN');

-- 6.3 PROVIDER PROFILES
DROP POLICY IF EXISTS "provider_profiles_select_policy" ON provider_profiles;
CREATE POLICY "provider_profiles_select_policy" ON provider_profiles FOR SELECT
  USING (
    user_id = current_user_id()
    OR current_user_role() = 'ADMIN'
    OR EXISTS (
      SELECT 1 FROM work_opportunities wo
      WHERE wo.provider_id = provider_profiles.id
        AND wo.status IN ('PUBLISHED', 'MATCHING', 'PARTIALLY_FILLED', 'FILLED', 'IN_PROGRESS', 'COMPLETED')
    )
  );

DROP POLICY IF EXISTS "provider_profiles_insert_policy" ON provider_profiles;
CREATE POLICY "provider_profiles_insert_policy" ON provider_profiles FOR INSERT
  WITH CHECK (
    (user_id = current_user_id() AND current_user_role() = 'PROVIDER')
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "provider_profiles_update_policy" ON provider_profiles;
CREATE POLICY "provider_profiles_update_policy" ON provider_profiles FOR UPDATE
  USING (user_id = current_user_id() OR current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "provider_profiles_delete_policy" ON provider_profiles;
CREATE POLICY "provider_profiles_delete_policy" ON provider_profiles FOR DELETE
  USING (user_id = current_user_id() OR current_user_role() = 'ADMIN');

-- 6.4 AGENT PROFILES
DROP POLICY IF EXISTS "agent_profiles_select_policy" ON agent_profiles;
CREATE POLICY "agent_profiles_select_policy" ON agent_profiles FOR SELECT
  USING (
    user_id = current_user_id()
    OR active_status = TRUE
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "agent_profiles_insert_policy" ON agent_profiles;
CREATE POLICY "agent_profiles_insert_policy" ON agent_profiles FOR INSERT
  WITH CHECK (
    (user_id = current_user_id() AND current_user_role() = 'AGENT')
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "agent_profiles_update_policy" ON agent_profiles;
CREATE POLICY "agent_profiles_update_policy" ON agent_profiles FOR UPDATE
  USING (user_id = current_user_id() OR current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "agent_profiles_delete_policy" ON agent_profiles;
CREATE POLICY "agent_profiles_delete_policy" ON agent_profiles FOR DELETE
  USING (current_user_role() = 'ADMIN');

-- 6.5 AGENT WORKER RELATIONSHIPS
DROP POLICY IF EXISTS "awr_select_policy" ON agent_worker_relationships;
CREATE POLICY "awr_select_policy" ON agent_worker_relationships FOR SELECT
  USING (
    worker_id IN (SELECT id FROM worker_profiles WHERE user_id = current_user_id())
    OR agent_id IN (SELECT id FROM agent_profiles WHERE user_id = current_user_id())
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "awr_insert_policy" ON agent_worker_relationships;
CREATE POLICY "awr_insert_policy" ON agent_worker_relationships FOR INSERT
  WITH CHECK (
    agent_id IN (SELECT id FROM agent_profiles WHERE user_id = current_user_id())
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "awr_update_policy" ON agent_worker_relationships;
CREATE POLICY "awr_update_policy" ON agent_worker_relationships FOR UPDATE
  USING (
    worker_id IN (SELECT id FROM worker_profiles WHERE user_id = current_user_id())
    OR agent_id IN (SELECT id FROM agent_profiles WHERE user_id = current_user_id())
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "awr_delete_policy" ON agent_worker_relationships;
CREATE POLICY "awr_delete_policy" ON agent_worker_relationships FOR DELETE
  USING (current_user_role() = 'ADMIN');

-- 6.6 WORK OPPORTUNITIES
DROP POLICY IF EXISTS "Allow public read on published work opportunities" ON work_opportunities;
DROP POLICY IF EXISTS "work_opp_select_policy" ON work_opportunities;
CREATE POLICY "work_opp_select_policy" ON work_opportunities FOR SELECT
  USING (
    status IN ('PUBLISHED', 'MATCHING', 'PARTIALLY_FILLED')
    OR provider_id IN (SELECT id FROM provider_profiles WHERE user_id = current_user_id())
    OR current_user_role() = 'ADMIN'
    OR EXISTS (
      SELECT 1 FROM applications a 
      JOIN worker_profiles wp ON a.worker_id = wp.id 
      WHERE a.work_opportunity_id = work_opportunities.id AND wp.user_id = current_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM assignments asg 
      JOIN worker_profiles wp ON asg.worker_id = wp.id 
      WHERE asg.work_opportunity_id = work_opportunities.id AND wp.user_id = current_user_id()
    )
  );

DROP POLICY IF EXISTS "work_opp_insert_policy" ON work_opportunities;
CREATE POLICY "work_opp_insert_policy" ON work_opportunities FOR INSERT
  WITH CHECK (
    provider_id IN (SELECT id FROM provider_profiles WHERE user_id = current_user_id())
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "work_opp_update_policy" ON work_opportunities;
CREATE POLICY "work_opp_update_policy" ON work_opportunities FOR UPDATE
  USING (
    provider_id IN (SELECT id FROM provider_profiles WHERE user_id = current_user_id())
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "work_opp_delete_policy" ON work_opportunities;
CREATE POLICY "work_opp_delete_policy" ON work_opportunities FOR DELETE
  USING (
    (provider_id IN (SELECT id FROM provider_profiles WHERE user_id = current_user_id()) AND status = 'DRAFT')
    OR current_user_role() = 'ADMIN'
  );

-- 6.7 APPLICATIONS
DROP POLICY IF EXISTS "applications_select_policy" ON applications;
CREATE POLICY "applications_select_policy" ON applications FOR SELECT
  USING (
    worker_id IN (SELECT id FROM worker_profiles WHERE user_id = current_user_id())
    OR work_opportunity_id IN (
      SELECT wo.id FROM work_opportunities wo 
      JOIN provider_profiles pp ON wo.provider_id = pp.id 
      WHERE pp.user_id = current_user_id()
    )
    OR current_user_role() = 'ADMIN'
    OR EXISTS (
      SELECT 1 FROM agent_worker_relationships awr
      JOIN agent_profiles ap ON awr.agent_id = ap.id
      WHERE ap.user_id = current_user_id() 
        AND awr.worker_id = applications.worker_id 
        AND awr.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "applications_insert_policy" ON applications;
CREATE POLICY "applications_insert_policy" ON applications FOR INSERT
  WITH CHECK (
    worker_id IN (SELECT id FROM worker_profiles WHERE user_id = current_user_id())
    OR current_user_role() = 'ADMIN'
    OR EXISTS (
      SELECT 1 FROM agent_worker_relationships awr
      JOIN agent_profiles ap ON awr.agent_id = ap.id
      WHERE ap.user_id = current_user_id() 
        AND awr.worker_id = applications.worker_id 
        AND awr.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "applications_update_policy" ON applications;
CREATE POLICY "applications_update_policy" ON applications FOR UPDATE
  USING (
    worker_id IN (SELECT id FROM worker_profiles WHERE user_id = current_user_id())
    OR work_opportunity_id IN (
      SELECT wo.id FROM work_opportunities wo 
      JOIN provider_profiles pp ON wo.provider_id = pp.id 
      WHERE pp.user_id = current_user_id()
    )
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "applications_delete_policy" ON applications;
CREATE POLICY "applications_delete_policy" ON applications FOR DELETE
  USING (current_user_role() = 'ADMIN');

-- 6.8 ASSIGNMENTS
DROP POLICY IF EXISTS "assignments_select_policy" ON assignments;
CREATE POLICY "assignments_select_policy" ON assignments FOR SELECT
  USING (
    worker_id IN (SELECT id FROM worker_profiles WHERE user_id = current_user_id())
    OR provider_id IN (SELECT id FROM provider_profiles WHERE user_id = current_user_id())
    OR current_user_role() = 'ADMIN'
    OR EXISTS (
      SELECT 1 FROM agent_worker_relationships awr
      JOIN agent_profiles ap ON awr.agent_id = ap.id
      WHERE ap.user_id = current_user_id() 
        AND awr.worker_id = assignments.worker_id 
        AND awr.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "assignments_insert_policy" ON assignments;
CREATE POLICY "assignments_insert_policy" ON assignments FOR INSERT
  WITH CHECK (
    provider_id IN (SELECT id FROM provider_profiles WHERE user_id = current_user_id())
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "assignments_update_policy" ON assignments;
CREATE POLICY "assignments_update_policy" ON assignments FOR UPDATE
  USING (
    worker_id IN (SELECT id FROM worker_profiles WHERE user_id = current_user_id())
    OR provider_id IN (SELECT id FROM provider_profiles WHERE user_id = current_user_id())
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "assignments_delete_policy" ON assignments;
CREATE POLICY "assignments_delete_policy" ON assignments FOR DELETE
  USING (current_user_role() = 'ADMIN');

-- 6.9 ATTENDANCE RECORDS & JOB EVIDENCE
DROP POLICY IF EXISTS "attendance_select_policy" ON attendance_records;
CREATE POLICY "attendance_select_policy" ON attendance_records FOR SELECT
  USING (
    worker_id IN (SELECT id FROM worker_profiles WHERE user_id = current_user_id())
    OR current_user_role() = 'ADMIN'
    OR EXISTS (
      SELECT 1 FROM assignments asg 
      JOIN provider_profiles pp ON asg.provider_id = pp.id 
      WHERE asg.id = attendance_records.assignment_id AND pp.user_id = current_user_id()
    )
  );

DROP POLICY IF EXISTS "attendance_insert_policy" ON attendance_records;
CREATE POLICY "attendance_insert_policy" ON attendance_records FOR INSERT
  WITH CHECK (
    worker_id IN (SELECT id FROM worker_profiles WHERE user_id = current_user_id())
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "attendance_update_policy" ON attendance_records;
CREATE POLICY "attendance_update_policy" ON attendance_records FOR UPDATE
  USING (
    worker_id IN (SELECT id FROM worker_profiles WHERE user_id = current_user_id())
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "attendance_delete_policy" ON attendance_records;
CREATE POLICY "attendance_delete_policy" ON attendance_records FOR DELETE
  USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "job_evidence_select_policy" ON job_evidence;
CREATE POLICY "job_evidence_select_policy" ON job_evidence FOR SELECT
  USING (
    uploaded_by = current_user_id()
    OR current_user_role() = 'ADMIN'
    OR EXISTS (
      SELECT 1 FROM assignments asg
      JOIN worker_profiles wp ON asg.worker_id = wp.id
      JOIN provider_profiles pp ON asg.provider_id = pp.id
      WHERE asg.id = job_evidence.assignment_id
        AND (wp.user_id = current_user_id() OR pp.user_id = current_user_id())
    )
  );

DROP POLICY IF EXISTS "job_evidence_insert_policy" ON job_evidence;
CREATE POLICY "job_evidence_insert_policy" ON job_evidence FOR INSERT
  WITH CHECK (
    uploaded_by = current_user_id()
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "job_evidence_update_policy" ON job_evidence;
CREATE POLICY "job_evidence_update_policy" ON job_evidence FOR UPDATE
  USING (uploaded_by = current_user_id() OR current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "job_evidence_delete_policy" ON job_evidence;
CREATE POLICY "job_evidence_delete_policy" ON job_evidence FOR DELETE
  USING (uploaded_by = current_user_id() OR current_user_role() = 'ADMIN');

-- 6.10 PAYMENT RECORDS
DROP POLICY IF EXISTS "payment_records_select_policy" ON payment_records;
CREATE POLICY "payment_records_select_policy" ON payment_records FOR SELECT
  USING (
    payer_id = current_user_id()
    OR payee_id = current_user_id()
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "payment_records_insert_policy" ON payment_records;
CREATE POLICY "payment_records_insert_policy" ON payment_records FOR INSERT
  WITH CHECK (
    payer_id = current_user_id()
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "payment_records_update_policy" ON payment_records;
CREATE POLICY "payment_records_update_policy" ON payment_records FOR UPDATE
  USING (
    payer_id = current_user_id()
    OR payee_id = current_user_id()
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "payment_records_delete_policy" ON payment_records;
CREATE POLICY "payment_records_delete_policy" ON payment_records FOR DELETE
  USING (current_user_role() = 'ADMIN');

-- 6.11 NOTIFICATIONS
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
CREATE POLICY "notifications_select_policy" ON notifications FOR SELECT
  USING (recipient_id = current_user_id() OR current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
CREATE POLICY "notifications_insert_policy" ON notifications FOR INSERT
  WITH CHECK (current_user_role() = 'ADMIN' OR current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;
CREATE POLICY "notifications_update_policy" ON notifications FOR UPDATE
  USING (recipient_id = current_user_id() OR current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "notifications_delete_policy" ON notifications;
CREATE POLICY "notifications_delete_policy" ON notifications FOR DELETE
  USING (recipient_id = current_user_id() OR current_user_role() = 'ADMIN');

-- 6.12 DISPUTES & REPORTS
DROP POLICY IF EXISTS "disputes_select_policy" ON disputes;
CREATE POLICY "disputes_select_policy" ON disputes FOR SELECT
  USING (
    initiator_id = current_user_id()
    OR respondent_id = current_user_id()
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "disputes_insert_policy" ON disputes;
CREATE POLICY "disputes_insert_policy" ON disputes FOR INSERT
  WITH CHECK (initiator_id = current_user_id() OR current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "disputes_update_policy" ON disputes;
CREATE POLICY "disputes_update_policy" ON disputes FOR UPDATE
  USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "disputes_delete_policy" ON disputes;
CREATE POLICY "disputes_delete_policy" ON disputes FOR DELETE
  USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "reports_select_policy" ON reports;
CREATE POLICY "reports_select_policy" ON reports FOR SELECT
  USING (reporter_id = current_user_id() OR current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "reports_insert_policy" ON reports;
CREATE POLICY "reports_insert_policy" ON reports FOR INSERT
  WITH CHECK (reporter_id = current_user_id() OR current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "reports_update_policy" ON reports;
CREATE POLICY "reports_update_policy" ON reports FOR UPDATE
  USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "reports_delete_policy" ON reports;
CREATE POLICY "reports_delete_policy" ON reports FOR DELETE
  USING (current_user_role() = 'ADMIN');

-- 6.13 REVIEWS & RATINGS
DROP POLICY IF EXISTS "reviews_select_policy" ON reviews;
CREATE POLICY "reviews_select_policy" ON reviews FOR SELECT
  USING (TRUE); -- Reviews are public social proof

DROP POLICY IF EXISTS "reviews_insert_policy" ON reviews;
CREATE POLICY "reviews_insert_policy" ON reviews FOR INSERT
  WITH CHECK (reviewer_id = current_user_id() OR current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "reviews_update_policy" ON reviews;
CREATE POLICY "reviews_update_policy" ON reviews FOR UPDATE
  USING (reviewer_id = current_user_id() OR current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "reviews_delete_policy" ON reviews;
CREATE POLICY "reviews_delete_policy" ON reviews FOR DELETE
  USING (current_user_role() = 'ADMIN');

-- 6.14 VERIFICATIONS
DROP POLICY IF EXISTS "verifications_select_policy" ON verifications;
CREATE POLICY "verifications_select_policy" ON verifications FOR SELECT
  USING (
    target_id = current_user_id()
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "verifications_insert_policy" ON verifications;
CREATE POLICY "verifications_insert_policy" ON verifications FOR INSERT
  WITH CHECK (
    target_id = current_user_id()
    OR current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "verifications_update_policy" ON verifications;
CREATE POLICY "verifications_update_policy" ON verifications FOR UPDATE
  USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "verifications_delete_policy" ON verifications;
CREATE POLICY "verifications_delete_policy" ON verifications FOR DELETE
  USING (current_user_role() = 'ADMIN');

-- 6.15 TAXONOMY & REFERENCE DATA (Read-only Public)
DROP POLICY IF EXISTS "Allow public read on active categories" ON categories;
DROP POLICY IF EXISTS "categories_select_policy" ON categories;
CREATE POLICY "categories_select_policy" ON categories FOR SELECT
  USING (is_active = TRUE OR current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "categories_admin_policy" ON categories;
CREATE POLICY "categories_admin_policy" ON categories FOR ALL
  USING (current_user_role() = 'ADMIN')
  WITH CHECK (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Allow public read on active skills" ON skills;
DROP POLICY IF EXISTS "skills_select_policy" ON skills;
CREATE POLICY "skills_select_policy" ON skills FOR SELECT
  USING (is_active = TRUE OR current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "skills_admin_policy" ON skills;
CREATE POLICY "skills_admin_policy" ON skills FOR ALL
  USING (current_user_role() = 'ADMIN')
  WITH CHECK (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "market_benchmarks_select_policy" ON market_wage_benchmarks;
CREATE POLICY "market_benchmarks_select_policy" ON market_wage_benchmarks FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "market_benchmarks_admin_policy" ON market_wage_benchmarks;
CREATE POLICY "market_benchmarks_admin_policy" ON market_wage_benchmarks FOR ALL
  USING (current_user_role() = 'ADMIN')
  WITH CHECK (current_user_role() = 'ADMIN');

-- 6.16 SENSITIVE / INTERNAL TABLES (Admin or System Only)
DROP POLICY IF EXISTS "audit_logs_admin_select" ON audit_logs;
CREATE POLICY "audit_logs_admin_select" ON audit_logs FOR SELECT
  USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "platform_events_admin_select" ON platform_events;
CREATE POLICY "platform_events_admin_select" ON platform_events FOR SELECT
  USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "webhook_events_admin_select" ON webhook_events;
CREATE POLICY "webhook_events_admin_select" ON webhook_events FOR SELECT
  USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "otp_challenges_admin_select" ON otp_challenges;
CREATE POLICY "otp_challenges_admin_select" ON otp_challenges FOR SELECT
  USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "voice_logs_select" ON voice_assistance_logs;
CREATE POLICY "voice_logs_select" ON voice_assistance_logs FOR SELECT
  USING (user_id = current_user_id() OR current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "voice_logs_insert" ON voice_assistance_logs;
CREATE POLICY "voice_logs_insert" ON voice_assistance_logs FOR INSERT
  WITH CHECK (user_id = current_user_id() OR current_user_role() = 'ADMIN');
