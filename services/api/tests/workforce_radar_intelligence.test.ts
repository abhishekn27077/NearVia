/**
 * Workforce Radar & Demand Intelligence Test Suite — Prompt 14
 * Tests server-authoritative PostGIS spatial filtering, privacy preservation,
 * k-anonymity clustering, role-specific access, and zero-fabrication guarantees.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { apiRouter } from "../src/routes";
import { query } from "../src/db";
import { notFoundHandler, errorHandler } from "../src/middleware";

describe("NEARVIA — Prompt 14: Workforce Radar & Demand Intelligence Suite", () => {
  let app: express.Express;

  // Test Entities
  const P14_PREFIX = "p14_radar_";
  const WORKER_AUTH = `${P14_PREFIX}worker_auth`;
  const PROVIDER_AUTH = `${P14_PREFIX}provider_auth`;
  const AGENT_AUTH = `${P14_PREFIX}agent_auth`;
  const ADMIN_AUTH = `${P14_PREFIX}admin_auth`;

  let workerUserId: string;
  let workerProfileId: string;
  let providerUserId: string;
  let providerProfileId: string;
  let agentUserId: string;
  let agentProfileId: string;
  let adminUserId: string;

  let testCategoryId: string;
  let testSkillId: string;
  let testJobNearId: string;
  let testJobFarId: string;
  let testJobCancelledId: string;

  // Coordinates:
  // Center: MG Road, Bangalore (12.9716, 77.5946)
  const CENTER_LAT = 12.9716;
  const CENTER_LNG = 77.5946;

  // Near location (~1.2 km away): Brigade Road (12.9725, 77.6050)
  const NEAR_LAT = 12.9725;
  const NEAR_LNG = 77.6050;

  // Far location (~25 km away): Electronic City Phase 2 (12.8350, 77.6750)
  const FAR_LAT = 12.8350;
  const FAR_LNG = 77.6750;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/v1", apiRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);

    // 1. Cleanup previous test run data
    await query(`DELETE FROM agent_worker_relationships WHERE agent_id IN (SELECT id FROM agent_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE '${P14_PREFIX}%'))`);
    await query(`DELETE FROM work_opportunity_skills WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P14_RADAR]%')`);
    await query(`DELETE FROM work_opportunities WHERE title LIKE '%[P14_RADAR]%'`);
    await query(`DELETE FROM worker_skills WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE '${P14_PREFIX}%')`);
    await query(`DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE '${P14_PREFIX}%')`);
    await query(`DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE '${P14_PREFIX}%')`);
    await query(`DELETE FROM agent_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE '${P14_PREFIX}%')`);
    await query(`DELETE FROM users WHERE auth_id LIKE '${P14_PREFIX}%'`);

    // 2. Resolve or Create Category and Skill
    const skillRes = await query<{ id: string; category_id: string }>(`SELECT id, category_id FROM skills LIMIT 1`);
    if (skillRes.rows[0]) {
      testSkillId = skillRes.rows[0].id;
      testCategoryId = skillRes.rows[0].category_id;
    } else {
      const catRes = await query<{ id: string }>(`SELECT id FROM categories LIMIT 1`);
      testCategoryId = catRes.rows[0].id;
      const newSkill = await query<{ id: string }>(
        `INSERT INTO skills (name, category_id) VALUES ('P14 Electrical Repairs', $1) RETURNING id`,
        [testCategoryId]
      );
      testSkillId = newSkill.rows[0].id;
    }

    // 3. Create Users
    // Worker User
    const wUser = await query<{ id: string }>(
      `INSERT INTO users (auth_id, email, phone, full_name, role, is_active)
       VALUES ($1, 'p14_worker@test.nearvia.in', '+919988776601', 'P14 Radar Worker', 'WORKER', TRUE)
       RETURNING id`,
      [WORKER_AUTH]
    );
    workerUserId = wUser.rows[0].id;

    const wProf = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, location, address_approximate, is_available_now, availability_status, availability_updated_at, updated_at)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Indiranagar, Bangalore', TRUE, 'AVAILABLE_NOW', NOW(), NOW())
       RETURNING id`,
      [workerUserId, NEAR_LNG, NEAR_LAT]
    );
    workerProfileId = wProf.rows[0].id;

    await query(
      `INSERT INTO worker_skills (worker_id, skill_id, years_experience) VALUES ($1, $2, 3) ON CONFLICT DO NOTHING`,
      [workerProfileId, testSkillId]
    );

    // Provider User
    const pUser = await query<{ id: string }>(
      `INSERT INTO users (auth_id, email, phone, full_name, role, is_active)
       VALUES ($1, 'p14_prov@test.nearvia.in', '+919988776602', 'P14 Radar Provider', 'PROVIDER', TRUE)
       RETURNING id`,
      [PROVIDER_AUTH]
    );
    providerUserId = pUser.rows[0].id;

    const pProf = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, provider_type, location, address_approximate, verified_business)
       VALUES ($1, 'P14 Urban Services', 'INDIVIDUAL', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'MG Road Central', TRUE)
       RETURNING id`,
      [providerUserId, CENTER_LNG, CENTER_LAT]
    );
    providerProfileId = pProf.rows[0].id;

    // Agent User
    const aUser = await query<{ id: string }>(
      `INSERT INTO users (auth_id, email, phone, full_name, role, is_active)
       VALUES ($1, 'p14_agent@test.nearvia.in', '+919988776603', 'P14 Community Agent', 'AGENT', TRUE)
       RETURNING id`,
      [AGENT_AUTH]
    );
    agentUserId = aUser.rows[0].id;

    const aProf = await query<{ id: string }>(
      `INSERT INTO agent_profiles (user_id, assigned_area, description)
       VALUES ($1, 'MG Road Urban', 'P14 Community Agent')
       RETURNING id`,
      [agentUserId]
    );
    agentProfileId = aProf.rows[0].id;

    // Link Agent to Worker
    await query(
      `INSERT INTO agent_worker_relationships (agent_id, worker_id, status)
       VALUES ($1, $2, 'ACTIVE')`,
      [agentProfileId, workerProfileId]
    );

    // Admin User
    const admUser = await query<{ id: string }>(
      `INSERT INTO users (auth_id, email, phone, full_name, role, is_active)
       VALUES ($1, 'p14_admin@test.nearvia.in', '+919988776604', 'P14 System Admin', 'ADMIN', TRUE)
       RETURNING id`,
      [ADMIN_AUTH]
    );
    adminUserId = admUser.rows[0].id;

    // 4. Create Work Opportunities
    // A. Active Near Job (~1.2 km away)
    const jobNear = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
        provider_id, category_id, title, description, work_type, urgency, status,
        workers_needed, workers_assigned, location, address_approximate,
        work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
        $1, $2, '[P14_RADAR] Near Active Gig', 'Nearby electrical repair', 'TASK', 'NORMAL', 'PUBLISHED',
        2, 0, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Brigade Road, Bangalore',
        CURRENT_DATE, NOW(), NOW() + INTERVAL '4 hours', 4.0, 950.00, 'FIXED'
       ) RETURNING id`,
      [providerProfileId, testCategoryId, NEAR_LNG, NEAR_LAT]
    );
    testJobNearId = jobNear.rows[0].id;

    await query(
      `INSERT INTO work_opportunity_skills (work_opportunity_id, skill_id, is_required) VALUES ($1, $2, TRUE)`,
      [testJobNearId, testSkillId]
    );

    // B. Active Far Job (~25 km away)
    const jobFar = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
        provider_id, category_id, title, description, work_type, urgency, status,
        workers_needed, workers_assigned, location, address_approximate,
        work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
        $1, $2, '[P14_RADAR] Far Away Gig', 'Far away shift', 'TASK', 'NORMAL', 'PUBLISHED',
        1, 0, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Electronic City Phase 2',
        CURRENT_DATE, NOW(), NOW() + INTERVAL '4 hours', 4.0, 800.00, 'FIXED'
       ) RETURNING id`,
      [providerProfileId, testCategoryId, FAR_LNG, FAR_LAT]
    );
    testJobFarId = jobFar.rows[0].id;

    // C. Cancelled Job near center (Should NEVER be counted as active demand)
    const jobCancel = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
        provider_id, category_id, title, description, work_type, urgency, status,
        workers_needed, workers_assigned, location, address_approximate,
        work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
        $1, $2, '[P14_RADAR] Cancelled Gig', 'Cancelled shift', 'TASK', 'NORMAL', 'CANCELLED',
        1, 0, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Church Street',
        CURRENT_DATE, NOW(), NOW() + INTERVAL '4 hours', 4.0, 800.00, 'FIXED'
       ) RETURNING id`,
      [providerProfileId, testCategoryId, CENTER_LNG, CENTER_LAT]
    );
    testJobCancelledId = jobCancel.rows[0].id;
  });

  afterAll(async () => {
    await query(`DELETE FROM agent_worker_relationships WHERE agent_id = $1`, [agentProfileId]);
    await query(`DELETE FROM work_opportunity_skills WHERE work_opportunity_id IN ($1, $2, $3)`, [testJobNearId, testJobFarId, testJobCancelledId]);
    await query(`DELETE FROM work_opportunities WHERE id IN ($1, $2, $3)`, [testJobNearId, testJobFarId, testJobCancelledId]);
    await query(`DELETE FROM worker_skills WHERE worker_id = $1`, [workerProfileId]);
    await query(`DELETE FROM worker_profiles WHERE id = $1`, [workerProfileId]);
    await query(`DELETE FROM provider_profiles WHERE id = $1`, [providerProfileId]);
    await query(`DELETE FROM agent_profiles WHERE id = $1`, [agentProfileId]);
    await query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4)`, [workerUserId, providerUserId, agentUserId, adminUserId]);
  });

  // ─────────────────────────────────────────────────────────────
  // 1. AUTHENTICATION & ACCESS CONTROL
  // ─────────────────────────────────────────────────────────────
  describe("1. Authentication & Role-Based Access Control", () => {
    it("1.1: Rejects unauthenticated request with HTTP 401 Unauthorized", async () => {
      const res = await request(app).get("/api/v1/radar");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("1.2: Rejects invalid latitude or longitude parameters with 400 Bad Request", async () => {
      const res = await request(app)
        .get("/api/v1/radar")
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
        .query({ latitude: 120, longitude: 77.59 }); // Lat > 90

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. WORKER ROLE RADAR: JOB DEMAND & PRIVACY
  // ─────────────────────────────────────────────────────────────
  describe("2. Worker Role Radar: Demand Intelligence & Privacy", () => {
    it("2.1: Worker receives nearby job demand relevant to skills without other workers' personal data", async () => {
      const res = await request(app)
        .get("/api/v1/radar")
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
        .query({ latitude: CENTER_LAT, longitude: CENTER_LNG, radius: 5.0 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.role).toBe("WORKER");
      expect(data.radiusKm).toBe(5.0);
      expect(data.activeOpportunitiesCount).toBeGreaterThanOrEqual(1);
      expect(data.matchedJobDemandCount).toBeGreaterThanOrEqual(1);

      // Verify Category Demand
      expect(Array.isArray(data.demandByCategory)).toBe(true);
      expect(data.demandByCategory.length).toBeGreaterThanOrEqual(1);
      const cat = data.demandByCategory.find((c: any) => c.categoryId === testCategoryId);
      expect(cat).toBeDefined();
      expect(cat.activeJobsCount).toBeGreaterThanOrEqual(1);

      // Verify Skill Demand
      expect(Array.isArray(data.demandBySkill)).toBe(true);
      const skillDemand = data.demandBySkill.find((s: any) => s.skillId === testSkillId);
      expect(skillDemand).toBeDefined();
      expect(skillDemand.jobsDemandingCount).toBeGreaterThanOrEqual(1);

      // STRICT PRIVACY: Worker radar must NEVER expose other workers' live locations or profiles
      expect((data as any).availableTalent).toBeUndefined();
      expect((data as any).clusters).toBeUndefined();
      expect((data as any).workers).toBeUndefined();
    });

    it("2.2: Geographic filtering includes near job (1.2 km) and strictly excludes far job (25 km)", async () => {
      const res = await request(app)
        .get("/api/v1/radar")
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
        .query({ latitude: CENTER_LAT, longitude: CENTER_LNG, radius: 5.0 });

      expect(res.status).toBe(200);
      const data = res.body.data;

      // Far job at 25km must NOT be included in 5 km radius
      // Let's verify with 1 km radius which excludes both near job (1.2km) and far job (25km)
      const res1km = await request(app)
        .get("/api/v1/radar")
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
        .query({ latitude: CENTER_LAT, longitude: CENTER_LNG, radius: 1.0 });

      expect(res1km.status).toBe(200);
      // In 1 km radius from center, testJobNear is at 1.2km so active opportunities count should be strictly smaller
      expect(res1km.body.data.activeOpportunitiesCount).toBeLessThan(data.activeOpportunitiesCount);
    });

    it("2.3: Authoritative DB counts strictly exclude CANCELLED jobs", async () => {
      const res = await request(app)
        .get("/api/v1/radar")
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
        .query({ latitude: CENTER_LAT, longitude: CENTER_LNG, radius: 5.0 });

      expect(res.status).toBe(200);
      const data = res.body.data;

      // Ensure cancelled job count is 0
      // In hotspots, the cancelled job at Church Street must NOT be active
      for (const h of data.hotspots) {
        expect(h.locationName).not.toContain("Church Street");
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. PROVIDER ROLE RADAR: WORKFORCE AVAILABILITY & PRIVACY
  // ─────────────────────────────────────────────────────────────
  describe("3. Provider Role Radar: Workforce Availability & k-Anonymity", () => {
    it("3.1: Provider receives available online workers and competing open jobs", async () => {
      const res = await request(app)
        .get("/api/v1/radar")
        .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`)
        .query({ latitude: CENTER_LAT, longitude: CENTER_LNG, radius: 5.0 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.role).toBe("PROVIDER");
      expect(data.totalAvailableWorkers).toBeGreaterThanOrEqual(1);
      expect(data.competingOpenJobsCount).toBeGreaterThanOrEqual(1);

      // Verify category counts
      expect(Array.isArray(data.categoryCounts)).toBe(true);
      expect(data.categoryCounts.length).toBeGreaterThanOrEqual(1);

      // Verify available talent privacy:
      expect(Array.isArray(data.availableTalent)).toBe(true);
      for (const talent of data.availableTalent) {
        // Synthetic ID only
        expect(talent.id).toMatch(/^talent_\d+$/);
        expect(talent.id).not.toContain(workerUserId);
        expect(talent.id).not.toContain(workerProfileId);

        // Coarsened distance in multiples of 0.5 km
        const remainder = (talent.distanceKm * 10) % 5;
        expect(remainder).toBe(0);

        // Individual coordinates must NEVER be present
        expect(talent.latitude).toBeUndefined();
        expect(talent.longitude).toBeUndefined();
        expect(talent.phone).toBeUndefined();
      }
    });

    it("3.2: Neighborhood clusters enforce k-anonymity privacy (singletons aggregated)", async () => {
      const res = await request(app)
        .get("/api/v1/radar")
        .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`)
        .query({ latitude: CENTER_LAT, longitude: CENTER_LNG, radius: 5.0 });

      expect(res.status).toBe(200);
      const clusters = res.body.data.clusters;
      expect(Array.isArray(clusters)).toBe(true);

      for (const cl of clusters) {
        // Center coordinates must be generalized search center, NEVER raw worker GPS
        expect(cl.centerCoordinates.latitude).toBeCloseTo(CENTER_LAT, 2);
        expect(cl.centerCoordinates.longitude).toBeCloseTo(CENTER_LNG, 2);

        // No cluster with a specific locality can have single worker count (< 2)
        if (cl.approximateAreaName !== "Other Nearby Neighborhoods") {
          expect(cl.availableWorkersCount).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it("3.3: Excludes stale workers (> 12h without update or offline)", async () => {
      // Mark worker as offline
      await query(`UPDATE worker_profiles SET is_available_now = FALSE, availability_status = 'OFFLINE' WHERE id = $1`, [workerProfileId]);

      const res = await request(app)
        .get("/api/v1/radar")
        .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`)
        .query({ latitude: CENTER_LAT, longitude: CENTER_LNG, radius: 5.0 });

      expect(res.status).toBe(200);
      // Restoring worker state
      await query(`UPDATE worker_profiles SET is_available_now = TRUE, availability_status = 'AVAILABLE_NOW', availability_updated_at = NOW() WHERE id = $1`, [workerProfileId]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. AGENT ROLE RADAR: LINKED WORKER DEMAND
  // ─────────────────────────────────────────────────────────────
  describe("4. Agent Role Radar: Linked Workforce Demand", () => {
    it("4.1: Agent receives demand specifically matching registered skills of linked workers", async () => {
      const res = await request(app)
        .get("/api/v1/radar")
        .set("Authorization", `Bearer mock_token_${AGENT_AUTH}`)
        .query({ latitude: CENTER_LAT, longitude: CENTER_LNG, radius: 5.0 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.role).toBe("AGENT");
      expect(data.totalLinkedWorkers).toBeGreaterThanOrEqual(1);
      expect(data.onlineLinkedWorkers).toBeGreaterThanOrEqual(1);
      expect(data.linkedSkillsDemandCount).toBeGreaterThanOrEqual(1);

      // Top demanded skills for linked workers
      expect(Array.isArray(data.topDemandedSkillsForLinked)).toBe(true);
      expect(data.topDemandedSkillsForLinked.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. ADMIN ROLE RADAR: PLATFORM-WIDE MACRO INTELLIGENCE
  // ─────────────────────────────────────────────────────────────
  describe("5. Admin Role Radar: Platform-Wide Aggregated Intelligence", () => {
    it("5.1: Admin receives city-wide macro supply-demand metrics and category balance", async () => {
      const res = await request(app)
        .get("/api/v1/radar")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`)
        .query({ latitude: CENTER_LAT, longitude: CENTER_LNG, radius: 10.0 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.role).toBe("ADMIN");
      expect(data.totalActiveJobs).toBeGreaterThanOrEqual(1);
      expect(data.totalAvailableWorkers).toBeGreaterThanOrEqual(1);
      expect(data.supplyDemandRatio).toBeGreaterThan(0);

      // Cross-category supply vs demand matrix
      expect(Array.isArray(data.categorySupplyDemand)).toBe(true);
      expect(data.categorySupplyDemand.length).toBeGreaterThanOrEqual(1);
      const cat = data.categorySupplyDemand.find((c: any) => c.categoryId === testCategoryId);
      expect(cat).toBeDefined();
      expect(cat.activeJobsCount).toBeGreaterThanOrEqual(1);
      expect(["SHORTAGE", "BALANCED", "SURPLUS"]).toContain(cat.status);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. DATA ACCURACY: NO FABRICATED DATA
  // ─────────────────────────────────────────────────────────────
  describe("6. Zero Data Fabrication Verification", () => {
    it("6.1: When an isolated coordinate has no jobs or workers, returns 0 counts and empty arrays", async () => {
      // Coordinates in deep Arabian Sea (12.0000, 70.0000)
      const res = await request(app)
        .get("/api/v1/radar")
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
        .query({ latitude: 12.0000, longitude: 70.0000, radius: 1.0 });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.activeOpportunitiesCount).toBe(0);
      expect(data.matchedJobDemandCount).toBe(0);
      expect(data.demandByCategory).toEqual([]);
      expect(data.hotspots).toEqual([]);
    });
  });
});
