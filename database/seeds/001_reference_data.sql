-- ==============================================================================
-- Seed: 001_reference_data.sql
-- Purpose: Initial Baseline Categories and Verified Skills Taxonomy
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
  -- Restaurant & Hospitality
  ('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'Kitchen Helper / Food Prep', 'Vegetable chopping, ingredient prep, kitchen sanitation', TRUE),
  ('b0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', 'Dishwashing & Cleaning', 'Commercial utensil washing and kitchen floor cleaning', TRUE),
  ('b0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000001', 'Table Service / Busser', 'Table clearing, water serving, meal delivery', TRUE),

  -- Retail & Shop Assistance
  ('b0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000002', 'Shelf Stocking & Display', 'Display arrangement, expiry checking, stock replenishment', TRUE),
  ('b0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000002', 'Retail Customer Assistance', 'Guiding customers to aisles, packing purchased items', TRUE),

  -- Warehouse & Logistics
  ('b0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000003', 'Box Loading & Unloading', 'Heavy lifting, truck loading, pallet movement', TRUE),
  ('b0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000003', 'Packing & Labeling', 'Barcode scanning, box taping, shipping label attachment', TRUE),

  -- Events & Setup
  ('b0000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000004', 'Tent & Stage Setup', 'Stage building, canopy fixing, banner tying', TRUE),
  ('b0000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000004', 'Chair & Table Arrangement', 'Hall seating layout, tablecloth laying, stage clearance', TRUE),

  -- Skilled Local Trades
  ('b0000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000007', 'Basic Electrical Repair', 'Switch replacement, wiring connection, bulb fitting', TRUE),
  ('b0000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000007', 'Basic Plumbing Helper', 'Pipe fitting assistance, tap leak fixes, drainage clearing', TRUE),

  -- Cleaning & Housekeeping
  ('b0000001-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000005', 'Commercial Floor Mopping', 'Deep mopping, buffing, waste bin clearance', TRUE),
  ('b0000001-0000-0000-0000-000000000013', 'a0000001-0000-0000-0000-000000000005', 'Window & Glass Cleaning', 'Glass pane cleaning with squeegee and spray', TRUE)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  category_id = EXCLUDED.category_id;
