-- ==============================================================================
-- Supabase Baseline Seed: Reference Data & Test Fixtures
-- ==============================================================================

-- 1. Insert Official Work Categories
INSERT INTO categories (id, name, slug, description, icon, display_order, is_active) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Restaurant & Hospitality', 'restaurant-hospitality', 'Kitchen helper, server, dishwashing, catering assistant', 'utensils', 1, TRUE),
  ('a0000001-0000-0000-0000-000000000002', 'Retail & Shop Assistance', 'retail-shop-assistance', 'Store helper, inventory arrangement, billing counter assist', 'store', 2, TRUE),
  ('a0000001-0000-0000-0000-000000000003', 'Warehouse & Logistics', 'warehouse-logistics', 'Loading/unloading trucks, packaging, stock sorting', 'package', 3, TRUE),
  ('a0000001-0000-0000-0000-000000000004', 'Events & Setup', 'events-setup', 'Venue decoration setup, chairs/tables arrangement, registration', 'calendar-check', 4, TRUE),
  ('a0000001-0000-0000-0000-000000000005', 'Cleaning & Housekeeping', 'cleaning-housekeeping', 'Commercial cleaning, floor sanitization, post-event cleanup', 'sparkles', 5, TRUE),
  ('a0000001-0000-0000-0000-000000000006', 'Delivery & Courier', 'delivery-courier', 'Local parcel pickup/dropoff, document transport', 'truck', 6, TRUE),
  ('a0000001-0000-0000-0000-000000000007', 'Skilled Local Trades', 'skilled-trades', 'Electrician helper, plumbing repair, carpentry, painting', 'wrench', 7, TRUE),
  ('a0000001-0000-0000-0000-000000000008', 'Office & Admin Support', 'office-admin', 'Document scanning, filing, data entry, front desk relief', 'file-text', 8, TRUE),
  ('a0000001-0000-0000-0000-000000000009', 'Construction & Labor', 'construction-labor', 'Site cleanup, material carrying, digging, masonry helper', 'hammer', 9, TRUE),
  ('a0000001-0000-0000-0000-000000000010', 'Local Community Services', 'community-services', 'Elderly assistance, flyer distribution, queue management', 'users', 10, TRUE)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order;

-- 2. Insert Official Skills Taxonomy Tied to Categories
INSERT INTO skills (id, category_id, name, description, is_active) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'Kitchen Helper / Food Prep', 'Vegetable chopping, ingredient prep, kitchen sanitation', TRUE),
  ('b0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', 'Dishwashing & Cleaning', 'Commercial utensil washing and kitchen floor cleaning', TRUE),
  ('b0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000001', 'Table Service / Busser', 'Table clearing, water serving, meal delivery', TRUE),
  ('b0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000002', 'Shelf Stocking & Display', 'Display arrangement, expiry checking, stock replenishment', TRUE),
  ('b0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000002', 'Retail Customer Assistance', 'Guiding customers to aisles, packing purchased items', TRUE),
  ('b0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000003', 'Box Loading & Unloading', 'Heavy lifting, truck loading, pallet movement', TRUE),
  ('b0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000003', 'Packing & Labeling', 'Barcode scanning, box taping, shipping label attachment', TRUE),
  ('b0000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000004', 'Tent & Stage Setup', 'Stage building, canopy fixing, banner tying', TRUE),
  ('b0000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000004', 'Chair & Table Arrangement', 'Hall seating layout, tablecloth laying, stage clearance', TRUE),
  ('b0000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000007', 'Basic Electrical Repair', 'Switch replacement, wiring connection, bulb fitting', TRUE),
  ('b0000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000007', 'Basic Plumbing Helper', 'Pipe fitting assistance, tap leak fixes, drainage clearing', TRUE),
  ('b0000001-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000005', 'Commercial Floor Mopping', 'Deep mopping, buffing, waste bin clearance', TRUE),
  ('b0000001-0000-0000-0000-000000000013', 'a0000001-0000-0000-0000-000000000005', 'Window & Glass Cleaning', 'Glass pane cleaning with squeegee and spray', TRUE)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  category_id = EXCLUDED.category_id;

-- 3. Test Users
INSERT INTO users (id, auth_id, phone, full_name, email, role) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'auth_fixture_provider_1', '+919876543210', 'Ramesh Kumar (Provider)', 'ramesh.provider@example.com', 'PROVIDER'),
  ('c0000001-0000-0000-0000-000000000002', 'auth_fixture_worker_a', '+919876543211', 'Suresh Patel (Worker Within 5km)', 'suresh.worker@example.com', 'WORKER'),
  ('c0000001-0000-0000-0000-000000000003', 'auth_fixture_worker_b', '+919876543212', 'Anil Sharma (Worker Outside 5km)', 'anil.worker@example.com', 'WORKER'),
  ('c0000001-0000-0000-0000-000000000004', 'auth_fixture_agent_1', '+919876543213', 'Sunita Rao (Local Agent)', 'sunita.agent@example.com', 'AGENT'),
  ('c0000001-0000-0000-0000-000000000005', 'auth_fixture_admin_1', '+919876543214', 'Platform Admin', 'admin@nearvia.in', 'ADMIN')
ON CONFLICT (auth_id) DO NOTHING;

