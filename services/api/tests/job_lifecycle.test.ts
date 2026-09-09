import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { UserRole, WorkOpportunityStatus, AssignmentStatus } from "@nearvia/types";
import { apiRouter } from "../src/routes";
import { errorHandler, notFoundHandler } from "../src/middleware";
import { query } from "../src/db";
import { jobLifecycleService } from "../src/modules/lifecycle/jobLifecycle.service";
import { applicationsService } from "../src/modules/applications/service";

describe("NEARVIA Phase 11: Complete Job Lifecycle Test Suite", () => {
  let app: Express;

  // Test Auth Identifiers
  const PROVIDER_OWNER_AUTH = "p11_prov_owner";
  const PROVIDER_UNAUTH_AUTH = "p11_prov_unauth";
  const WORKER_PRIMARY_AUTH = "p11_work_primary";
  const WORKER_SECONDARY_AUTH = "p11_work_secondary";
  const WORKER_UNAUTH_AUTH = "p11_work_unauth";

  let providerOwnerUserId: string;
  let providerOwnerProfileId: string;
  let providerUnauthUserId: string;
  let providerUnauthProfileId: string;

  let workerPrimaryUserId: string;
  let workerPrimaryProfileId: string;
  let workerSecondaryUserId: string;
  let workerSecondaryProfileId: string;
  let workerUnauthUserId: string;
  let workerUnauthProfileId: string;

  let testCategoryId: string;
  let testSkillId: string;

  let primaryJobId: string;
  let primaryApplicationId: string;
  let primaryAssignmentId: string;

  let secondaryJobId: string;
  let secondaryAssignmentId: string;

  const JOB_LAT = 12.9716;
  const JOB_LNG = 77.5946;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/v1", apiRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Cleanup previous p11 test data
    const cleanup = async () => {
      await query(`DELETE FROM platform_events WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`);
      await query(`DELETE FROM payment_records WHERE payer_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%') OR payee_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`);
      await query(`DELETE FROM attendance_records WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p11_%')`);
      await query(`DELETE FROM assignments WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P11_TEST]%')`);
      await query(`DELETE FROM applications WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P11_TEST]%')`);
      await query(`DELETE FROM work_opportunity_skills WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P11_TEST]%')`);
      await query(`DELETE FROM work_opportunities WHERE title LIKE '%[P11_TEST]%' OR provider_id IN (SELECT pp.id FROM provider_profiles pp JOIN users u ON u.id = pp.user_id WHERE u.auth_id LIKE 'p11_%')`);
      await query(`DELETE FROM worker_skills WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p11_%')`);
      await query(`DELETE FROM worker_availability WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p11_%')`);
      await query(`DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`);
      await query(`DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`);
      await query(`DELETE FROM users WHERE auth_id LIKE 'p11_%'`);
    };

    await cleanup();

    // 1. Seed Category & Skill
    const catRes = await query<{ id: string }>(
      `INSERT INTO categories (name, slug, description, is_active)
       VALUES ('Facility Services [P11_TEST]', 'facility-p11', 'Facility & Cleaning Services', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`
    );
    testCategoryId = catRes.rows[0].id;

    const skillRes = await query<{ id: string }>(
      `INSERT INTO skills (category_id, name, description, is_active)
       VALUES ($1, 'Deep Sanitation [P11_TEST]', 'Commercial Sanitation', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      [testCategoryId]
    );
    testSkillId = skillRes.rows[0].id;

    // 2. Seed Provider Owner
    const provOwnerRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919900110001', 'Provider Owner [P11]', 'owner@nearvia.test', 'PROVIDER', TRUE)
       RETURNING id`,
      [PROVIDER_OWNER_AUTH]
    );
    providerOwnerUserId = provOwnerRes.rows[0].id;

    const provOwnerProfRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, description, location, address_approximate)
       VALUES ($1, 'Prime Facilities Corp', 'Owner Provider [P11_TEST]', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Indiranagar, Bengaluru')
       RETURNING id`,
      [providerOwnerUserId, JOB_LNG, JOB_LAT]
    );
    providerOwnerProfileId = provOwnerProfRes.rows[0].id;

    // 3. Seed Provider Unauth (for permission/IDOR checks)
    const provUnauthRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919900110002', 'Provider Unauth [P11]', 'unauth_prov@nearvia.test', 'PROVIDER', TRUE)
       RETURNING id`,
      [PROVIDER_UNAUTH_AUTH]
    );
    providerUnauthUserId = provUnauthRes.rows[0].id;

    const provUnauthProfRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, description, location, address_approximate)
       VALUES ($1, 'Rival Cleaning Inc', 'Unauth Provider [P11_TEST]', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Koramangala, Bengaluru')
       RETURNING id`,
      [providerUnauthUserId, JOB_LNG, JOB_LAT]
    );
    providerUnauthProfileId = provUnauthProfRes.rows[0].id;

    // Helper to create worker
    const createWorker = async (params: {
      authId: string;
      phone: string;
      fullName: string;
    }) => {
      const uRes = await query<{ id: string }>(
        `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
         VALUES ($1, $2, $3, $4, 'WORKER', TRUE)
         RETURNING id`,
        [params.authId, params.phone, params.fullName, `${params.authId}@nearvia.test`]
      );
      const userId = uRes.rows[0].id;

      const wpRes = await query<{ id: string }>(
        `INSERT INTO worker_profiles (
           user_id, location, address_approximate,
           reliability_score, completed_tasks_count, total_ratings_count, average_rating,
           is_available_now, availability_status, verified_badge
         ) VALUES (
           $1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Indiranagar, Bengaluru',
           95.0, 10, 5, 4.8,
           TRUE, 'AVAILABLE_NOW', TRUE
         ) RETURNING id`,
        [userId, JOB_LNG, JOB_LAT]
      );
      const profileId = wpRes.rows[0].id;

      await query(
        `INSERT INTO worker_skills (worker_id, skill_id, years_experience, is_verified)
         VALUES ($1, $2, 3.0, TRUE)
         ON CONFLICT DO NOTHING`,
        [profileId, testSkillId]
      );

      return { userId, profileId };
    };

    // 4. Seed Workers
    const w1 = await createWorker({
      authId: WORKER_PRIMARY_AUTH,
      phone: "+919900220001",
      fullName: "Worker Primary [P11]",
    });
    workerPrimaryUserId = w1.userId;
    workerPrimaryProfileId = w1.profileId;

    const w2 = await createWorker({
      authId: WORKER_SECONDARY_AUTH,
      phone: "+919900220002",
      fullName: "Worker Secondary [P11]",
    });
    workerSecondaryUserId = w2.userId;
    workerSecondaryProfileId = w2.profileId;

    const w3 = await createWorker({
      authId: WORKER_UNAUTH_AUTH,
      phone: "+919900220003",
      fullName: "Worker Unauth [P11]",
    });
    workerUnauthUserId = w3.userId;
    workerUnauthProfileId = w3.profileId;
  });

  afterAll(async () => {
    // Cleanup p11 test data
    await query(`DELETE FROM platform_events WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`);
    await query(`DELETE FROM payment_records WHERE payer_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%') OR payee_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`);
    await query(`DELETE FROM attendance_records WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p11_%')`);
    await query(`DELETE FROM assignments WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P11_TEST]%')`);
    await query(`DELETE FROM applications WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P11_TEST]%')`);
    await query(`DELETE FROM work_opportunity_skills WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P11_TEST]%')`);
    await query(`DELETE FROM work_opportunities WHERE title LIKE '%[P11_TEST]%' OR provider_id IN (SELECT pp.id FROM provider_profiles pp JOIN users u ON u.id = pp.user_id WHERE u.auth_id LIKE 'p11_%')`);
    await query(`DELETE FROM worker_skills WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p11_%')`);
    await query(`DELETE FROM worker_availability WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p11_%')`);
    await query(`DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`);
    await query(`DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`);
    await query(`DELETE FROM users WHERE auth_id LIKE 'p11_%'`);
  });

  // --------------------------------------------------------------------------
  // TEST 1: Publish job (DRAFT -> PUBLISHED)
  // --------------------------------------------------------------------------
  it("Test 1: Provider creates draft opportunity and publishes it (DRAFT -> PUBLISHED)", async () => {
    // Create draft directly
    const draftRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
         provider_id, category_id, title, description, work_type, urgency, status,
         workers_needed, workers_assigned, location, address_approximate,
         work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
         $1, $2, 'Deep Cleaning Shift [P11_TEST]', 'Full sanitization shift [P11_TEST]', 'SHIFT', 'NORMAL', 'DRAFT',
         1, 0, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Indiranagar, Bengaluru',
         CURRENT_DATE + INTERVAL '1 day', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 8 hours', 8, 1200.00, 'FIXED'
       ) RETURNING id`,
      [providerOwnerProfileId, testCategoryId, JOB_LNG, JOB_LAT]
    );
    primaryJobId = draftRes.rows[0].id;

    // Publish via API
    const res = await request(app)
      .post(`/api/v1/work-opportunities/${primaryJobId}/publish`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(WorkOpportunityStatus.PUBLISHED);
    expect(res.body.data.publishedAt).toBeDefined();

    // Verify in DB
    const dbCheck = await query(`SELECT status, published_at FROM work_opportunities WHERE id = $1`, [primaryJobId]);
    expect(dbCheck.rows[0].status).toBe("PUBLISHED");
    expect(dbCheck.rows[0].published_at).not.toBeNull();
  });

  // --------------------------------------------------------------------------
  // TEST 2: Apply (PUBLISHED -> APPLICATIONS)
  // --------------------------------------------------------------------------
  it("Test 2: Worker submits application for published work opportunity (APPLICATIONS)", async () => {
    const res = await request(app)
      .post(`/api/v1/work-opportunities/${primaryJobId}/applications`)
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`)
      .send({
        workerNotes: "Experienced sanitization expert ready to take this shift [P11_TEST]",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("PENDING");
    primaryApplicationId = res.body.data.id;

    // Verify application in DB
    const dbCheck = await query(`SELECT status, worker_id FROM applications WHERE id = $1`, [primaryApplicationId]);
    expect(dbCheck.rows.length).toBe(1);
    expect(dbCheck.rows[0].status).toBe("PENDING");
  });

  // --------------------------------------------------------------------------
  // TEST 3: Select / Shortlist worker
  // --------------------------------------------------------------------------
  it("Test 3: Provider shortlists applicant (PENDING -> SHORTLISTED)", async () => {
    const res = await request(app)
      .post(`/api/v1/applications/${primaryApplicationId}/shortlist`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("SHORTLISTED");

    // Verify in DB
    const dbCheck = await query(`SELECT status FROM applications WHERE id = $1`, [primaryApplicationId]);
    expect(dbCheck.rows[0].status).toBe("SHORTLISTED");
  });

  // --------------------------------------------------------------------------
  // TEST 4: Assignment created (ASSIGNED, FILLED)
  // --------------------------------------------------------------------------
  it("Test 4: Provider accepts worker application -> assignment created (ASSIGNED, FILLED)", async () => {
    const res = await request(app)
      .post(`/api/v1/applications/${primaryApplicationId}/accept`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.application.status).toBe("ACCEPTED");
    primaryAssignmentId = res.body.data.assignmentId;
    expect(primaryAssignmentId).toBeDefined();

    // Verify assignment row created with status ASSIGNED
    const assignCheck = await query<{ id: string; status: string }>(
      `SELECT id, status FROM assignments WHERE work_opportunity_id = $1 AND worker_id = $2`,
      [primaryJobId, workerPrimaryProfileId]
    );
    expect(assignCheck.rows.length).toBe(1);
    expect(assignCheck.rows[0].status).toBe(AssignmentStatus.ASSIGNED);

    // Verify work opportunity status is now FILLED (1 needed, 1 assigned)
    const jobCheck = await query(`SELECT status, workers_assigned FROM work_opportunities WHERE id = $1`, [primaryJobId]);
    expect(jobCheck.rows[0].status).toBe("FILLED");
    expect(jobCheck.rows[0].workers_assigned).toBe(1);
  });

  // --------------------------------------------------------------------------
  // TEST 5: Worker confirmation (ASSIGNED -> CONFIRMED)
  // --------------------------------------------------------------------------
  it("Test 5: Worker confirms attendance for assignment (ASSIGNED -> CONFIRMED)", async () => {
    const res = await request(app)
      .post(`/api/v1/assignments/${primaryAssignmentId}/confirm`)
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(AssignmentStatus.CONFIRMED);
    expect(res.body.data.confirmedAt).toBeDefined();

    // Verify in DB
    const dbCheck = await query(`SELECT status, confirmed_at FROM assignments WHERE id = $1`, [primaryAssignmentId]);
    expect(dbCheck.rows[0].status).toBe("CONFIRMED");
    expect(dbCheck.rows[0].confirmed_at).not.toBeNull();
  });

  // --------------------------------------------------------------------------
  // TEST 6: Valid transition sequence (CONFIRMED -> CHECKED_IN -> IN_PROGRESS -> COMPLETED)
  // --------------------------------------------------------------------------
  it("Test 6: Valid transition sequence executes properly (CHECKED_IN -> IN_PROGRESS -> COMPLETED)", async () => {
    // 1. Worker Check-In
    const checkInRes = await request(app)
      .post(`/api/v1/assignments/${primaryAssignmentId}/check-in`)
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`)
      .send({ manualFallback: true, notes: "Arrived at building lobby [P11_TEST]" });

    expect(checkInRes.status).toBe(200);
    expect(checkInRes.body.data.status).toBe(AssignmentStatus.CHECKED_IN);

    // 2. Worker Start Work
    const startRes = await request(app)
      .post(`/api/v1/assignments/${primaryAssignmentId}/start`)
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`);

    expect(startRes.status).toBe(200);
    expect(startRes.body.data.status).toBe(AssignmentStatus.IN_PROGRESS);

    // Opportunity also updates to IN_PROGRESS
    const jobRes = await query(`SELECT status FROM work_opportunities WHERE id = $1`, [primaryJobId]);
    expect(jobRes.rows[0].status).toBe("IN_PROGRESS");

    // 3. Worker Complete Work
    const completeRes = await request(app)
      .post(`/api/v1/assignments/${primaryAssignmentId}/complete`)
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`)
      .send({ completionNotes: "Completed deep cleaning on all designated floors [P11_TEST]" });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.status).toBe(AssignmentStatus.COMPLETED);
    expect(completeRes.body.data.completedAt).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // TEST 7: Invalid transition rejected (400)
  // --------------------------------------------------------------------------
  it("Test 7: Out-of-order or invalid transitions are strictly rejected (400)", async () => {
    // Attempting to check-in or start an already COMPLETED assignment
    const invalidCheckIn = await request(app)
      .post(`/api/v1/assignments/${primaryAssignmentId}/check-in`)
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`)
      .send({ manualFallback: true });

    expect(invalidCheckIn.status).toBe(400);

    const invalidStart = await request(app)
      .post(`/api/v1/assignments/${primaryAssignmentId}/start`)
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`);

    expect(invalidStart.status).toBe(400);
  });

  // --------------------------------------------------------------------------
  // TEST 8: Unauthorized provider rejected (403)
  // --------------------------------------------------------------------------
  it("Test 8: Unauthorized provider is rejected from taking action on another provider's job (403)", async () => {
    const res = await request(app)
      .post(`/api/v1/assignments/${primaryAssignmentId}/confirm-completion`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_UNAUTH_AUTH}`)
      .send({ finalWagePaid: 1200 });

    expect(res.status).toBe(403);
  });

  // --------------------------------------------------------------------------
  // TEST 9: Unauthorized worker rejected (403)
  // --------------------------------------------------------------------------
  it("Test 9: Unauthorized worker is rejected from performing actions on another worker's assignment (403)", async () => {
    const res = await request(app)
      .post(`/api/v1/assignments/${primaryAssignmentId}/complete`)
      .set("Authorization", `Bearer mock_token_${WORKER_UNAUTH_AUTH}`)
      .send({ completionNotes: "Hijacking attempt" });

    expect(res.status).toBe(403);
  });

  // --------------------------------------------------------------------------
  // TEST 10: Duplicate active assignment prevented (409)
  // --------------------------------------------------------------------------
  it("Test 10: Attempting to create duplicate active assignment for worker on same job is rejected by DB unique constraint", async () => {
    // Create dedicated job for duplicate constraint verification
    const tempJobRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
         provider_id, category_id, title, description, work_type, urgency, status,
         workers_needed, workers_assigned, location, address_approximate,
         work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
         $1, $2, 'Duplicate Test Job [P11_TEST]', 'Test duplicate [P11_TEST]', 'SHIFT', 'NORMAL', 'FILLED',
         1, 1, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Indiranagar, Bengaluru',
         CURRENT_DATE + INTERVAL '1 day', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 8 hours', 8, 1200.00, 'FIXED'
       ) RETURNING id`,
      [providerOwnerProfileId, testCategoryId, JOB_LNG, JOB_LAT]
    );
    const tempJobId = tempJobRes.rows[0].id;

    // Insert 1st active assignment for worker
    await query(
      `INSERT INTO assignments (work_opportunity_id, worker_id, provider_id, agreed_wage, status, assigned_at)
       VALUES ($1, $2, $3, 1200.00, 'ASSIGNED', NOW())`,
      [tempJobId, workerPrimaryProfileId, providerOwnerProfileId]
    );

    // Attempting to insert a 2nd active assignment (ASSIGNED/CONFIRMED) violates idx_assignments_unique_active_worker
    await expect(
      query(
        `INSERT INTO assignments (work_opportunity_id, worker_id, provider_id, agreed_wage, status, assigned_at)
         VALUES ($1, $2, $3, 1200.00, 'CONFIRMED', NOW())`,
        [tempJobId, workerPrimaryProfileId, providerOwnerProfileId]
      )
    ).rejects.toThrow();

    // Clean up temp job
    await query(`DELETE FROM assignments WHERE work_opportunity_id = $1`, [tempJobId]);
    await query(`DELETE FROM work_opportunities WHERE id = $1`, [tempJobId]);
  });

  // --------------------------------------------------------------------------
  // TEST 11: Concurrent assignment safety / capacity limit enforcement
  // --------------------------------------------------------------------------
  it("Test 11: Capacity limit is strictly enforced when opportunity is already full (409)", async () => {
    // primaryJobId has workers_needed = 1 and workers_assigned = 1 (full)
    // Worker Secondary applies for primaryJobId
    const appSecRes = await query<{ id: string }>(
      `INSERT INTO applications (work_opportunity_id, worker_id, status)
       VALUES ($1, $2, 'PENDING')
       RETURNING id`,
      [primaryJobId, workerSecondaryProfileId]
    );
    const appSecId = appSecRes.rows[0].id;

    // Provider attempts to accept -> rejected with 409 (capacity full)
    const fullRes = await request(app)
      .post(`/api/v1/applications/${appSecId}/accept`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`);

    expect(fullRes.status).toBe(409);
  });

  // --------------------------------------------------------------------------
  // TEST 12: Worker completion submission verified
  // --------------------------------------------------------------------------
  it("Test 12: Worker completion record contains notes and timestamp in database", async () => {
    const dbCheck = await query(
      `SELECT status, completed_at, completion_notes FROM assignments WHERE id = $1`,
      [primaryAssignmentId]
    );

    expect(dbCheck.rows[0].status).toBe("COMPLETED");
    expect(dbCheck.rows[0].completed_at).not.toBeNull();
    expect(dbCheck.rows[0].completion_notes).toContain("Completed deep cleaning");
  });

  // --------------------------------------------------------------------------
  // TEST 13 & 14: Provider completion confirmation & Settlement Pending reached
  // --------------------------------------------------------------------------
  it("Test 13 & 14: Provider confirms completed work -> reaches SETTLEMENT_PENDING and creates payment record", async () => {
    const res = await request(app)
      .post(`/api/v1/assignments/${primaryAssignmentId}/confirm-completion`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`)
      .send({ finalWagePaid: 1200 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify opportunity transitioned to SETTLEMENT_PENDING
    const jobCheck = await query(
      `SELECT status, completed_at FROM work_opportunities WHERE id = $1`,
      [primaryJobId]
    );
    expect(jobCheck.rows[0].status).toBe("SETTLEMENT_PENDING");
    expect(jobCheck.rows[0].completed_at).not.toBeNull();

    // Verify pending payment_records row initialized
    const payCheck = await query(
      `SELECT status, amount, payer_id, payee_id FROM payment_records WHERE assignment_id = $1`,
      [primaryAssignmentId]
    );
    expect(payCheck.rows.length).toBe(1);
    expect(payCheck.rows[0].status).toBe("PENDING");
    expect(Number(payCheck.rows[0].amount)).toBe(1200);
    expect(payCheck.rows[0].payer_id).toBe(providerOwnerUserId);
    expect(payCheck.rows[0].payee_id).toBe(workerPrimaryUserId);
  });

  // --------------------------------------------------------------------------
  // TEST 15: Cancellation compatibility (workers_assigned decremented, reverts to PUBLISHED)
  // --------------------------------------------------------------------------
  it("Test 15: Cancelling assignment decrements workers_assigned and reverts opportunity to PUBLISHED", async () => {
    // Create second job and assignment for Worker Secondary
    const jobRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
         provider_id, category_id, title, description, work_type, urgency, status,
         workers_needed, workers_assigned, location, address_approximate,
         work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
         $1, $2, 'Maintenance Shift 2 [P11_TEST]', 'Sanitation shift [P11_TEST]', 'SHIFT', 'NORMAL', 'FILLED',
         1, 1, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Indiranagar, Bengaluru',
         CURRENT_DATE + INTERVAL '2 days', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 8 hours', 8, 1100.00, 'FIXED'
       ) RETURNING id`,
      [providerOwnerProfileId, testCategoryId, JOB_LNG, JOB_LAT]
    );
    secondaryJobId = jobRes.rows[0].id;

    const assignRes = await query<{ id: string }>(
      `INSERT INTO assignments (
         work_opportunity_id, worker_id, provider_id, agreed_wage, status, assigned_at
       ) VALUES ($1, $2, $3, 1100.00, 'ASSIGNED', NOW())
       RETURNING id`,
      [secondaryJobId, workerSecondaryProfileId, providerOwnerProfileId]
    );
    secondaryAssignmentId = assignRes.rows[0].id;

    // Worker cancels assignment
    const cancelRes = await request(app)
      .post(`/api/v1/assignments/${secondaryAssignmentId}/cancel`)
      .set("Authorization", `Bearer mock_token_${WORKER_SECONDARY_AUTH}`)
      .send({ reason: "Emergency conflict [P11_TEST]" });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe(AssignmentStatus.CANCELLED);

    // Verify opportunity reverted to PUBLISHED and workers_assigned decremented to 0
    const jobCheck = await query(
      `SELECT status, workers_assigned FROM work_opportunities WHERE id = $1`,
      [secondaryJobId]
    );
    expect(jobCheck.rows[0].status).toBe("PUBLISHED");
    expect(jobCheck.rows[0].workers_assigned).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TEST 16: Repeated requests safe (graceful error / idempotence)
  // --------------------------------------------------------------------------
  it("Test 16: Repeated cancellation or invalid state changes do not corrupt state", async () => {
    // Repeating cancel on already CANCELLED assignment
    const repeatedCancel = await request(app)
      .post(`/api/v1/assignments/${secondaryAssignmentId}/cancel`)
      .set("Authorization", `Bearer mock_token_${WORKER_SECONDARY_AUTH}`)
      .send({ reason: "Duplicate cancel attempt" });

    expect(repeatedCancel.status).toBe(400);

    // Verify DB remains CANCELLED
    const dbCheck = await query(`SELECT status FROM assignments WHERE id = $1`, [secondaryAssignmentId]);
    expect(dbCheck.rows[0].status).toBe("CANCELLED");
  });

  // --------------------------------------------------------------------------
  // TEST 17: Authoritative state reflects in API response (Milestones & Next Actions)
  // --------------------------------------------------------------------------
  it("Test 17: Authoritative lifecycle endpoint returns synchronized 7 milestones and next actions", async () => {
    const res = await request(app)
      .get(`/api/v1/jobs/${primaryJobId}/lifecycle`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const lifecycle = res.body.data;
    expect(lifecycle.jobId).toBe(primaryJobId);
    expect(lifecycle.jobStatus).toBe("SETTLEMENT_PENDING");
    expect(lifecycle.currentStage).toBeDefined();
    expect(lifecycle.timeline).toBeInstanceOf(Array);
    expect(lifecycle.timeline.length).toBe(7);

    // Milestones check
    const stages = lifecycle.timeline.map((s: any) => s.stage);
    expect(stages).toEqual([
      "PUBLISHED",
      "ASSIGNED",
      "CONFIRMED",
      "CHECKED_IN",
      "IN_PROGRESS",
      "COMPLETED",
      "SETTLEMENT_PENDING",
    ]);

    // Role-tailored next actions
    expect(lifecycle.nextActions).toBeInstanceOf(Array);
    const actionIds = lifecycle.nextActions.map((a: any) => a.action);
    expect(actionIds).toContain("SETTLE_PAYMENT");
  });

  // --------------------------------------------------------------------------
  // TEST 18: Audit records created in platform_events
  // --------------------------------------------------------------------------
  it("Test 18: Platform events audit trail correctly recorded key lifecycle milestones", async () => {
    const eventsRes = await query<{ event_type: string }>(
      `SELECT event_type FROM platform_events 
       WHERE resource_id = $1::uuid OR resource_id = $2::uuid OR (metadata->>'workOpportunityId') = $1::text
       ORDER BY created_at ASC`,
      [primaryJobId, primaryAssignmentId]
    );

    const recordedTypes = eventsRes.rows.map((r) => r.event_type);

    // Verify key platform audit events were emitted
    expect(recordedTypes).toContain("ASSIGNMENT_CONFIRMED");
    expect(recordedTypes).toContain("WORKER_CHECKED_IN");
    expect(recordedTypes).toContain("WORK_STARTED");
    expect(recordedTypes).toContain("WORK_COMPLETED");
    expect(recordedTypes).toContain("PROVIDER_CONFIRMED_COMPLETION");
    expect(recordedTypes).toContain("SETTLEMENT_PENDING");
  });
});
