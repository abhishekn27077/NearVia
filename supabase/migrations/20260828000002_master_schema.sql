-- ==============================================================================
-- Migration: 20260828000002_master_schema.sql
-- Purpose: Complete NEARVIA Master Relational Schema with PostGIS Geography
-- Entities: 19 Relational Entities, PostGIS Spatial GIST Indexes & Check Constraints
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENUMS AND DOMAIN TYPES
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('WORKER', 'PROVIDER', 'AGENT', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE work_type AS ENUM ('TASK', 'SHIFT', 'JOB');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE urgency_level AS ENUM ('NORMAL', 'URGENT', 'IMMEDIATE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_type AS ENUM ('HOURLY', 'FIXED', 'DAILY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE provider_type AS ENUM ('INDIVIDUAL', 'BUSINESS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE work_opportunity_status AS ENUM (
    'DRAFT', 'PUBLISHED', 'MATCHING', 'PARTIALLY_FILLED', 'FILLED',
    'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE application_status AS ENUM (
    'PENDING', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assignment_status AS ENUM (
    'ASSIGNED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS',
    'COMPLETED', 'CANCELLED', 'NO_SHOW', 'REPLACED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE verification_target AS ENUM ('WORKER', 'PROVIDER', 'BUSINESS', 'AGENT', 'SKILL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE availability_status AS ENUM ('OFFLINE', 'AVAILABLE_NOW', 'AVAILABLE_LATER', 'BUSY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'DISPUTED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dispute_status AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('OPEN', 'UNDER_REVIEW', 'ACTION_TAKEN', 'RESOLVED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------------------------
-- 2. CORE USERS & AUTHENTICATION LINKAGE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id VARCHAR(255) UNIQUE NOT NULL, -- Supabase Auth UUID Linkage
  phone VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE,
  role user_role NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- ------------------------------------------------------------------------------
-- 3. WORKER PROFILES (Spatial Geography Point)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS worker_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  experience_years NUMERIC(4, 1) DEFAULT 0 CHECK (experience_years >= 0 AND experience_years <= 50),
  location GEOGRAPHY(Point, 4326) NOT NULL, -- WGS84 Geodesic Point
  address_approximate TEXT,
  service_radius_km NUMERIC(4, 1) DEFAULT 5.0 CHECK (service_radius_km >= 1.0 AND service_radius_km <= 15.0),
  availability_status availability_status DEFAULT 'OFFLINE' NOT NULL,
  is_available_now BOOLEAN DEFAULT FALSE NOT NULL,
  available_until TIMESTAMPTZ, -- Supports time-bounded Available-Now status
  hourly_rate_estimate NUMERIC(10, 2) CHECK (hourly_rate_estimate IS NULL OR hourly_rate_estimate >= 0),
  daily_rate_estimate NUMERIC(10, 2) CHECK (daily_rate_estimate IS NULL OR daily_rate_estimate >= 0),
  average_rating NUMERIC(3, 2) DEFAULT 5.00 CHECK (average_rating >= 1.00 AND average_rating <= 5.00),
  total_ratings_count INT DEFAULT 0 CHECK (total_ratings_count >= 0),
  completed_tasks_count INT DEFAULT 0 CHECK (completed_tasks_count >= 0),
  assisted_by_agent_id UUID, -- Optional foreign key to agent_profiles
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Spatial GIST index for hyperlocal 5 km radius matching queries
CREATE INDEX IF NOT EXISTS idx_worker_profiles_location ON worker_profiles USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_available_now ON worker_profiles(is_available_now) WHERE is_available_now = TRUE;
CREATE INDEX IF NOT EXISTS idx_worker_profiles_status ON worker_profiles(availability_status);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_rating ON worker_profiles(average_rating DESC);

-- ------------------------------------------------------------------------------
-- 4. PROVIDER PROFILES (Spatial Geography Point)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provider_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_type provider_type DEFAULT 'INDIVIDUAL' NOT NULL,
  business_name VARCHAR(200),
  description TEXT,
  contact_phone VARCHAR(20),
  location GEOGRAPHY(Point, 4326) NOT NULL,
  address_approximate TEXT,
  verified_business BOOLEAN DEFAULT FALSE NOT NULL,
  average_rating NUMERIC(3, 2) DEFAULT 5.00 CHECK (average_rating >= 1.00 AND average_rating <= 5.00),
  total_ratings_count INT DEFAULT 0 CHECK (total_ratings_count >= 0),
  posted_jobs_count INT DEFAULT 0 CHECK (posted_jobs_count >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_profiles_location ON provider_profiles USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_type ON provider_profiles(provider_type);

-- ------------------------------------------------------------------------------
-- 5. AGENT PROFILES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_area VARCHAR(150) NOT NULL,
  verified_workers_count INT DEFAULT 0 CHECK (verified_workers_count >= 0),
  active_status BOOLEAN DEFAULT TRUE NOT NULL,
  description TEXT,
  languages TEXT[] DEFAULT '{}',
  location GEOGRAPHY(Point, 4326),
  address_approximate TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_profiles_user ON agent_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_active ON agent_profiles(active_status);

-- ------------------------------------------------------------------------------
-- 6. CATEGORIES & TAXONOMY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(display_order);

-- ------------------------------------------------------------------------------
-- 7. SKILLS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category_id);
CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);

-- ------------------------------------------------------------------------------
-- 8. WORKER SKILLS (Many-to-Many Association)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS worker_skills (
  worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  years_experience NUMERIC(3, 1) DEFAULT 0 CHECK (years_experience >= 0),
  is_verified BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (worker_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_worker_skills_skill ON worker_skills(skill_id);

-- ------------------------------------------------------------------------------
-- 9. WORK OPPORTUNITIES (Unified Job / Task / Shift Entity with PostGIS Location)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  work_type work_type NOT NULL,
  urgency urgency_level DEFAULT 'NORMAL' NOT NULL,
  status work_opportunity_status DEFAULT 'DRAFT' NOT NULL,
  workers_needed INT DEFAULT 1 NOT NULL CHECK (workers_needed > 0 AND workers_needed <= 100),
  workers_assigned INT DEFAULT 0 NOT NULL CHECK (workers_assigned >= 0),
  location GEOGRAPHY(Point, 4326) NOT NULL,
  address_approximate TEXT NOT NULL,
  work_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_hours NUMERIC(4, 2) NOT NULL CHECK (duration_hours > 0 AND duration_hours <= 24),
  payment_amount NUMERIC(10, 2) NOT NULL CHECK (payment_amount > 0),
  payment_type payment_type NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR' NOT NULL,
  min_experience_years NUMERIC(3, 1) DEFAULT 0 CHECK (min_experience_years >= 0),
  responsibilities TEXT,
  instructions TEXT,
  tools_provided BOOLEAN DEFAULT FALSE NOT NULL,
  orientation_provided BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  published_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT chk_work_time_order CHECK (end_time > start_time),
  CONSTRAINT chk_assigned_count CHECK (workers_assigned <= workers_needed)
);

-- Spatial GIST index for fast 5 km work discovery queries
CREATE INDEX IF NOT EXISTS idx_work_opportunities_location ON work_opportunities USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_work_opportunities_status ON work_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_work_opportunities_date ON work_opportunities(work_date);
CREATE INDEX IF NOT EXISTS idx_work_opportunities_type ON work_opportunities(work_type);
CREATE INDEX IF NOT EXISTS idx_work_opportunities_provider ON work_opportunities(provider_id);
CREATE INDEX IF NOT EXISTS idx_work_opportunities_category ON work_opportunities(category_id);

-- ------------------------------------------------------------------------------
-- 10. WORK OPPORTUNITY SKILLS (Required Skill Association)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_opportunity_skills (
  work_opportunity_id UUID NOT NULL REFERENCES work_opportunities(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT TRUE NOT NULL,
  min_experience_years NUMERIC(3, 1) DEFAULT 0 CHECK (min_experience_years >= 0),
  PRIMARY KEY (work_opportunity_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_work_opp_skills_skill ON work_opportunity_skills(skill_id);

-- ------------------------------------------------------------------------------
-- 11. WORKER AVAILABILITY SLOTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS worker_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  availability_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status availability_status DEFAULT 'AVAILABLE_LATER' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT chk_avail_time_order CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_worker_avail_worker_date ON worker_availability(worker_id, availability_date);

-- ------------------------------------------------------------------------------
-- 12. APPLICATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_opportunity_id UUID NOT NULL REFERENCES work_opportunities(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  status application_status DEFAULT 'PENDING' NOT NULL,
  proposed_wage NUMERIC(10, 2) CHECK (proposed_wage IS NULL OR proposed_wage > 0),
  worker_notes TEXT,
  applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  responded_at TIMESTAMPTZ,
  decision_notes TEXT,
  assisted_by_agent_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(work_opportunity_id, worker_id) -- Prevent duplicate applications
);

CREATE INDEX IF NOT EXISTS idx_applications_work_opp ON applications(work_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_applications_worker ON applications(worker_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- ------------------------------------------------------------------------------
-- 13. ASSIGNMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_opportunity_id UUID NOT NULL REFERENCES work_opportunities(id) ON DELETE RESTRICT,
  worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE RESTRICT,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  status assignment_status DEFAULT 'ASSIGNED' NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  confirmed_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cancellation_reason TEXT,
  no_show_at TIMESTAMPTZ,
  completion_notes TEXT,
  check_in_location GEOGRAPHY(Point, 4326),
  check_in_distance_meters NUMERIC(10, 2),
  agreed_wage NUMERIC(10, 2) NOT NULL CHECK (agreed_wage > 0),
  final_wage_paid NUMERIC(10, 2) CHECK (final_wage_paid IS NULL OR final_wage_paid >= 0),
  payment_status payment_status DEFAULT 'PENDING' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assignments_work_opp ON assignments(work_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_assignments_worker ON assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_assignments_provider ON assignments(provider_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);

-- ------------------------------------------------------------------------------
-- 14. ATTENDANCE RECORDS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE RESTRICT,
  check_in_time TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  check_in_location GEOGRAPHY(Point, 4326),
  distance_meters NUMERIC(10, 2),
  verified_by_provider BOOLEAN DEFAULT FALSE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_assignment ON attendance_records(assignment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_worker ON attendance_records(worker_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_checkin_time ON attendance_records(check_in_time);

-- ------------------------------------------------------------------------------
-- 15. AGENT-WORKER RELATIONSHIPS
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE agent_worker_status AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS agent_worker_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE RESTRICT,
  worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE RESTRICT,
  status agent_worker_status DEFAULT 'PENDING' NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(agent_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_awr_agent ON agent_worker_relationships(agent_id);
CREATE INDEX IF NOT EXISTS idx_awr_worker ON agent_worker_relationships(worker_id);
CREATE INDEX IF NOT EXISTS idx_awr_status ON agent_worker_relationships(status);

-- ------------------------------------------------------------------------------
-- 16. VERIFICATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type verification_target NOT NULL,
  target_id UUID NOT NULL,
  verification_type VARCHAR(50) NOT NULL,
  document_ref VARCHAR(255),
  status verification_status DEFAULT 'PENDING' NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verifications_target ON verifications(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(status);

-- ------------------------------------------------------------------------------
-- 17. REVIEWS & TWO-SIDED RATINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE RESTRICT,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(assignment_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_assignment ON reviews(assignment_id);

-- ------------------------------------------------------------------------------
-- 18. PAYMENT RECORDS (With Idempotency & Gateway Tracking)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE RESTRICT,
  payer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  payee_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'INR' NOT NULL,
  status payment_status DEFAULT 'PENDING' NOT NULL,
  payment_method VARCHAR(50),
  transaction_ref VARCHAR(255),
  notes TEXT,
  idempotency_key VARCHAR(255),
  gateway_order_id VARCHAR(255),
  gateway_payment_id VARCHAR(255),
  gateway_signature VARCHAR(255),
  amount_paise BIGINT,
  recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_records_assignment ON payment_records(assignment_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_payer ON payment_records(payer_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_payee ON payment_records(payee_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_idempotency ON payment_records(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payment_records_gateway_order ON payment_records(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_status ON payment_records(status);
CREATE INDEX IF NOT EXISTS idx_payment_records_recorded_at ON payment_records(recorded_at DESC);

-- ------------------------------------------------------------------------------
-- 19. DISPUTES & REPORTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE RESTRICT,
  initiator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  respondent_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  status dispute_status DEFAULT 'OPEN' NOT NULL,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_dispute_per_assignment_initiator
ON disputes (assignment_id, initiator_id)
WHERE status IN ('OPEN', 'UNDER_REVIEW');

CREATE INDEX IF NOT EXISTS idx_disputes_assignment ON disputes(assignment_id);
CREATE INDEX IF NOT EXISTS idx_disputes_initiator ON disputes(initiator_id);
CREATE INDEX IF NOT EXISTS idx_disputes_respondent ON disputes(respondent_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  target_type VARCHAR(50) NOT NULL,
  target_id UUID NOT NULL,
  category VARCHAR(50),
  reason VARCHAR(100) NOT NULL,
  description TEXT,
  evidence_urls TEXT[] DEFAULT '{}',
  status report_status DEFAULT 'OPEN' NOT NULL,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- ------------------------------------------------------------------------------
-- 20. NOTIFICATIONS, PLATFORM EVENTS & AUDIT LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, is_read) WHERE is_read = FALSE;

CREATE TABLE IF NOT EXISTS platform_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(64) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resource_type VARCHAR(64),
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_platform_events_type ON platform_events(event_type);
CREATE INDEX IF NOT EXISTS idx_platform_events_user ON platform_events(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_created ON platform_events(created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_entity VARCHAR(100) NOT NULL,
  target_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_entity, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