-- 4. Provider Profile (Indiranagar, Bengaluru: 12.9784 N, 77.6408 E)
INSERT INTO provider_profiles (id, user_id, provider_type, business_name, description, location, address_approximate, verified_business) VALUES
  ('d0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'BUSINESS', 'Green Grocers & Retail', 'Local supermarket needing quick unloading & shelf stocking helpers', ST_SetSRID(ST_MakePoint(77.6408, 12.9784), 4326), '100ft Road, Indiranagar, Bengaluru', TRUE)
ON CONFLICT (user_id) DO NOTHING;

-- 5. Worker Profiles (Spatial Geodesic Points)
-- Worker A (Domlur: 12.9610 N, 77.6372 E -> Distance: ~2.0 km from Provider)
INSERT INTO worker_profiles (id, user_id, bio, experience_years, location, address_approximate, service_radius_km, availability_status, is_available_now, available_until, average_rating, completed_tasks_count) VALUES
  ('e0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000002', 'Experienced retail helper and box unloading assistant', 2.5, ST_SetSRID(ST_MakePoint(77.6372, 12.9610), 4326), 'Domlur Layout, Bengaluru', 5.0, 'AVAILABLE_NOW', TRUE, NOW() + INTERVAL '4 hours', 4.90, 14)
ON CONFLICT (user_id) DO NOTHING;

-- Worker B (Whitefield: 12.9698 N, 77.7499 E -> Distance: ~11.8 km from Provider)
INSERT INTO worker_profiles (id, user_id, bio, experience_years, location, address_approximate, service_radius_km, availability_status, is_available_now, available_until, average_rating, completed_tasks_count) VALUES
  ('e0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000003', 'Experienced warehouse material handler', 4.0, ST_SetSRID(ST_MakePoint(77.7499, 12.9698), 4326), 'Whitefield Main Road, Bengaluru', 5.0, 'AVAILABLE_NOW', TRUE, NOW() + INTERVAL '4 hours', 4.80, 22)
ON CONFLICT (user_id) DO NOTHING;

-- 6. Worker Skills Association
INSERT INTO worker_skills (worker_id, skill_id, years_experience, is_verified) VALUES
  ('e0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000006', 2.0, TRUE),
  ('e0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000004', 1.5, TRUE),
  ('e0000001-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000006', 4.0, TRUE)
ON CONFLICT (worker_id, skill_id) DO NOTHING;

-- 7. Work Opportunity (Indiranagar: 12.9784 N, 77.6408 E)
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
  CURRENT_DATE + TIME '10:00:00',
  CURRENT_DATE + TIME '12:00:00',
  2.00,
  450.00,
  'FIXED',
  'INR',
  'Unload crates safely, place them on pallets, count delivery inventory.',
  'Report to back gate entrance and ask for Store Supervisor Ramesh.',
  TRUE,
  TRUE
),
(
  'f0000001-0000-0000-0000-000000000002',
  'd0000001-0000-0000-0000-000000000001',
  'a0000001-0000-0000-0000-000000000001',
  'Evening Kitchen Helper & Dishwasher Assistant',
  'Assist cafe kitchen with vegetable prep and dish cleaning.',
  'SHIFT',
  'URGENT',
  'PUBLISHED',
  2,
  0,
  ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326),
  'MG Road Cafe, Bengaluru',
  CURRENT_DATE,
  CURRENT_DATE + TIME '17:00:00',
  CURRENT_DATE + TIME '23:00:00',
  6.00,
  850.00,
  'FIXED',
  'INR',
  'Wash utensils, clear kitchen prep table, sort dish trays.',
  'Wear clean closed-toe footwear.',
  TRUE,
  TRUE
),
(
  'f0000001-0000-0000-0000-000000000003',
  'd0000001-0000-0000-0000-000000000001',
  'a0000001-0000-0000-0000-000000000004',
  'Residential Deep Cleaning (2 BHK)',
  'Help deep-clean tiled floors, bathrooms, and kitchen countertop.',
  'TASK',
  'URGENT',
  'PUBLISHED',
  2,
  0,
  ST_SetSRID(ST_MakePoint(77.5850, 12.9650), 4326),
  'Richmond Town, Bengaluru',
  CURRENT_DATE,
  CURRENT_DATE + TIME '09:00:00',
  CURRENT_DATE + TIME '13:00:00',
  4.00,
  700.00,
  'FIXED',
  'INR',
  'Floor scrubbing, window wipe, mirror polishing.',
  'All solutions and equipment provided by homeowner.',
  TRUE,
  TRUE
) ON CONFLICT (id) DO NOTHING;

-- 8. Work Opportunity Skills Association
INSERT INTO work_opportunity_skills (work_opportunity_id, skill_id, is_required, min_experience_years) VALUES
  ('f0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000006', TRUE, 0.5)
ON CONFLICT (work_opportunity_id, skill_id) DO NOTHING;

-- 9. Application from Worker A
INSERT INTO applications (id, work_opportunity_id, worker_id, status, proposed_wage, worker_notes, applied_at) VALUES
  ('a1000001-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'ACCEPTED', 450.00, 'I am in Domlur right now and can arrive in 10 minutes.', NOW())
ON CONFLICT (work_opportunity_id, worker_id) DO NOTHING;

-- 10. Assignment for Worker A
INSERT INTO assignments (id, work_opportunity_id, worker_id, provider_id, application_id, status, agreed_wage, payment_status) VALUES
  ('b1000001-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000001', 'COMPLETED', 450.00, 'CONFIRMED')
ON CONFLICT (id) DO NOTHING;

-- 11. Two-Sided Reviews
INSERT INTO reviews (id, assignment_id, reviewer_id, reviewee_id, rating, comments) VALUES
  ('c1000001-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000002', 5, 'Arrived on time and worked very diligently. Recommended.'),
  ('c1000001-0000-0000-0000-000000000002', 'b1000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', 5, 'Clear instructions and paid immediately upon completion.')
ON CONFLICT (assignment_id, reviewer_id) DO NOTHING;
