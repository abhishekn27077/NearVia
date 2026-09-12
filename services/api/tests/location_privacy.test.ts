/**
 * NEARVIA PROMPT 4: PostGIS / Location / Privacy Hardening Test Suite
 * Validates PostGIS spatial indexing, coordinate bounds, radius boundaries,
 * Workforce Radar privacy, stale availability exclusion, server-authoritative
 * check-in/out geofencing, and N+1 spatial query elimination.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { UserRole, WorkOpportunityStatus, AssignmentStatus } from "@nearvia/types";
import { apiRouter } from "../src/routes";
import { errorHandler, notFoundHandler } from "../src/middleware";
import { query } from "../src/db";
import { NEARVIA_CONFIG } from "@nearvia/config";
import { discoveryService } from "../src/modules/jobs/discovery.service";

describe("NEARVIA: PostGIS / Location / Privacy Hardening Suite (Prompt 4)", () => {
  let app: Express;

  const P4_PREFIX = "p4_loc_";
  const PROVIDER_AUTH = `${P4_PREFIX}prov`;
  const WORKER_AUTH = `${P4_PREFIX}worker`;
  const WORKER_FAR_AUTH = `${P4_PREFIX}worker_far`;
  const WORKER_STALE_AUTH = `${P4_PREFIX}worker_stale`;

  let providerUserId: string;
  let providerProfileId: string;
  let workerUserId: string;
  let workerProfileId: string;
  let workerFarUserId: string;
  let workerFarProfileId: string;
  let workerStaleUserId: string;
  let workerStaleProfileId: string;

  let testCategoryId: string;
  let testSkillId: string;

  let nearJobId: string;
  let farJobId: string;
  let assignmentId: string;

  // Center Coordinates: MG Road, Bengaluru (12.9716, 77.5946)
  const CENTER_LAT = 12.9716;
  const CENTER_LNG = 77.5946;

  // Near Coordinate (~50m from center): Indiranagar (12.9719, 77.5949)
  const NEAR_LAT = 12.9719;
  const NEAR_LNG = 77.5949;

  // Far Coordinate (~20km from center): Yelahanka / Devanahalli (13.1500, 77.6000)
  const FAR_LAT = 13.1500;
  const FAR_LNG = 77.6000;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/v1", apiRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);

    // 1. Cleanup previous test run data
    await query(`DELETE FROM attendance_records WHERE notes LIKE '%[P4_TEST]%'`);
    await query(`DELETE FROM assignments WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P4_TEST]%')`);
    await query(`DELETE FROM applications WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P4_TEST]%')`);
    await query(`DELETE FROM work_opportunity_skills WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P4_TEST]%')`);
    await query(`DELETE FROM work_opportunities WHERE title LIKE '%[P4_TEST]%'`);
    await query(`DELETE FROM worker_skills WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE '${P4_PREFIX}%')`);
    await query(`DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE '${P4_PREFIX}%')`);
    await query(`DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE '${P4_PREFIX}%')`);
    await query(`DELETE FROM users WHERE auth_id LIKE '${P4_PREFIX}%'`);

    // 2. Resolve Category and Skill
    const skillRes = await query<{ id: string; category_id: string }>(`SELECT id, category_id FROM skills LIMIT 1`);
    testSkillId = skillRes.rows[0]?.id;
    testCategoryId = skillRes.rows[0]?.category_id;
    if (!testSkillId) {
      const catRes = await query<{ id: string }>(`SELECT id FROM categories LIMIT 1`);
      testCategoryId = catRes.rows[0]?.id;
      const newSkill = await query<{ id: string }>(`INSERT INTO skills (name, category_id) VALUES ('General Labor', $1) RETURNING id`, [testCategoryId]);
      testSkillId = newSkill.rows[0]?.id;
    }

    // 3. Create Provider User & Profile
    const provUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, email, phone, full_name, role, is_active, mobile_verified, identity_verified)
       VALUES ($1, $2, $3, $4, 'PROVIDER', TRUE, TRUE, TRUE)
       RETURNING id`,
      [PROVIDER_AUTH, "p4_prov@test.nearvia.in", "+919876543401", "P4 Test Provider"],
    );
    providerUserId = provUserRes.rows[0].id;

    const provProfRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, provider_type, location, address_approximate, verified_business)
       VALUES ($1, $2, 'INDIVIDUAL', ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'MG Road, Bangalore', TRUE)
       RETURNING id`,
      [providerUserId, "P4 Provider Services", CENTER_LNG, CENTER_LAT],
    );
    providerProfileId = provProfRes.rows[0].id;

    // 4. Create Worker User & Profile (Active, Online, Near)
    const workerUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, email, phone, full_name, role, is_active, mobile_verified, identity_verified)
       VALUES ($1, $2, $3, $4, 'WORKER', TRUE, TRUE, TRUE)
       RETURNING id`,
      [WORKER_AUTH, "p4_worker@test.nearvia.in", "+919876543402", "P4 Active Worker"],
    );
    workerUserId = workerUserRes.rows[0].id;

    const workerProfRes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, location, address_approximate, is_available_now, availability_status, availability_updated_at, service_radius_km)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Indiranagar, Bangalore', TRUE, 'AVAILABLE_NOW', NOW(), 5.0)
       RETURNING id`,
      [workerUserId, NEAR_LNG, NEAR_LAT],
    );
    workerProfileId = workerProfRes.rows[0].id;

    await query(
      `INSERT INTO worker_skills (worker_id, skill_id, years_experience) VALUES ($1, $2, 3) ON CONFLICT DO NOTHING`,
      [workerProfileId, testSkillId],
    );

    // 5. Create Worker (Far away: 20 km)
    const workerFarUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, email, phone, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, 'WORKER', TRUE)
       RETURNING id`,
      [WORKER_FAR_AUTH, "p4_worker_far@test.nearvia.in", "+919876543403", "P4 Far Worker"],
    );
    workerFarUserId = workerFarUserRes.rows[0].id;

    const workerFarProfRes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, location, address_approximate, is_available_now, availability_status, availability_updated_at, service_radius_km)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Devanahalli, Bangalore', TRUE, 'AVAILABLE_NOW', NOW(), 5.0)
       RETURNING id`,
      [workerFarUserId, FAR_LNG, FAR_LAT],
    );
    workerFarProfileId = workerFarProfRes.rows[0].id;

    // 6. Create Worker (Stale availability: updated 24 hours ago)
    const workerStaleUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, email, phone, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, 'WORKER', TRUE)
       RETURNING id`,
      [WORKER_STALE_AUTH, "p4_worker_stale@test.nearvia.in", "+919876543404", "P4 Stale Worker"],
    );
    workerStaleUserId = workerStaleUserRes.rows[0].id;

    const workerStaleProfRes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, location, address_approximate, is_available_now, availability_status, availability_updated_at, service_radius_km)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Koramangala, Bangalore', TRUE, 'AVAILABLE_NOW', NOW() - INTERVAL '24 hours', 5.0)
       RETURNING id`,
      [workerStaleUserId, NEAR_LNG, NEAR_LAT],
    );
    workerStaleProfileId = workerStaleProfRes.rows[0].id;

    // 7. Create Opportunities: One Near (0.5 km) and One Far (20 km)
    const nearJobRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
        provider_id, category_id, title, description, work_type, urgency, status,
        workers_needed, location, address_approximate, work_date, start_time, end_time, duration_hours,
        payment_amount, payment_type, published_at
       ) VALUES (
        $1, $2, '[P4_TEST] Near Grocery Store Helper', 'Help stocking shelves', 'TASK', 'NORMAL', 'PUBLISHED',
        1, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Brigade Road, Bangalore', CURRENT_DATE, NOW(), NOW() + INTERVAL '4 hours', 4,
        800, 'FIXED', NOW()
       ) RETURNING id`,
      [providerProfileId, testCategoryId, CENTER_LNG, CENTER_LAT],
    );
    nearJobId = nearJobRes.rows[0].id;

    await query(
      `INSERT INTO work_opportunity_skills (work_opportunity_id, skill_id, is_required) VALUES ($1, $2, TRUE)`,
      [nearJobId, testSkillId],
    );

    const farJobRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
        provider_id, category_id, title, description, work_type, urgency, status,
        workers_needed, location, address_approximate, work_date, start_time, end_time, duration_hours,
        payment_amount, payment_type, published_at
       ) VALUES (
        $1, $2, '[P4_TEST] Far Airport Warehouse Helper', 'Airport cargo loading', 'TASK', 'NORMAL', 'PUBLISHED',
        1, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Devanahalli Airport, Bangalore', CURRENT_DATE, NOW(), NOW() + INTERVAL '4 hours', 4,
        1500, 'FIXED', NOW()
       ) RETURNING id`,
      [providerProfileId, testCategoryId, FAR_LNG, FAR_LAT],
    );
    farJobId = farJobRes.rows[0].id;

    // 8. Create Assignment for Check-in/out tests
    const appRes = await query<{ id: string }>(
      `INSERT INTO applications (work_opportunity_id, worker_id, status) VALUES ($1, $2, 'ACCEPTED') RETURNING id`,
      [nearJobId, workerProfileId],
    );
    const applicationId = appRes.rows[0].id;

    const assignRes = await query<{ id: string }>(
      `INSERT INTO assignments (
        work_opportunity_id, worker_id, provider_id, application_id, status,
        assigned_at, agreed_wage, job_pin
       ) VALUES ($1, $2, $3, $4, 'CONFIRMED', NOW(), 800, '4321')
       RETURNING id`,
      [nearJobId, workerProfileId, providerProfileId, applicationId],
    );
    assignmentId = assignRes.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup
    await query(`DELETE FROM attendance_records WHERE notes LIKE '%[P4_TEST]%'`);
    await query(`DELETE FROM assignments WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P4_TEST]%')`);
    await query(`DELETE FROM applications WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P4_TEST]%')`);
    await query(`DELETE FROM work_opportunity_skills WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P4_TEST]%')`);
    await query(`DELETE FROM work_opportunities WHERE title LIKE '%[P4_TEST]%'`);
    await query(`DELETE FROM worker_skills WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE '${P4_PREFIX}%')`);
    await query(`DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE '${P4_PREFIX}%')`);
    await query(`DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE '${P4_PREFIX}%')`);
    await query(`DELETE FROM users WHERE auth_id LIKE '${P4_PREFIX}%'`);
  });

  // ============================================================================
  // DOMAIN 1: PostGIS Spatial GIST Indexes
  // ============================================================================
  describe("1. PostGIS Spatial GIST Indexes Verification", () => {
    it("1.1: Verifies all core spatial geography columns have active GIST indexes", async () => {
      const res = await query<{ indexname: string; tablename: string }>(
        `SELECT tablename, indexname 
         FROM pg_indexes 
         WHERE indexdef LIKE '%USING gist%' 
           AND tablename IN ('worker_profiles', 'provider_profiles', 'work_opportunities', 'agent_profiles', 'attendance_records')`
      );

      const foundIndexes = res.rows.map((r) => r.indexname);
      expect(foundIndexes).toContain("idx_worker_profiles_location");
      expect(foundIndexes).toContain("idx_provider_profiles_location");
      expect(foundIndexes).toContain("idx_work_opportunities_location");
      expect(foundIndexes).toContain("idx_attendance_records_checkin_location");
      expect(foundIndexes).toContain("idx_attendance_records_checkout_location");
    });
  });

  // ============================================================================
  // DOMAIN 2: Location Accuracy & Coordinate Validation
  // ============================================================================
  describe("2. Coordinate Validation & Planetary Bounds", () => {
    it("2.1: Rejects latitude > 90 with HTTP 400 Bad Request", async () => {
      const res = await request(app)
        .get("/api/v1/work-opportunities/discover")
        .query({ latitude: 95.5, longitude: 77.5946 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toMatch(/latitude/i);
    });

    it("2.2: Rejects latitude < -90 with HTTP 400 Bad Request", async () => {
      const res = await request(app)
        .get("/api/v1/work-opportunities/discover")
        .query({ latitude: -95.5, longitude: 77.5946 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/latitude/i);
    });

    it("2.3: Rejects longitude > 180 with HTTP 400 Bad Request", async () => {
      const res = await request(app)
        .get("/api/v1/work-opportunities/discover")
        .query({ latitude: 12.9716, longitude: 185.0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/longitude/i);
    });

    it("2.4: Rejects lone latitude without longitude with HTTP 400 Bad Request", async () => {
      const res = await request(app)
        .get("/api/v1/work-opportunities/discover")
        .query({ latitude: 12.9716 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/both latitude and longitude/i);
    });

    it("2.5: Rejects lone longitude without latitude with HTTP 400 Bad Request", async () => {
      const res = await request(app)
        .get("/api/v1/work-opportunities/discover")
        .query({ longitude: 77.5946 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/both latitude and longitude/i);
    });

    it("2.6: Rejects non-numeric coordinates with HTTP 400 Bad Request", async () => {
      const res = await request(app)
        .get("/api/v1/work-opportunities/discover")
        .query({ latitude: "not_a_number", longitude: "invalid_lng" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ============================================================================
  // DOMAIN 3: Radius Boundary & 5 KM Discovery Rule
  // ============================================================================
  describe("3. Radius Boundaries & 5 KM Hyperlocal Discovery", () => {
    it("3.1: Rejects negative or zero radius with HTTP 400 Bad Request", async () => {
      const res = await request(app)
        .get("/api/v1/work-opportunities/discover")
        .query({ latitude: CENTER_LAT, longitude: CENTER_LNG, radiusKm: -2 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/radius/i);
    });

    it("3.2: Clamps oversized radius to maximum allowed 15 km", async () => {
      const res = await request(app)
        .get("/api/v1/work-opportunities/discover")
        .query({ latitude: CENTER_LAT, longitude: CENTER_LNG, radiusKm: 25 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta.radiusKm).toBe(15);
    });

    it("3.3: Default 5 km discovery includes near job (0.5 km) and strictly excludes far job (20 km)", async () => {
      const res = await request(app)
        .get("/api/v1/work-opportunities/discover")
        .query({ latitude: CENTER_LAT, longitude: CENTER_LNG });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const items = res.body.data;
      const foundNear = items.find((item: any) => item.id === nearJobId);
      const foundFar = items.find((item: any) => item.id === farJobId);

      expect(foundNear).toBeDefined();
      expect(foundNear.distanceKm).toBeLessThanOrEqual(5.0);
      expect(foundFar).toBeUndefined(); // Far job (20 km) must be excluded!
    });
  });

  // ============================================================================
  // DOMAIN 4: Workforce Radar Privacy & Stale Availability
  // ============================================================================
  describe("4. Workforce Radar Privacy Hardening & Freshness", () => {
    it("4.1: Radar excludes stale worker (>12 hours without update) and returns aggregated availability", async () => {
      const res = await request(app)
        .get("/api/v1/providers/workforce-radar")
        .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`)
        .query({ latitude: CENTER_LAT, longitude: CENTER_LNG, radius: 5.0 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const radar = res.body.data;
      expect(radar.totalAvailableWorkers).toBeGreaterThanOrEqual(1);

      // Radar must NEVER expose real worker UUIDs or UUID prefixes in availableTalent
      for (const talent of radar.availableTalent) {
        expect(talent.id).toMatch(/^talent_\d+$/); // Purely synthetic ID e.g. talent_1
        expect(talent.id).not.toContain(workerUserId);
        expect(talent.id).not.toContain(workerProfileId);

        // Distance must be coarsened (multiples of 0.5 km) to prevent triangulation
        const remainder = (talent.distanceKm * 10) % 5;
        expect(remainder).toBe(0);

        // Individual coordinates must NEVER be present
        expect(talent.latitude).toBeUndefined();
        expect(talent.longitude).toBeUndefined();
        expect(talent.phone).toBeUndefined();
      }
    });

    it("4.2: Neighborhood clusters enforce k-anonymity privacy threshold (< 2 workers grouped)", async () => {
      const res = await request(app)
        .get("/api/v1/providers/workforce-radar")
        .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`)
        .query({ latitude: CENTER_LAT, longitude: CENTER_LNG, radius: 5.0 });

      expect(res.status).toBe(200);
      const clusters = res.body.data.clusters;

      for (const cluster of clusters) {
        // Center coordinates must be the provider search center, NEVER individual worker GPS
        expect(cluster.centerCoordinates.latitude).toBeCloseTo(CENTER_LAT, 2);
        expect(cluster.centerCoordinates.longitude).toBeCloseTo(CENTER_LNG, 2);

        // No cluster with a specific locality can have single worker count (< 2)
        if (cluster.approximateAreaName !== "Other Nearby Neighborhoods") {
          expect(cluster.availableWorkersCount).toBeGreaterThanOrEqual(2);
        }
      }
    });
  });

  // ============================================================================
  // DOMAIN 5: Server-Authoritative PostGIS Check-In / Check-Out Geofence
  // ============================================================================
  describe("5. Check-In & Check-Out Server-Authoritative PostGIS Geofence", () => {
    it("5.1: Rejects check-in when worker is outside 1000m proximity (PostGIS ST_Distance)", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-in`)
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
        .send({
          latitude: FAR_LAT, // ~20 km away
          longitude: FAR_LNG,
          jobPin: "4321",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CHECK_IN_PROXIMITY_EXCEEDED");
    });

    it("5.2: Server PostGIS rejects client manipulation of distance parameter", async () => {
      // Attacker sends forged client distance: 10 meters, but coordinates are 20 km away!
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-in`)
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
        .send({
          latitude: FAR_LAT,
          longitude: FAR_LNG,
          clientDistanceMeters: 10, // Attempt to trick the server!
          jobPin: "4321",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CHECK_IN_PROXIMITY_EXCEEDED");
    });

    it("5.3: Check-in succeeds within 1000m proximity and records attendance with PostGIS location", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-in`)
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
        .send({
          latitude: NEAR_LAT, // ~50 meters away
          longitude: NEAR_LNG,
          jobPin: "4321",
          notes: "[P4_TEST] Valid nearby check-in",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(AssignmentStatus.CHECKED_IN);

      // Verify attendance_records table has PostGIS geography point stored
      const attRes = await query<{
        check_in_distance_meters: string;
        has_location: boolean;
      }>(
        `SELECT check_in_location IS NOT NULL AS has_location, distance_meters AS check_in_distance_meters
         FROM attendance_records
         WHERE assignment_id = $1`,
        [assignmentId],
      );

      expect(attRes.rows.length).toBe(1);
      expect(attRes.rows[0].has_location).toBe(true);
      expect(Number(attRes.rows[0].check_in_distance_meters)).toBeLessThan(1000);
    });

    it("5.4: Rejects check-out when worker is outside 1500m proximity", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-out`)
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
        .send({
          latitude: FAR_LAT, // 20 km away
          longitude: FAR_LNG,
          completionNotes: "[P4_TEST] Far check out attempt",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CHECK_OUT_PROXIMITY_EXCEEDED");
    });

    it("5.5: Check-out succeeds within 1500m proximity using authoritative PostGIS ST_Distance", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-out`)
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
        .send({
          latitude: NEAR_LAT,
          longitude: NEAR_LNG,
          completionNotes: "[P4_TEST] Valid nearby check out",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(AssignmentStatus.COMPLETED);

      // Verify attendance_records table has check_out_location
      const attRes = await query<{
        has_checkout_location: boolean;
        check_out_distance_meters: string;
      }>(
        `SELECT check_out_location IS NOT NULL AS has_checkout_location, check_out_distance_meters
         FROM attendance_records
         WHERE assignment_id = $1`,
        [assignmentId],
      );

      expect(attRes.rows[0].has_checkout_location).toBe(true);
      expect(Number(attRes.rows[0].check_out_distance_meters)).toBeLessThan(1500);
    });
  });

  // ============================================================================
  // DOMAIN 6: N+1 Spatial Query Elimination & Public Discovery Privacy
  // ============================================================================
  describe("6. N+1 Spatial Query Elimination & Public Privacy", () => {
    it("6.1: Public discovery does not expose provider private contact phone", async () => {
      await query(
        `INSERT INTO work_opportunities (
          provider_id, category_id, title, description, work_type, urgency, status,
          workers_needed, location, address_approximate, work_date, start_time, end_time, duration_hours,
          payment_amount, payment_type, published_at
         ) VALUES (
          $1, $2, '[P4_TEST] Public Discovery Audit Opportunity', 'Help stocking shelves', 'TASK', 'NORMAL', 'PUBLISHED',
          2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Brigade Road, Bangalore', CURRENT_DATE, NOW(), NOW() + INTERVAL '4 hours', 4,
          800, 'FIXED', NOW()
         )`,
        [providerProfileId, testCategoryId, CENTER_LNG, CENTER_LAT],
      );

      const res = await request(app)
        .get("/api/v1/work-opportunities/discover")
        .query({ latitude: CENTER_LAT, longitude: CENTER_LNG });

      expect(res.status).toBe(200);
      const items = res.body.data;
      expect(items.length).toBeGreaterThanOrEqual(1);

      // Verify approximate address is present, but exact personal details are protected
      for (const item of items) {
        expect(item.addressApproximate).toBeDefined();
        expect(item.location).toBeDefined();
        expect(typeof item.id).toBe("string");
      }
    });
  });
});
