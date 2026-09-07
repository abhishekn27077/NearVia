-- ==============================================================================
-- Seed: 002_test_fixtures.sql
-- Purpose: Deterministic Test Fixtures for Spatial 5 KM Validation and Data Integrity
-- Location Center: Indiranagar, Bengaluru (12.9784, 77.6408)
-- Worker A: Domlur (~2.0 km -> WITHIN 5 km)
-- Worker B: Whitefield (~11.8 km -> OUTSIDE 5 km)
-- ==============================================================================

-- 1. Test Users
INSERT INTO users (id, auth_id, phone, full_name, email, role) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'auth_fixture_provider_1', '+919876543210', 'Ramesh Kumar (Provider)', 'ramesh.provider@example.com', 'PROVIDER'),
  ('c0000001-0000-0000-0000-000000000002', 'auth_fixture_worker_a', '+919876543211', 'Suresh Patel (Worker Within 5km)', 'suresh.worker@example.com', 'WORKER'),
  ('c0000001-0000-0000-0000-000000000003', 'auth_fixture_worker_b', '+919876543212', 'Anil Sharma (Worker Outside 5km)', 'anil.worker@example.com', 'WORKER'),
  ('c0000001-0000-0000-0000-000000000004', 'auth_fixture_agent_1', '+919876543213', 'Sunita Rao (Local Agent)', 'sunita.agent@example.com', 'AGENT'),
  ('c0000001-0000-0000-0000-000000000005', 'auth_fixture_admin_1', '+919876543214', 'Platform Admin', 'admin@nearvia.in', 'ADMIN')
ON CONFLICT (auth_id) DO NOTHING;

-- 2. Provider Profile (Indiranagar, Bengaluru: 12.9784 N, 77.6408 E)
INSERT INTO provider_profiles (id, user_id, provider_type, business_name, description, location, address_approximate, verified_business) VALUES
  ('d0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'BUSINESS', 'Green Grocers & Retail', 'Local supermarket needing quick unloading & shelf stocking helpers', ST_SetSRID(ST_MakePoint(77.6408, 12.9784), 4326), '100ft Road, Indiranagar, Bengaluru', TRUE)
ON CONFLICT (user_id) DO NOTHING;

-- 3. Worker Profiles (Spatial Geodesic Points)
-- Worker A (Domlur: 12.9610 N, 77.6372 E -> Distance: ~2.0 km from Provider)
INSERT INTO worker_profiles (id, user_id, bio, experience_years, location, address_approximate, service_radius_km, availability_status, is_available_now, available_until, average_rating, completed_tasks_count) VALUES
  ('e0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000002', 'Experienced retail helper and box unloading assistant', 2.5, ST_SetSRID(ST_MakePoint(77.6372, 12.9610), 4326), 'Domlur Layout, Bengaluru', 5.0, 'AVAILABLE_NOW', TRUE, NOW() + INTERVAL '4 hours', 4.90, 14)
ON CONFLICT (user_id) DO NOTHING;

-- Worker B (Whitefield: 12.9698 N, 77.7499 E -> Distance: ~11.8 km from Provider)
INSERT INTO worker_profiles (id, user_id, bio, experience_years, location, address_approximate, service_radius_km, availability_status, is_available_now, available_until, average_rating, completed_tasks_count) VALUES
  ('e0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000003', 'Experienced warehouse material handler', 4.0, ST_SetSRID(ST_MakePoint(77.7499, 12.9698), 4326), 'Whitefield Main Road, Bengaluru', 5.0, 'AVAILABLE_NOW', TRUE, NOW() + INTERVAL '4 hours', 4.80, 22)
ON CONFLICT (user_id) DO NOTHING;

-- 4. Worker Skills Association
INSERT INTO worker_skills (worker_id, skill_id, years_experience, is_verified) VALUES
  ('e0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000006', 2.0, TRUE), -- Worker A: Box Loading & Unloading
  ('e0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000004', 1.5, TRUE), -- Worker A: Shelf Stocking
  ('e0000001-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000006', 4.0, TRUE)  -- Worker B: Box Loading & Unloading
ON CONFLICT (worker_id, skill_id) DO NOTHING;

-- 5. Work Opportunity (Micro-Task at Indiranagar: 12.9784 N, 77.6408 E)
INSERT INTO work_opportunities (
  id, provider_id, category_id, title, description, work_type, urgency, status,
  workers_needed, workers_assigned, location, address_approximate, work_date,
  start_time, end_time, duration_hours, payment_amount, payment_type, currency,
  responsibilities, instructions, tools_provided, orientation_provided
) VALUES (
  'f0000001-0000-0000-0000-000000000001',
  'd0000001-0000-0000-0000-000000000001',
  'a0000001-0000-0000-0000-000000000003',
  'Unload Delivery Truck (2 Hours)',
  'Need 2 energetic helpers to unload 40 grocery crates from delivery van to backroom.',
  'TASK',
  'URGENT',
  'PUBLISHED',
  2,
  1,
  ST_SetSRID(ST_MakePoint(77.6408, 12.9784), 4326),
  '100ft Road, Indiranagar, Bengaluru',
  CURRENT_DATE,
  NOW() + INTERVAL '1 hour',
  NOW() + INTERVAL '3 hours',
  2.00,
  450.00,
  'FIXED',
  'INR',
  'Unload crates safely, place them on pallets, count delivery inventory.',
  'Report to back gate entrance and ask for Store Supervisor Ramesh.',
  TRUE,
  TRUE
) ON CONFLICT (id) DO NOTHING;

-- 6. Work Opportunity Skills Association
INSERT INTO work_opportunity_skills (work_opportunity_id, skill_id, is_required, min_experience_years) VALUES
  ('f0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000006', TRUE, 0.5)
ON CONFLICT (work_opportunity_id, skill_id) DO NOTHING;

-- 7. Application from Worker A
INSERT INTO applications (id, work_opportunity_id, worker_id, status, proposed_wage, worker_notes, applied_at) VALUES
  ('a1000001-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'ACCEPTED', 450.00, 'I am in Domlur right now and can arrive in 10 minutes.', NOW())
ON CONFLICT (work_opportunity_id, worker_id) DO NOTHING;

-- 8. Assignment for Worker A
INSERT INTO assignments (id, work_opportunity_id, worker_id, provider_id, application_id, status, agreed_wage, payment_status) VALUES
  ('b1000001-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000001', 'COMPLETED', 450.00, 'RECORDED')
ON CONFLICT (id) DO NOTHING;

-- 9. Two-Sided Review for the Completed Assignment
INSERT INTO reviews (id, assignment_id, reviewer_id, reviewee_id, rating, comments) VALUES
  ('c1000001-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000002', 5, 'Arrived on time and worked very diligently. Recommended.'),
  ('c1000001-0000-0000-0000-000000000002', 'b1000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', 5, 'Clear instructions and paid immediately upon completion.')
ON CONFLICT (assignment_id, reviewer_id) DO NOTHING;
