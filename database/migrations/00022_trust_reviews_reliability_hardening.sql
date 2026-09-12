-- ==============================================================================
-- NEARVIA DATABASE MIGRATION: 00022_trust_reviews_reliability_hardening.sql
-- PURPOSE: Eliminates fake 5.0 default ratings on worker and provider profiles.
--          Enforces rating constraints (0.00 to 5.00), updates defaults to 0.00,
--          cleanses unreviewed profiles from fake 5.0 to 0.00, and ensures
--          reviews table immutability under RLS.
-- ==============================================================================

-- 1. Worker Profiles Rating Check Constraint & Default Hardening
ALTER TABLE worker_profiles 
  DROP CONSTRAINT IF EXISTS worker_profiles_average_rating_check;

ALTER TABLE worker_profiles 
  ADD CONSTRAINT worker_profiles_average_rating_check 
  CHECK (average_rating >= 0.00 AND average_rating <= 5.00);

ALTER TABLE worker_profiles 
  ALTER COLUMN average_rating SET DEFAULT 0.00;

-- 2. Provider Profiles Rating Check Constraint & Default Hardening
ALTER TABLE provider_profiles 
  DROP CONSTRAINT IF EXISTS provider_profiles_average_rating_check;

ALTER TABLE provider_profiles 
  ADD CONSTRAINT provider_profiles_average_rating_check 
  CHECK (average_rating >= 0.00 AND average_rating <= 5.00);

ALTER TABLE provider_profiles 
  ALTER COLUMN average_rating SET DEFAULT 0.00;

-- 3. Cleanse Existing Profiles: Reset fake 5.0 to 0.00 where total_ratings_count is 0
UPDATE worker_profiles 
SET average_rating = 0.00 
WHERE total_ratings_count = 0 AND average_rating = 5.00;

UPDATE provider_profiles 
SET average_rating = 0.00 
WHERE total_ratings_count = 0 AND average_rating = 5.00;

-- 4. Reviews Immutability RLS Hardening
-- Allow users to insert reviews for their own ID, but disallow regular user updates/deletes
DROP POLICY IF EXISTS "reviews_update_policy" ON reviews;
CREATE POLICY "reviews_update_policy" ON reviews FOR UPDATE
  USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "reviews_delete_policy" ON reviews;
CREATE POLICY "reviews_delete_policy" ON reviews FOR DELETE
  USING (current_user_role() = 'ADMIN');
