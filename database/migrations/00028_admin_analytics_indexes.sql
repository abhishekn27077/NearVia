-- ==============================================================================
-- Migration: 00028_admin_analytics_indexes.sql
-- Purpose: Optimize Admin Operations Dashboard & Analytics Aggregations
-- Zero-cost PostgreSQL index enhancements for high-speed multi-dimensional queries
-- ==============================================================================

-- 1. Work Opportunities: Rapid aggregation by work type and lifecycle status
CREATE INDEX IF NOT EXISTS idx_work_opps_type_status 
  ON work_opportunities (work_type, status);

CREATE INDEX IF NOT EXISTS idx_work_opps_category_status 
  ON work_opportunities (category_id, status);

-- 2. Payment Records: Rapid aggregation by payment method, settlement status, and volume
CREATE INDEX IF NOT EXISTS idx_payment_records_method_status_amount 
  ON payment_records (payment_method, status, amount_paise);

-- 3. Trust & Safety: Moderation queues and status-reason distributions
CREATE INDEX IF NOT EXISTS idx_reports_status_reason 
  ON reports (status, reason);

CREATE INDEX IF NOT EXISTS idx_disputes_status_reason 
  ON disputes (status, reason);

CREATE INDEX IF NOT EXISTS idx_verifications_status_type 
  ON verifications (status, target_type);

-- 4. Reviews & Ratings: Distribution analysis
CREATE INDEX IF NOT EXISTS idx_reviews_rating_score 
  ON reviews (rating);
