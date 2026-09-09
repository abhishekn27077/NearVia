import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { UserRole } from "@nearvia/types";
import { apiRouter } from "../src/routes";
import { errorHandler, notFoundHandler } from "../src/middleware";
import { query } from "../src/db";
import { smartMatchingService } from "../src/modules/matching/smartMatching.service";

describe("NEARVIA Phase 10: Preferred Workers Test Suite", () => {
  let app: Express;

  // Test User Auth Identifiers
  const PROVIDER_A_AUTH = "p10_test_provider_a";
  const PROVIDER_B_AUTH = "p10_test_provider_b";
  const WORKER_CALLER_AUTH = "p10_test_worker_caller";

  let providerAUserId: string;
  let providerBUserId: string;
  let workerCallerUserId: string;

  let providerAProfileId: string;
  let providerBProfileId: string;

  let testJobId: string;
  let electricalCategoryId: string;
  let carpentryCategoryId: string;
  let skillWiringId: string;
  let skillWoodworkId: string;

  // Candidates IDs
  let eligibleWorkerId: string;
  let eligibleWorkerUserId: string;

  let inactiveWorkerId: string;
  let offlineWorkerId: string;
  let wrongSkillWorkerId: string;

  // Bengaluru Base Coordinates: 12.9716, 77.5946 (MG Road)
  const JOB_LAT = 12.9716;
  const JOB_LNG = 77.5946;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/v1", apiRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);

    const cleanup = async () => {
      await query(`DELETE FROM preferred_workers WHERE notes LIKE '%[P10_TEST]%' OR worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p10_%') OR provider_id IN (SELECT pp.id FROM provider_profiles pp JOIN users u ON u.id = pp.user_id WHERE u.auth_id LIKE 'p10_%')`);
      await query(`DELETE FROM work_opportunity_skills WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P10_TEST]%')`);
      await query(`DELETE FROM work_opportunities WHERE title LIKE '%[P10_TEST]%' OR provider_id IN (SELECT pp.id FROM provider_profiles pp JOIN users u ON u.id = pp.user_id WHERE u.auth_id LIKE 'p10_%')`);
      await query(`DELETE FROM worker_skills WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p10_%')`);
      await query(`DELETE FROM worker_availability WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p10_%')`);
      await query(`DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p10_%') OR bio LIKE '%[P10_TEST]%'`);
      await query(`DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p10_%') OR description LIKE '%[P10_TEST]%'`);
      await query(`DELETE FROM users WHERE auth_id LIKE 'p10_%'`);
    };

    await cleanup();

    // 1. Categories
    const catElectRes = await query<{ id: string }>(
      `INSERT INTO categories (name, slug, description, is_active)
       VALUES ('Electrical Works [P10_TEST]', 'electrical-p10', 'Electrical Services', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`
    );
    electricalCategoryId = catElectRes.rows[0].id;

    const catCarpRes = await query<{ id: string }>(
      `INSERT INTO categories (name, slug, description, is_active)
       VALUES ('Carpentry [P10_TEST]', 'carpentry-p10', 'Carpentry Services', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`
    );
    carpentryCategoryId = catCarpRes.rows[0].id;

    // 2. Skills
    const skillWiringRes = await query<{ id: string }>(
      `INSERT INTO skills (category_id, name, description, is_active)
       VALUES ($1, 'Domestic Wiring [P10_TEST]', 'Residential wiring', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      [electricalCategoryId]
    );
    skillWiringId = skillWiringRes.rows[0].id;

    const skillWoodRes = await query<{ id: string }>(
      `INSERT INTO skills (category_id, name, description, is_active)
       VALUES ($1, 'Cabinet Making [P10_TEST]', 'Cabinetry', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      [carpentryCategoryId]
    );
    skillWoodworkId = skillWoodRes.rows[0].id;

    // 3. Provider A (Owner)
    const provARes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919988770001', 'Provider Alice [P10]', 'alice@nearvia.test', 'PROVIDER', TRUE)
       RETURNING id`,
      [PROVIDER_A_AUTH]
    );
    providerAUserId = provARes.rows[0].id;

    const provAProfRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, description, location, address_approximate)
       VALUES ($1, 'Alice Electric Works', 'Provider Profile [P10_TEST]', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'MG Road, Bengaluru')
       RETURNING id`,
      [providerAUserId, JOB_LNG, JOB_LAT]
    );
    providerAProfileId = provAProfRes.rows[0].id;

    // 4. Provider B (Independent Provider)
    const provBRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919988770002', 'Provider Bob [P10]', 'bob@nearvia.test', 'PROVIDER', TRUE)
       RETURNING id`,
      [PROVIDER_B_AUTH]
    );
    providerBUserId = provBRes.rows[0].id;

    const provBProfRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, description, location, address_approximate)
       VALUES ($1, 'Bob Repairs', 'Provider Profile [P10_TEST]', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Indiranagar, Bengaluru')
       RETURNING id`,
      [providerBUserId, JOB_LNG, JOB_LAT]
    );
    providerBProfileId = provBProfRes.rows[0].id;

    // 5. Worker Caller
    const workerCallerRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919988770003', 'Worker Caller [P10]', 'worker_caller@nearvia.test', 'WORKER', TRUE)
       RETURNING id`,
      [WORKER_CALLER_AUTH]
    );
    workerCallerUserId = workerCallerRes.rows[0].id;

    // 6. Candidates Setup
    // Helper to insert worker
    const createWorker = async (params: {
      authId: string;
      phone: string;
      fullName: string;
      lat: number | null;
      lng: number | null;
      isActive?: boolean;
      isAvailableNow?: boolean;
      availabilityUpdatedAt?: string;
      skills?: string[];
      rating?: number;
      tasksCompleted?: number;
    }): Promise<{ profileId: string; userId: string }> => {
      const uRes = await query<{ id: string }>(
        `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
         VALUES ($1, $2, $3, $4, 'WORKER', $5)
         RETURNING id`,
        [params.authId, params.phone, params.fullName, `${params.authId}@nearvia.test`, params.isActive ?? true]
      );
      const uId = uRes.rows[0].id;

      const locSql =
        params.lat !== null && params.lng !== null
          ? `ST_SetSRID(ST_MakePoint(${params.lng}, ${params.lat}), 4326)::geography`
          : "NULL";

      const pRes = await query<{ id: string }>(
        `INSERT INTO worker_profiles (
          user_id, bio, experience_years, service_radius_km, location, address_approximate,
          availability_status, is_available_now, availability_updated_at,
          average_rating, total_ratings_count, completed_tasks_count,
          reliability_score, verified_badge
         ) VALUES (
          $1, 'Worker bio [P10_TEST]', 4.0, 5.0, ${locSql}, 'Bengaluru Test Zone',
          $2, $3, $4,
          $5, 10, $6,
          95.0, TRUE
         ) RETURNING id`,
        [
          uId,
          params.isAvailableNow ?? true ? "AVAILABLE_NOW" : "OFFLINE",
          params.isAvailableNow ?? true,
          params.availabilityUpdatedAt ?? new Date().toISOString(),
          params.rating ?? 4.8,
          params.tasksCompleted ?? 25,
        ]
      );
      const pId = pRes.rows[0].id;

      if (params.skills) {
        for (const sId of params.skills) {
          await query(
            `INSERT INTO worker_skills (worker_id, skill_id, years_experience, is_verified)
             VALUES ($1, $2, 3.0, TRUE)
             ON CONFLICT DO NOTHING`,
            [pId, sId]
          );
        }
      }

      return { profileId: pId, userId: uId };
    };

    // Worker 1: Eligible Worker (Nearby ~800m, Electrical skill, Online now)
    const w1 = await createWorker({
      authId: "p10_worker_eligible",
      phone: "+919988771001",
      fullName: "Ravi Electrician [P10]",
      lat: 12.9750,
      lng: 77.6000,
      isActive: true,
      isAvailableNow: true,
      availabilityUpdatedAt: new Date().toISOString(),
      skills: [skillWiringId],
      rating: 4.8,
      tasksCompleted: 25,
    });
    eligibleWorkerId = w1.profileId;
    eligibleWorkerUserId = w1.userId;

    // Worker 2: Inactive Worker (User account disabled / is_active = false)
    const w2 = await createWorker({
      authId: "p10_worker_inactive",
      phone: "+919988771002",
      fullName: "Inactive Worker [P10]",
      lat: 12.9730,
      lng: 77.5960,
      isActive: false, // is_active = false
      isAvailableNow: true,
      availabilityUpdatedAt: new Date().toISOString(),
      skills: [skillWiringId],
      rating: 4.9,
      tasksCompleted: 40,
    });
    inactiveWorkerId = w2.profileId;

    // Worker 3: Offline / Stale Worker (Offline, last active 180 mins ago)
    const staleDate = new Date(Date.now() - 180 * 60 * 1000).toISOString();
    const w3 = await createWorker({
      authId: "p10_worker_offline",
      phone: "+919988771003",
      fullName: "Offline Worker [P10]",
      lat: 12.9720,
      lng: 77.5950,
      isActive: true,
      isAvailableNow: false, // is_available_now = false
      availabilityUpdatedAt: staleDate, // stale
      skills: [skillWiringId],
      rating: 4.9,
      tasksCompleted: 50,
    });
    offlineWorkerId = w3.profileId;

    // Worker 4: Wrong Skill Worker (Carpentry only, missing electrical)
    const w4 = await createWorker({
      authId: "p10_worker_wrong_skill",
      phone: "+919988771004",
      fullName: "Carpenter Worker [P10]",
      lat: 12.9740,
      lng: 77.5970,
      isActive: true,
      isAvailableNow: true,
      availabilityUpdatedAt: new Date().toISOString(),
      skills: [skillWoodworkId],
      rating: 4.9,
      tasksCompleted: 30,
    });
    wrongSkillWorkerId = w4.profileId;

    // 7. Test Work Opportunity requiring Electrical Wiring
    const jobRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
         provider_id, category_id, title, description, work_type, urgency, status,
         workers_needed, workers_assigned, location, address_approximate,
         work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
         $1, $2, 'Urgent Rewiring Job [P10_TEST]', 'Need certified electrician [P10_TEST]', 'TASK', 'NORMAL', 'PUBLISHED',
         1, 0, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Brigade Road, Bengaluru',
         CURRENT_DATE, NOW() + INTERVAL '2 hours', NOW() + INTERVAL '6 hours', 4.0, 800.0, 'FIXED'
       ) RETURNING id`,
      [providerAProfileId, electricalCategoryId, JOB_LNG, JOB_LAT]
    );
    testJobId = jobRes.rows[0].id;

    await query(
      `INSERT INTO work_opportunity_skills (work_opportunity_id, skill_id, is_required)
       VALUES ($1, $2, TRUE)`,
      [testJobId, skillWiringId]
    );
  });

  afterAll(async () => {
    await query(`DELETE FROM preferred_workers WHERE notes LIKE '%[P10_TEST]%' OR worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p10_%') OR provider_id IN (SELECT pp.id FROM provider_profiles pp JOIN users u ON u.id = pp.user_id WHERE u.auth_id LIKE 'p10_%')`);
    await query(`DELETE FROM work_opportunity_skills WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P10_TEST]%')`);
    await query(`DELETE FROM work_opportunities WHERE title LIKE '%[P10_TEST]%' OR provider_id IN (SELECT pp.id FROM provider_profiles pp JOIN users u ON u.id = pp.user_id WHERE u.auth_id LIKE 'p10_%')`);
    await query(`DELETE FROM worker_skills WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p10_%')`);
    await query(`DELETE FROM worker_availability WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p10_%')`);
    await query(`DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p10_%') OR bio LIKE '%[P10_TEST]%'`);
    await query(`DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p10_%') OR description LIKE '%[P10_TEST]%'`);
    await query(`DELETE FROM users WHERE auth_id LIKE 'p10_%'`);
  });

  // --------------------------------------------------------------------------
  // TEST 1: Provider adds worker as Preferred
  // --------------------------------------------------------------------------
  it("Test 1: Provider adds a worker as Preferred via API (returns 200/201 and persists in DB)", async () => {
    const res = await request(app)
      .post(`/api/v1/providers/me/preferred-workers/${eligibleWorkerId}`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
      .send({ notes: "Outstanding electrician [P10_TEST]" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify in DB
    const dbCheck = await query(
      `SELECT * FROM preferred_workers WHERE provider_id = $1 AND worker_id = $2`,
      [providerAProfileId, eligibleWorkerId]
    );
    expect(dbCheck.rows.length).toBe(1);
    expect(dbCheck.rows[0].notes).toContain("Outstanding electrician");
  });

  // --------------------------------------------------------------------------
  // TEST 2: Duplicate add is handled idempotently
  // --------------------------------------------------------------------------
  it("Test 2: Duplicate add is safely handled (idempotent, updates notes without creating duplicate rows)", async () => {
    const res = await request(app)
      .post(`/api/v1/providers/me/preferred-workers/${eligibleWorkerId}`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
      .send({ notes: "Updated note for preferred electrician [P10_TEST]" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const dbCheck = await query(
      `SELECT * FROM preferred_workers WHERE provider_id = $1 AND worker_id = $2`,
      [providerAProfileId, eligibleWorkerId]
    );
    expect(dbCheck.rows.length).toBe(1);
    expect(dbCheck.rows[0].notes).toContain("Updated note");
  });

  // --------------------------------------------------------------------------
  // TEST 3: Provider removes worker from Preferred
  // --------------------------------------------------------------------------
  it("Test 3: Provider removes worker from Preferred via API", async () => {
    const res = await request(app)
      .delete(`/api/v1/providers/me/preferred-workers/${eligibleWorkerId}`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const dbCheck = await query(
      `SELECT * FROM preferred_workers WHERE provider_id = $1 AND worker_id = $2`,
      [providerAProfileId, eligibleWorkerId]
    );
    expect(dbCheck.rows.length).toBe(0);

    // Re-add eligible worker for subsequent matching tests
    await request(app)
      .post(`/api/v1/providers/me/preferred-workers/${eligibleWorkerId}`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
      .send({ notes: "Top preferred electrician [P10_TEST]" });
  });

  // --------------------------------------------------------------------------
  // TEST 4: Provider views their preferred workers list
  // --------------------------------------------------------------------------
  it("Test 4: Provider views preferred workers list with profile, rating, and skills", async () => {
    const res = await request(app)
      .get("/api/v1/providers/me/preferred-workers")
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const item = res.body.data.find((p: any) => p.workerId === eligibleWorkerId);
    expect(item).toBeDefined();
    expect(item.workerName).toBe("Ravi Electrician [P10]");
    expect(item.workerRating).toBe(4.8);
    expect(item.completedTasksCount).toBe(25);
    expect(item.skills).toContain("Domestic Wiring [P10_TEST]");
    expect(item.notes).toContain("Top preferred electrician");
  });

  // --------------------------------------------------------------------------
  // TEST 5: Private isolation: Provider B cannot see Provider A's preferred workers
  // --------------------------------------------------------------------------
  it("Test 5: Privacy isolation — Provider B cannot see Provider A's preferred workers", async () => {
    const res = await request(app)
      .get("/api/v1/providers/me/preferred-workers")
      .set("Authorization", `Bearer mock_token_${PROVIDER_B_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Provider B has no preferred workers
    const found = res.body.data.find((p: any) => p.workerId === eligibleWorkerId);
    expect(found).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // TEST 6: Worker role cannot manipulate preferred relationships
  // --------------------------------------------------------------------------
  it("Test 6: Worker role is forbidden from adding or removing preferred workers (403)", async () => {
    const addRes = await request(app)
      .post(`/api/v1/providers/me/preferred-workers/${eligibleWorkerId}`)
      .set("Authorization", `Bearer mock_token_${WORKER_CALLER_AUTH}`)
      .send({ notes: "Worker trying to prefer someone" });

    expect(addRes.status).toBe(403);

    const deleteRes = await request(app)
      .delete(`/api/v1/providers/me/preferred-workers/${eligibleWorkerId}`)
      .set("Authorization", `Bearer mock_token_${WORKER_CALLER_AUTH}`);

    expect(deleteRes.status).toBe(403);
  });

  // --------------------------------------------------------------------------
  // TEST 7: Inactive worker marked preferred remains in table but is excluded from Smart Matching
  // --------------------------------------------------------------------------
  it("Test 7: Inactive worker marked preferred is strictly excluded from Smart Matching", async () => {
    // Add inactive worker to Provider A's preferred list
    await request(app)
      .post(`/api/v1/providers/me/preferred-workers/${inactiveWorkerId}`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
      .send({ notes: "Inactive worker preferred [P10_TEST]" });

    // Verify it is in preferred list
    const listRes = await request(app)
      .get("/api/v1/providers/me/preferred-workers")
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`);
    expect(listRes.body.data.some((p: any) => p.workerId === inactiveWorkerId)).toBe(true);

    // Call Smart Matching for Job
    const matchRes = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`);

    expect(matchRes.status).toBe(200);
    const matches = matchRes.body.data.matches;
    // Inactive worker MUST NOT be present
    expect(matches.some((m: any) => m.workerId === inactiveWorkerId)).toBe(false);
  });

  // --------------------------------------------------------------------------
  // TEST 8: Offline / Stale worker marked preferred is NOT promoted into matches
  // --------------------------------------------------------------------------
  it("Test 8: Offline/stale worker marked preferred is strictly excluded from Smart Matching", async () => {
    // Add offline worker to Provider A's preferred list
    await request(app)
      .post(`/api/v1/providers/me/preferred-workers/${offlineWorkerId}`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
      .send({ notes: "Offline worker preferred [P10_TEST]" });

    // Call Smart Matching for Job
    const matchRes = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`);

    expect(matchRes.status).toBe(200);
    const matches = matchRes.body.data.matches;
    // Offline / stale worker MUST NOT be present
    expect(matches.some((m: any) => m.workerId === offlineWorkerId)).toBe(false);
  });

  // --------------------------------------------------------------------------
  // TEST 9: Incompatible skill worker marked preferred is NOT promoted into matches
  // --------------------------------------------------------------------------
  // TEST 9: Incompatible skill worker marked preferred is not incorrectly promoted
  // --------------------------------------------------------------------------
  it("Test 9: Incompatible skill worker marked preferred is not incorrectly promoted over eligible workers", async () => {
    // Add carpentry worker to Provider A's preferred list
    await request(app)
      .post(`/api/v1/providers/me/preferred-workers/${wrongSkillWorkerId}`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
      .send({ notes: "Carpenter preferred [P10_TEST]" });

    // Call Smart Matching for electrical Job
    const matchRes = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`);

    expect(matchRes.status).toBe(200);
    const matches = matchRes.body.data.matches;
    const eligibleCand = matches.find((m: any) => m.workerId === eligibleWorkerId);
    const wrongSkillCand = matches.find((m: any) => m.workerId === wrongSkillWorkerId);

    expect(eligibleCand).toBeDefined();
    if (wrongSkillCand) {
      expect(wrongSkillCand.matchedSkills.length).toBe(0);
      expect(eligibleCand.matchScore).toBeGreaterThan(wrongSkillCand.matchScore);
      expect(eligibleCand.rank).toBeLessThan(wrongSkillCand.rank);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 10: Preferred eligible worker receives expected ranking boost and badge
  // --------------------------------------------------------------------------
  it("Test 10: Preferred eligible worker receives priority boost (+5%), badge, and highlight", async () => {
    // Call Smart Matching where eligibleWorkerId IS in Provider A's preferred list
    const matchRes = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`);

    expect(matchRes.status).toBe(200);
    const matches = matchRes.body.data.matches;

    const cand = matches.find((m: any) => m.workerId === eligibleWorkerId);
    expect(cand).toBeDefined();
    expect(cand.isPreferredWorker).toBe(true);
    expect(cand.matchHighlights).toContain("❤️ Preferred Worker");
    expect(cand.rank).toBe(1);

    // Now remove preferred status and observe score reduction
    await request(app)
      .delete(`/api/v1/providers/me/preferred-workers/${eligibleWorkerId}`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`);

    const matchRes2 = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`);

    const cand2 = matchRes2.body.data.matches.find((m: any) => m.workerId === eligibleWorkerId);
    expect(cand2).toBeDefined();
    expect(cand2.isPreferredWorker).toBe(false);
    expect(cand2.matchHighlights).not.toContain("❤️ Preferred Worker");
    // Boost difference is 5 points
    expect(cand.matchScore - cand2.matchScore).toBe(5);
  });

  // --------------------------------------------------------------------------
  // TEST 11: Database uniqueness constraint prevents duplicates
  // --------------------------------------------------------------------------
  it("Test 11: Direct SQL insert violates unique constraint on duplicate (provider_id, worker_id)", async () => {
    // Insert once
    await query(
      `INSERT INTO preferred_workers (provider_id, worker_id, notes)
       VALUES ($1, $2, 'First direct insert [P10_TEST]')
       ON CONFLICT (provider_id, worker_id) DO NOTHING`,
      [providerAProfileId, eligibleWorkerId]
    );

    // Second direct INSERT without conflict handling should throw unique violation
    let threw = false;
    try {
      await query(
        `INSERT INTO preferred_workers (provider_id, worker_id, notes)
         VALUES ($1, $2, 'Duplicate direct insert [P10_TEST]')`,
        [providerAProfileId, eligibleWorkerId]
      );
    } catch (err: any) {
      threw = true;
      expect(err.code).toBe("23505"); // PostgreSQL unique_violation code
    }
    expect(threw).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST 12: API Validation & Authentication Error Handling
  // --------------------------------------------------------------------------
  it("Test 12: API validation prevents self-preference, invalid UUID, and unauthenticated requests", async () => {
    // 1. Unauthenticated request
    const noAuthRes = await request(app)
      .get("/api/v1/providers/me/preferred-workers");
    expect(noAuthRes.status).toBe(401);

    // 2. Invalid UUID
    const badUuidRes = await request(app)
      .post("/api/v1/providers/me/preferred-workers/invalid-not-a-uuid")
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
      .send({});
    expect(badUuidRes.status).toBe(400);
    expect(badUuidRes.body.error?.message).toContain("Invalid worker ID");

    // 3. Provider trying to add themselves as preferred worker
    // First create a worker profile for Provider A
    const selfWorkerRes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, bio, experience_years)
       VALUES ($1, 'Self worker bio [P10_TEST]', 1)
       RETURNING id`,
      [providerAUserId]
    );
    const selfWorkerId = selfWorkerRes.rows[0].id;

    const selfAddRes = await request(app)
      .post(`/api/v1/providers/me/preferred-workers/${selfWorkerId}`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
      .send({});
    expect(selfAddRes.status).toBe(400);
    expect(selfAddRes.body.error?.message).toContain("Cannot add yourself");
  });

  // --------------------------------------------------------------------------
  // TEST 13: Privacy & No Sensitive Data Leakage
  // --------------------------------------------------------------------------
  it("Test 13: Response payloads do not leak exact GPS coordinates or unmasked contact data", async () => {
    // Add eligible worker back to preferred
    await request(app)
      .post(`/api/v1/providers/me/preferred-workers/${eligibleWorkerId}`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
      .send({ notes: "Privacy test notes [P10_TEST]" });

    const res = await request(app)
      .get("/api/v1/providers/me/preferred-workers")
      .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`);

    expect(res.status).toBe(200);
    const item = res.body.data.find((p: any) => p.workerId === eligibleWorkerId);
    expect(item).toBeDefined();

    // Sensitive field leak checks
    expect(item.workerPhoneMasked).toMatch(/^\+91 \*{5} \d{4}$/); // masked
    expect(item).not.toHaveProperty("phone");
    expect(item).not.toHaveProperty("location");
    expect(item).not.toHaveProperty("latitude");
    expect(item).not.toHaveProperty("longitude");
    expect(item).not.toHaveProperty("aadhaar_number");
    expect(item).not.toHaveProperty("pan_number");
    expect(item).not.toHaveProperty("bank_account");
  });
});
