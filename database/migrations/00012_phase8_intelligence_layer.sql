-- ==============================================================================
-- NEARVIA DATABASE MIGRATION: 00012_phase8_intelligence_layer.sql
-- PURPOSE: Supports Phase 8 Intelligence Layer (Deterministic Matching, 
--          Natural-Language Job Drafter Taxonomy, Market Wage Benchmarks, 
--          and Voice/Low-Literacy Ingestion Logs)
-- ==============================================================================

-- 1. Enable Trigram extension for fast taxonomy / keyword matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Worker Profiles - Reliability & Intelligence Indicators
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS reliability_score NUMERIC(5, 2) DEFAULT 100.00 CHECK (reliability_score >= 0.00 AND reliability_score <= 100.00),
  ADD COLUMN IF NOT EXISTS verified_badge BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS on_time_arrival_rate NUMERIC(5, 2) DEFAULT 100.00 CHECK (on_time_arrival_rate >= 0.00 AND on_time_arrival_rate <= 100.00);

-- 3. Trigram & Text Search Indexes for Natural-Language Drafter
CREATE INDEX IF NOT EXISTS idx_skills_name_trgm ON skills USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_categories_name_trgm ON categories USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_work_opportunities_title_trgm ON work_opportunities USING gin (title gin_trgm_ops);

-- 4. Market Wage Benchmarks Table (Hyperlocal Category Wage Analytics)
CREATE TABLE IF NOT EXISTS market_wage_benchmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  work_type VARCHAR(50) NOT NULL DEFAULT 'TASK',
  payment_type VARCHAR(50) NOT NULL DEFAULT 'DAILY',
  sample_count INT DEFAULT 0,
  min_wage NUMERIC(10, 2) DEFAULT 0,
  p25_wage NUMERIC(10, 2) DEFAULT 0,
  median_wage NUMERIC(10, 2) DEFAULT 0,
  p75_wage NUMERIC(10, 2) DEFAULT 0,
  max_wage NUMERIC(10, 2) DEFAULT 0,
  avg_wage NUMERIC(10, 2) DEFAULT 0,
  suggested_hourly_rate NUMERIC(10, 2) DEFAULT 100.00,
  suggested_daily_rate NUMERIC(10, 2) DEFAULT 800.00,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_market_wage_category_type UNIQUE (category_id, work_type, payment_type)
);

CREATE INDEX IF NOT EXISTS idx_market_wage_category ON market_wage_benchmarks(category_id);

-- 5. Voice & Natural Language Interaction Audit Logs
CREATE TABLE IF NOT EXISTS voice_assistance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(100),
  language_code VARCHAR(20) DEFAULT 'en-IN',
  input_type VARCHAR(20) DEFAULT 'TEXT',
  raw_input TEXT NOT NULL,
  detected_intent VARCHAR(100),
  extracted_entities JSONB DEFAULT '{}'::jsonb,
  confidence_score NUMERIC(4, 3) DEFAULT 1.000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_logs_user ON voice_assistance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_logs_created ON voice_assistance_logs(created_at DESC);
