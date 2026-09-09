import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { UserRole } from "@nearvia/types";
import { apiRouter } from "../src/routes";
import { errorHandler, notFoundHandler } from "../src/middleware";
import { query } from "../src/db";
import { smartMatchingService } from "../src/modules/matching/smartMatching.service";

describe("NEARVIA Phase 9: Smart Matching System Test Suite", () => {
  let app: Express;

  // Test User Auth Identifiers
  const OWNER_PROVIDER_AUTH = "p9_test_provider_owner";
  const OTHER_PROVIDER_AUTH = "p9_test_provider_other";
  const WORKER_CALLER_AUTH = "p9_test_worker_caller";
  const ADMIN_AUTH = "p9_test_admin_user";

  let ownerProviderUserId: string;
  let otherProviderUserId: string;
  let workerCallerUserId: string;
  let adminUserId: string;

  let ownerProviderProfileId: string;
  let otherProviderProfileId: string;

  let testJobId: string;
  let cleaningCategoryId: string;
  let retailCategoryId: string;
  let skillFloorCleaningId: string;
  let skillSanitizationId: string;
  let skillCashierId: string;

  // Candidates IDs
  let perfectWorkerId: string;
  let partialWorkerId: string;
  let otherCategoryWorkerId: string;
  let outsideRadiusWorkerId: string;
  let offlineWorkerId: string;
  let staleWorkerId: string;
  let inactiveWorkerId: string;
  let missingLocationWorkerId: string;
  let verifiedWorkerId: string;
  let unverifiedWorkerId: string;
  let highReliabilityWorkerId: string;
  let lowReliabilityWorkerId: string;
  let newWorkerId: string;
  let preferredWorkerId: string;
  let multiSkillWorkerId: string;

  // Bengaluru Base Coordinates: 12.9716, 77.5946 (MG Road)
  const JOB_LAT = 12.9716;
  const JOB_LNG = 77.5946;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/v1", apiRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Clean up any stale data from previous test runs
    await query(`DELETE FROM preferred_workers WHERE notes LIKE '%[P9_TEST]%'`);
    await query(`DELETE FROM work_opportunity_skills WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P9_TEST]%')`);
    await query(`DELETE FROM work_opportunities WHERE title LIKE '%[P9_TEST]%'`);
    await query(`DELETE FROM worker_skills WHERE worker_id IN (SELECT id FROM worker_profiles WHERE bio LIKE '%[P9_TEST]%')`);
    await query(`DELETE FROM worker_availability WHERE worker_id IN (SELECT id FROM worker_profiles WHERE bio LIKE '%[P9_TEST]%')`);
    await query(`DELETE FROM worker_profiles WHERE bio LIKE '%[P9_TEST]%'`);
    await query(`DELETE FROM provider_profiles WHERE description LIKE '%[P9_TEST]%'`);
    await query(`DELETE FROM users WHERE auth_id LIKE 'p9_test_%'`);

    // 1. Create or Find Categories
    const catCleaningRes = await query<{ id: string }>(
      `INSERT INTO categories (name, slug, description, is_active)
       VALUES ('Cleaning & Sanitization [P9_TEST]', 'cleaning-sanitization-p9', 'Cleaning Services', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`
    );
    cleaningCategoryId = catCleaningRes.rows[0].id;

    const catRetailRes = await query<{ id: string }>(
      `INSERT INTO categories (name, slug, description, is_active)
       VALUES ('Retail & Shop Assistance [P9_TEST]', 'retail-assistance-p9', 'Retail Services', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`
    );
    retailCategoryId = catRetailRes.rows[0].id;

    // 2. Create or Find Skills
    const skill1Res = await query<{ id: string }>(
      `INSERT INTO skills (category_id, name, description, is_active)
       VALUES ($1, 'Deep Floor Cleaning [P9_TEST]', 'Commercial Floor Cleaning', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      [cleaningCategoryId]
    );
    skillFloorCleaningId = skill1Res.rows[0].id;

    const skill2Res = await query<{ id: string }>(
      `INSERT INTO skills (category_id, name, description, is_active)
       VALUES ($1, 'Surface Sanitization [P9_TEST]', 'Sanitizing Surfaces', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      [cleaningCategoryId]
    );
    skillSanitizationId = skill2Res.rows[0].id;

    const skill3Res = await query<{ id: string }>(
      `INSERT INTO skills (category_id, name, description, is_active)
       VALUES ($1, 'Cash Register Operations [P9_TEST]', 'Cashier operations', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      [retailCategoryId]
    );
    skillCashierId = skill3Res.rows[0].id;

    // 3. Create Users
    // Owner Provider
    const provOwnerRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919999900001', 'P9 Job Owner Provider', 'p9_owner@nearvia.test', 'PROVIDER', TRUE)
       RETURNING id`,
      [OWNER_PROVIDER_AUTH]
    );
    ownerProviderUserId = provOwnerRes.rows[0].id;

    const provOwnerProfileRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, description, location, address_approximate)
       VALUES ($1, 'P9 Clean Corp', 'Provider Profile [P9_TEST]', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'MG Road, Bengaluru')
       RETURNING id`,
      [ownerProviderUserId, JOB_LNG, JOB_LAT]
    );
    ownerProviderProfileId = provOwnerProfileRes.rows[0].id;

    // Other Provider (Unauthorized)
    const provOtherRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919999900002', 'P9 Other Provider', 'p9_other@nearvia.test', 'PROVIDER', TRUE)
       RETURNING id`,
      [OTHER_PROVIDER_AUTH]
    );
    otherProviderUserId = provOtherRes.rows[0].id;

    const provOtherProfileRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, description, location, address_approximate)
       VALUES ($1, 'P9 Competitor Corp', 'Provider Profile [P9_TEST]', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Indiranagar, Bengaluru')
       RETURNING id`,
      [otherProviderUserId, JOB_LNG, JOB_LAT]
    );
    otherProviderProfileId = provOtherProfileRes.rows[0].id;

    // Worker Caller (Unauthorized role)
    const workerCallerRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919999900003', 'P9 Worker Caller', 'p9_workercaller@nearvia.test', 'WORKER', TRUE)
       RETURNING id`,
      [WORKER_CALLER_AUTH]
    );
    workerCallerUserId = workerCallerRes.rows[0].id;

    // Platform Admin
    const adminRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919999900004', 'P9 Platform Admin', 'p9_admin@nearvia.test', 'ADMIN', TRUE)
       RETURNING id`,
      [ADMIN_AUTH]
    );
    adminUserId = adminRes.rows[0].id;

    // 4. Create Test Job (Needs Floor Cleaning and Surface Sanitization, 5 km radius)
    const jobRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
        provider_id, category_id, title, description, work_type, urgency, status,
        workers_needed, workers_assigned, location, address_approximate,
        work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
        $1, $2, 'Deep Clean Office [P9_TEST]', 'Commercial sanitization task', 'TASK', 'NORMAL', 'PUBLISHED',
        2, 0, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'MG Road Center, Bengaluru',
        CURRENT_DATE, NOW() + INTERVAL '2 hours', NOW() + INTERVAL '6 hours', 4.0, 800.0, 'FIXED'
       ) RETURNING id`,
      [ownerProviderProfileId, cleaningCategoryId, JOB_LNG, JOB_LAT]
    );
    testJobId = jobRes.rows[0].id;

    // Attach required skills to test job:
    // 1. Deep Floor Cleaning (Required, min 2 yrs)
    // 2. Surface Sanitization (Required, min 1 yr)
    await query(
      `INSERT INTO work_opportunity_skills (work_opportunity_id, skill_id, is_required, min_experience_years)
       VALUES ($1, $2, TRUE, 2.0), ($1, $3, TRUE, 1.0)`,
      [testJobId, skillFloorCleaningId, skillSanitizationId]
    );

    // Helper to insert a test candidate worker
    const createWorker = async (params: {
      authId: string;
      fullName: string;
      phone: string;
      lat: number | null;
      lng: number | null;
      isActive?: boolean;
      availabilityStatus?: string;
      isAvailableNow?: boolean;
      availabilityUpdatedAt?: string;
      serviceRadiusKm?: number;
      experienceYears?: number;
      completedTasksCount?: number;
      reliabilityScore?: number;
      averageRating?: number;
      totalRatingsCount?: number;
      verifiedBadge?: boolean;
      skills?: Array<{ skillId: string; years: number }>;
    }): Promise<string> => {
      const uRes = await query<{ id: string }>(
        `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
         VALUES ($1, $2, $3, $4, 'WORKER', $5)
         RETURNING id`,
        [
          params.authId,
          params.phone,
          params.fullName,
          `${params.authId}@nearvia.test`,
          params.isActive ?? true,
        ]
      );
      const uid = uRes.rows[0].id;

      const locSql =
        params.lat !== null && params.lng !== null
          ? `ST_SetSRID(ST_MakePoint(${params.lng}, ${params.lat}), 4326)::geography`
          : "NULL";

      const wpRes = await query<{ id: string }>(
        `INSERT INTO worker_profiles (
          user_id, bio, experience_years, service_radius_km, location, address_approximate,
          availability_status, is_available_now, availability_updated_at,
          average_rating, total_ratings_count, completed_tasks_count,
          reliability_score, verified_badge
         ) VALUES (
          $1, 'Worker bio [P9_TEST]', $2, $3, ${locSql}, 'Bengaluru Test Zone',
          $4, $5, $6,
          $7, $8, $9,
          $10, $11
         ) RETURNING id`,
        [
          uid,
          params.experienceYears ?? 3.0,
          params.serviceRadiusKm ?? 5.0,
          params.availabilityStatus ?? "AVAILABLE_NOW",
          params.isAvailableNow ?? true,
          params.availabilityUpdatedAt ?? new Date().toISOString(),
          params.averageRating ?? 5.0,
          params.totalRatingsCount ?? 10,
          params.completedTasksCount ?? 15,
          params.reliabilityScore ?? 98.0,
          params.verifiedBadge ?? true,
        ]
      );
      const wid = wpRes.rows[0].id;

      if (params.skills && params.skills.length > 0) {
        for (const s of params.skills) {
          await query(
            `INSERT INTO worker_skills (worker_id, skill_id, years_experience, is_verified)
             VALUES ($1, $2, $3, TRUE)`,
            [wid, s.skillId, s.years]
          );
        }
      }

      return wid;
    };

    // Close by coordinates (~0.5 km away: 12.974, 77.596)
    const CLOSE_LAT = 12.974;
    const CLOSE_LNG = 77.596;

    // 1. Perfect Match Worker: Both required skills, close by, available, high reliability, verified
    perfectWorkerId = await createWorker({
      authId: "p9_test_perfect_worker",
      fullName: "P9 Perfect Match Worker",
      phone: "+919999910001",
      lat: CLOSE_LAT,
      lng: CLOSE_LNG,
      verifiedBadge: true,
      reliabilityScore: 98.0,
      averageRating: 4.9,
      totalRatingsCount: 20,
      completedTasksCount: 25,
      skills: [
        { skillId: skillFloorCleaningId, years: 3.0 },
        { skillId: skillSanitizationId, years: 2.0 },
      ],
    });

    // 2. Partial Match Worker: Only 1 of 2 required skills
    partialWorkerId = await createWorker({
      authId: "p9_test_partial_worker",
      fullName: "P9 Partial Match Worker",
      phone: "+919999910002",
      lat: CLOSE_LAT,
      lng: CLOSE_LNG,
      verifiedBadge: true,
      reliabilityScore: 98.0,
      averageRating: 4.9,
      totalRatingsCount: 20,
      completedTasksCount: 25,
      skills: [
        { skillId: skillFloorCleaningId, years: 3.0 },
      ],
    });

    // 3. Other Category Worker: Only Cashier skill (Retail category)
    otherCategoryWorkerId = await createWorker({
      authId: "p9_test_other_cat_worker",
      fullName: "P9 Other Category Worker",
      phone: "+919999910003",
      lat: CLOSE_LAT,
      lng: CLOSE_LNG,
      skills: [
        { skillId: skillCashierId, years: 4.0 },
      ],
    });

    // 4. Outside Radius Worker (Lat 13.040, Lng 77.594 => ~7.6 km away, beyond 5 km radius)
    outsideRadiusWorkerId = await createWorker({
      authId: "p9_test_outside_worker",
      fullName: "P9 Outside Radius Worker",
      phone: "+919999910004",
      lat: 13.040,
      lng: 77.5946,
      skills: [
        { skillId: skillFloorCleaningId, years: 3.0 },
        { skillId: skillSanitizationId, years: 2.0 },
      ],
    });

    // 5. Offline Worker (availability_status = 'OFFLINE')
    offlineWorkerId = await createWorker({
      authId: "p9_test_offline_worker",
      fullName: "P9 Offline Worker",
      phone: "+919999910005",
      lat: CLOSE_LAT,
      lng: CLOSE_LNG,
      availabilityStatus: "OFFLINE",
      isAvailableNow: false,
      skills: [
        { skillId: skillFloorCleaningId, years: 3.0 },
        { skillId: skillSanitizationId, years: 2.0 },
      ],
    });

    // 6. Stale Availability Worker (is_available_now = TRUE but updated 20 hours ago)
    const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
    staleWorkerId = await createWorker({
      authId: "p9_test_stale_worker",
      fullName: "P9 Stale Worker",
      phone: "+919999910006",
      lat: CLOSE_LAT,
      lng: CLOSE_LNG,
      isAvailableNow: true,
      availabilityUpdatedAt: twentyHoursAgo,
      skills: [
        { skillId: skillFloorCleaningId, years: 3.0 },
        { skillId: skillSanitizationId, years: 2.0 },
      ],
    });

    // 7. Inactive Worker (is_active = false)
    inactiveWorkerId = await createWorker({
      authId: "p9_test_inactive_worker",
      fullName: "P9 Inactive Worker",
      phone: "+919999910007",
      lat: CLOSE_LAT,
      lng: CLOSE_LNG,
      isActive: false,
      skills: [
        { skillId: skillFloorCleaningId, years: 3.0 },
        { skillId: skillSanitizationId, years: 2.0 },
      ],
    });

    // 8. Missing Location Worker (lat/lng is null)
    missingLocationWorkerId = await createWorker({
      authId: "p9_test_no_loc_worker",
      fullName: "P9 No Location Worker",
      phone: "+919999910008",
      lat: null,
      lng: null,
      skills: [
        { skillId: skillFloorCleaningId, years: 3.0 },
        { skillId: skillSanitizationId, years: 2.0 },
      ],
    });

    // 9. Verified vs Unverified Workers pair (Same skills, location, ratings)
    verifiedWorkerId = await createWorker({
      authId: "p9_test_verified_pair",
      fullName: "P9 Verified Pair Worker",
      phone: "+919999910009",
      lat: CLOSE_LAT,
      lng: CLOSE_LNG,
      verifiedBadge: true,
      skills: [{ skillId: skillFloorCleaningId, years: 2.0 }],
    });

    unverifiedWorkerId = await createWorker({
      authId: "p9_test_unverified_pair",
      fullName: "P9 Unverified Pair Worker",
      phone: "+919999910010",
      lat: CLOSE_LAT,
      lng: CLOSE_LNG,
      verifiedBadge: false,
      skills: [{ skillId: skillFloorCleaningId, years: 2.0 }],
    });

    // 10. High vs Low Reliability pair
    highReliabilityWorkerId = await createWorker({
      authId: "p9_test_high_rel_worker",
      fullName: "P9 High Reliability Worker",
      phone: "+919999910011",
      lat: CLOSE_LAT,
      lng: CLOSE_LNG,
      completedTasksCount: 20,
      reliabilityScore: 99.0,
      skills: [{ skillId: skillFloorCleaningId, years: 2.0 }],
    });

    lowReliabilityWorkerId = await createWorker({
      authId: "p9_test_low_rel_worker",
      fullName: "P9 Low Reliability Worker",
      phone: "+919999910012",
      lat: CLOSE_LAT,
      lng: CLOSE_LNG,
      completedTasksCount: 20,
      reliabilityScore: 60.0,
      skills: [{ skillId: skillFloorCleaningId, years: 2.0 }],
    });

    // 11. New Worker (0 completed tasks, 0 ratings)
    newWorkerId = await createWorker({
      authId: "p9_test_new_entrant_worker",
      fullName: "P9 New Entrant Worker",
      phone: "+919999910013",
      lat: CLOSE_LAT,
      lng: CLOSE_LNG,
      completedTasksCount: 0,
      totalRatingsCount: 0,
      averageRating: 5.0, // Default in DB should NOT be exposed as genuine 5.0
      reliabilityScore: 100.0, // Default in DB should NOT be exposed as genuine 100
      skills: [{ skillId: skillFloorCleaningId, years: 2.0 }],
    });

    // 12. Preferred Worker (Added to owner provider's preferred list)
    preferredWorkerId = await createWorker({
      authId: "p9_test_preferred_worker",
      fullName: "P9 Preferred Worker",
      phone: "+919999910014",
      lat: CLOSE_LAT,
      lng: CLOSE_LNG,
      skills: [{ skillId: skillFloorCleaningId, years: 2.0 }],
    });
    await query(
      `INSERT INTO preferred_workers (provider_id, worker_id, notes)
       VALUES ($1, $2, 'Top choice [P9_TEST]')`,
      [ownerProviderProfileId, preferredWorkerId]
    );

    // 13. Multi-skill Worker (Multiple skills attached to ensure no duplicate rows)
    multiSkillWorkerId = await createWorker({
      authId: "p9_test_multiskill_worker",
      fullName: "P9 MultiSkill Worker",
      phone: "+919999910015",
      lat: CLOSE_LAT,
      lng: CLOSE_LNG,
      skills: [
        { skillId: skillFloorCleaningId, years: 2.0 },
        { skillId: skillSanitizationId, years: 2.0 },
        { skillId: skillCashierId, years: 1.0 },
      ],
    });
  });

  afterAll(async () => {
    // Clean up all test data
    await query(`DELETE FROM preferred_workers WHERE notes LIKE '%[P9_TEST]%'`);
    await query(`DELETE FROM work_opportunity_skills WHERE work_opportunity_id = $1`, [testJobId]);
    await query(`DELETE FROM work_opportunities WHERE id = $1`, [testJobId]);
    await query(`DELETE FROM worker_skills WHERE worker_id IN (SELECT id FROM worker_profiles WHERE bio LIKE '%[P9_TEST]%')`);
    await query(`DELETE FROM worker_availability WHERE worker_id IN (SELECT id FROM worker_profiles WHERE bio LIKE '%[P9_TEST]%')`);
    await query(`DELETE FROM worker_profiles WHERE bio LIKE '%[P9_TEST]%'`);
    await query(`DELETE FROM provider_profiles WHERE description LIKE '%[P9_TEST]%'`);
    await query(`DELETE FROM users WHERE auth_id LIKE 'p9_test_%'`);
    await query(`DELETE FROM skills WHERE name LIKE '%[P9_TEST]%'`);
    await query(`DELETE FROM categories WHERE name LIKE '%[P9_TEST]%'`);
  });

  // --------------------------------------------------------------------------
  // Tests 1 - 3: Skill & Category Matching
  // --------------------------------------------------------------------------

  it("1. Perfect skill match ranks highly (90%+ score)", async () => {
    const res = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const matches = res.body.data.matches;
    const match = matches.find((m: any) => m.workerId === perfectWorkerId);
    expect(match).toBeDefined();
    expect(match.matchScore).toBeGreaterThanOrEqual(90);
    expect(match.matchedSkills).toContain("Deep Floor Cleaning [P9_TEST]");
    expect(match.matchedSkills).toContain("Surface Sanitization [P9_TEST]");
    expect(match.whyMatched).toContain("Strong skill match");
  });

  it("2. Partial skill match scores lower than perfect match", async () => {
    const res = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);

    const matches = res.body.data.matches;
    const perfect = matches.find((m: any) => m.workerId === perfectWorkerId);
    const partial = matches.find((m: any) => m.workerId === partialWorkerId);

    expect(perfect).toBeDefined();
    expect(partial).toBeDefined();
    expect(perfect.matchScore).toBeGreaterThan(partial.matchScore);
    expect(partial.matchedSkills.length).toBe(1);
    expect(partial.whyMatched).toContain("Partial skill match");
  });

  it("3. Category mismatch scores lower than category match", async () => {
    const res = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);

    const matches = res.body.data.matches;
    const partial = matches.find((m: any) => m.workerId === partialWorkerId);
    const otherCat = matches.find((m: any) => m.workerId === otherCategoryWorkerId);

    expect(partial).toBeDefined();
    expect(otherCat).toBeDefined();
    expect(partial.matchScore).toBeGreaterThan(otherCat.matchScore);
  });

  // --------------------------------------------------------------------------
  // Tests 4 - 8: Hard Eligibility Exclusions
  // --------------------------------------------------------------------------

  it("4. Worker outside radius is strictly excluded", async () => {
    const res = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);

    const matches = res.body.data.matches;
    const outside = matches.find((m: any) => m.workerId === outsideRadiusWorkerId);
    expect(outside).toBeUndefined();
  });

  it("5. Offline worker is excluded", async () => {
    const res = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);

    const matches = res.body.data.matches;
    const offline = matches.find((m: any) => m.workerId === offlineWorkerId);
    expect(offline).toBeUndefined();
  });

  it("6. Stale availability worker (>12h without scheduled slot) is excluded", async () => {
    const res = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);

    const matches = res.body.data.matches;
    const stale = matches.find((m: any) => m.workerId === staleWorkerId);
    expect(stale).toBeUndefined();
  });

  it("7. Inactive worker (is_active = FALSE) is excluded", async () => {
    const res = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);

    const matches = res.body.data.matches;
    const inactive = matches.find((m: any) => m.workerId === inactiveWorkerId);
    expect(inactive).toBeUndefined();
  });

  it("8. Missing location worker is excluded", async () => {
    const res = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);

    const matches = res.body.data.matches;
    const noLoc = matches.find((m: any) => m.workerId === missingLocationWorkerId);
    expect(noLoc).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Tests 9 - 12: Advanced Scoring, History, Fairness & Affinity
  // --------------------------------------------------------------------------

  it("9. Verified worker scores higher than unverified with identical other factors", async () => {
    const res = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);

    const matches = res.body.data.matches;
    const verified = matches.find((m: any) => m.workerId === verifiedWorkerId);
    const unverified = matches.find((m: any) => m.workerId === unverifiedWorkerId);

    expect(verified).toBeDefined();
    expect(unverified).toBeDefined();
    expect(verified.isVerified).toBe(true);
    expect(unverified.isVerified).toBe(false);
    expect(verified.matchScore).toBeGreaterThan(unverified.matchScore);
  });

  it("10. Reliability history: veteran with 99% scores higher than 60% reliability", async () => {
    const res = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);

    const matches = res.body.data.matches;
    const high = matches.find((m: any) => m.workerId === highReliabilityWorkerId);
    const low = matches.find((m: any) => m.workerId === lowReliabilityWorkerId);

    expect(high).toBeDefined();
    expect(low).toBeDefined();
    expect(high.matchScore).toBeGreaterThan(low.matchScore);
  });

  it("11. New worker with no history is handled fairly (neutral baseline, no fake ratings/reviews)", async () => {
    const res = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);

    const matches = res.body.data.matches;
    const newbie = matches.find((m: any) => m.workerId === newWorkerId);

    expect(newbie).toBeDefined();
    expect(newbie.isNewWorker).toBe(true);
    // Crucial: Must NOT expose fake 5.0 rating or fake task counts
    expect(newbie.averageRating).toBeUndefined();
    expect(newbie.tasksCompletedCount).toBeUndefined();
    expect(newbie.matchHighlights).toContain("New Worker • Building Track Record");
  });

  it("12. Preferred worker relationship boosts score and applies preferred badge", async () => {
    const res = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);

    const matches = res.body.data.matches;
    const preferred = matches.find((m: any) => m.workerId === preferredWorkerId);

    expect(preferred).toBeDefined();
    expect(preferred.isPreferredWorker).toBe(true);
    expect(preferred.matchHighlights).toContain("❤️ Preferred Worker");
    expect(preferred.whyMatched).toContain("preferred worker");
  });

  // --------------------------------------------------------------------------
  // Tests 13 - 14: Data Integrity & Determinism
  // --------------------------------------------------------------------------

  it("13. Worker with multiple skills is never duplicated in candidate results", async () => {
    const res = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);

    const matches = res.body.data.matches;
    const multiOccurrences = matches.filter((m: any) => m.workerId === multiSkillWorkerId);
    expect(multiOccurrences.length).toBe(1);
  });

  it("14. Scores and ranking order are 100% deterministic", async () => {
    const res1 = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);

    const res2 = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);

    expect(res1.body.data.matches.length).toBe(res2.body.data.matches.length);
    for (let i = 0; i < res1.body.data.matches.length; i++) {
      expect(res1.body.data.matches[i].workerId).toBe(res2.body.data.matches[i].workerId);
      expect(res1.body.data.matches[i].matchScore).toBe(res2.body.data.matches[i].matchScore);
      expect(res1.body.data.matches[i].rank).toBe(res2.body.data.matches[i].rank);
    }
  });

  // --------------------------------------------------------------------------
  // Tests 15 - 17: Security, Ownership & Privacy Leakage Prevention
  // --------------------------------------------------------------------------

  it("15. Provider authorization succeeds for job owner and platform Admin", async () => {
    // Owner Provider
    const ownerRes = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);
    expect(ownerRes.status).toBe(200);

    // Platform Admin
    const adminRes = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);
    expect(adminRes.status).toBe(200);
  });

  it("16. Worker or unauthorized provider cannot access job matches (403)", async () => {
    // Other Provider (Not Job Owner)
    const otherProvRes = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OTHER_PROVIDER_AUTH}`);
    expect(otherProvRes.status).toBe(403);

    // Worker role
    const workerRes = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${WORKER_CALLER_AUTH}`);
    expect(workerRes.status).toBe(403);
  });

  it("17. Privacy: Results contain NO exact coordinates, NO phone, and NO KYC data", async () => {
    const res = await request(app)
      .get(`/api/v1/jobs/${testJobId}/matches`)
      .set("Authorization", `Bearer mock_token_${OWNER_PROVIDER_AUTH}`);

    expect(res.status).toBe(200);
    const matches = res.body.data.matches;
    expect(matches.length).toBeGreaterThan(0);

    for (const m of matches) {
      // Must NOT contain exact coordinates
      expect((m as any).latitude).toBeUndefined();
      expect((m as any).longitude).toBeUndefined();
      expect((m as any).location).toBeUndefined();

      // Must NOT contain contact info
      expect((m as any).phone).toBeUndefined();
      expect((m as any).contactPhone).toBeUndefined();
      expect((m as any).email).toBeUndefined();
      expect((m as any).address).toBeUndefined();

      // Must NOT contain KYC documents
      expect((m as any).documentRef).toBeUndefined();
      expect((m as any).document_ref).toBeUndefined();
      expect((m as any).idNumber).toBeUndefined();

      // Must provide safe public data
      expect(typeof m.workerId).toBe("string");
      expect(typeof m.fullName).toBe("string");
      expect(typeof m.matchScore).toBe("number");
      expect(typeof m.rank).toBe("number");
      expect(Array.isArray(m.matchedSkills)).toBe(true);
      expect(typeof m.approximateDistanceKm).toBe("number");
      expect(typeof m.distanceBucket).toBe("string");
      expect(typeof m.whyMatched).toBe("string");
    }
  });
});
