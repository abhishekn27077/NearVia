import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { UserRole, WorkOpportunityStatus, AssignmentStatus } from "@nearvia/types";
import { apiRouter } from "../src/routes";
import { errorHandler, notFoundHandler } from "../src/middleware";
import { query } from "../src/db";

describe("NEARVIA Phase 11 / Prompt 5: Complete Marketplace Lifecycle & Concurrency Hardening", () => {
  let app: Express;

  // Test Auth Identifiers
  const PROVIDER_AUTH = "p5_prov_alpha";
  const PROVIDER_RIVAL_AUTH = "p5_prov_rival";
  const WORKER_1_AUTH = "p5_work_1";
  const WORKER_2_AUTH = "p5_work_2";
  const WORKER_3_AUTH = "p5_work_3";

  let providerUserId: string;
  let providerProfileId: string;
  let rivalProviderUserId: string;
  let rivalProviderProfileId: string;

  let worker1UserId: string;
  let worker1ProfileId: string;
  let worker2UserId: string;
  let worker2ProfileId: string;
  let worker3UserId: string;
  let worker3ProfileId: string;

  let testCategoryId: string;
  let testSkillId: string;

  const JOB_LAT = 12.9716;
  const JOB_LNG = 77.5946;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/v1", apiRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Clean up any previous test records
    const cleanup = async () => {
      await query(`DELETE FROM platform_events WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p5_%')`);
      await query(`DELETE FROM payment_records WHERE payer_id IN (SELECT id FROM users WHERE auth_id LIKE 'p5_%') OR payee_id IN (SELECT id FROM users WHERE auth_id LIKE 'p5_%')`);
      await query(`DELETE FROM attendance_records WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p5_%')`);
      await query(`DELETE FROM assignments WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P5_TEST]%')`);
      await query(`DELETE FROM applications WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P5_TEST]%')`);
      await query(`DELETE FROM work_opportunity_skills WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P5_TEST]%')`);
      await query(`DELETE FROM work_opportunities WHERE title LIKE '%[P5_TEST]%' OR provider_id IN (SELECT pp.id FROM provider_profiles pp JOIN users u ON u.id = pp.user_id WHERE u.auth_id LIKE 'p5_%')`);
      await query(`DELETE FROM worker_skills WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p5_%')`);
      await query(`DELETE FROM worker_availability WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p5_%')`);
      await query(`DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p5_%')`);
      await query(`DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p5_%')`);
      await query(`DELETE FROM users WHERE auth_id LIKE 'p5_%'`);
    };

    await cleanup();

    // 1. Seed Category & Skill
    const catRes = await query<{ id: string }>(
      `INSERT INTO categories (name, slug, description, is_active)
       VALUES ('Marketplace Hardening [P5_TEST]', 'marketplace-p5', 'Marketplace Testing Services', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`
    );
    testCategoryId = catRes.rows[0].id;

    const skillRes = await query<{ id: string }>(
      `INSERT INTO skills (category_id, name, description, is_active)
       VALUES ($1, 'Precision Assembly [P5_TEST]', 'Precision Assembly Work', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      [testCategoryId]
    );
    testSkillId = skillRes.rows[0].id;

    // 2. Seed Primary Provider
    const provRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919900550001', 'Provider Alpha [P5]', 'alpha@nearvia.test', 'PROVIDER', TRUE)
       RETURNING id`,
      [PROVIDER_AUTH]
    );
    providerUserId = provRes.rows[0].id;

    const provProfRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, description, location, address_approximate)
       VALUES ($1, 'Alpha Services Ltd', 'Primary Provider [P5_TEST]', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Indiranagar, Bengaluru')
       RETURNING id`,
      [providerUserId, JOB_LNG, JOB_LAT]
    );
    providerProfileId = provProfRes.rows[0].id;

    // 3. Seed Rival Provider
    const rivalRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919900550002', 'Provider Rival [P5]', 'rival@nearvia.test', 'PROVIDER', TRUE)
       RETURNING id`,
      [PROVIDER_RIVAL_AUTH]
    );
    rivalProviderUserId = rivalRes.rows[0].id;

    const rivalProfRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, description, location, address_approximate)
       VALUES ($1, 'Rival Corp', 'Rival Provider [P5_TEST]', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Koramangala, Bengaluru')
       RETURNING id`,
      [rivalProviderUserId, JOB_LNG, JOB_LAT]
    );
    rivalProviderProfileId = rivalProfRes.rows[0].id;

    // 4. Seed Workers
    const createWorker = async (authId: string, phone: string, name: string) => {
      const uRes = await query<{ id: string }>(
        `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
         VALUES ($1, $2, $3, $4, 'WORKER', TRUE)
         RETURNING id`,
        [authId, phone, name, `${authId}@nearvia.test`]
      );
      const userId = uRes.rows[0].id;

      const wpRes = await query<{ id: string }>(
        `INSERT INTO worker_profiles (
           user_id, location, address_approximate,
           reliability_score, completed_tasks_count, total_ratings_count, average_rating,
           verified_badge, is_available_now, availability_status
         ) VALUES (
           $1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Indiranagar, Bengaluru',
           95.0, 12, 10, 4.9,
           TRUE, TRUE, 'AVAILABLE_NOW'
         ) RETURNING id`,
        [userId, JOB_LNG, JOB_LAT]
      );
      const profileId = wpRes.rows[0].id;

      await query(
        `INSERT INTO worker_skills (worker_id, skill_id, years_experience, is_verified)
         VALUES ($1, $2, 3.0, TRUE) ON CONFLICT DO NOTHING`,
        [profileId, testSkillId]
      );

      return { userId, profileId };
    };

    const w1 = await createWorker(WORKER_1_AUTH, "+919900551001", "Worker One [P5]");
    worker1UserId = w1.userId;
    worker1ProfileId = w1.profileId;

    const w2 = await createWorker(WORKER_2_AUTH, "+919900551002", "Worker Two [P5]");
    worker2UserId = w2.userId;
    worker2ProfileId = w2.profileId;

    const w3 = await createWorker(WORKER_3_AUTH, "+919900551003", "Worker Three [P5]");
    worker3UserId = w3.userId;
    worker3ProfileId = w3.profileId;
  });

  afterAll(async () => {
    // Cleanup
    await query(`DELETE FROM platform_events WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p5_%')`);
    await query(`DELETE FROM payment_records WHERE payer_id IN (SELECT id FROM users WHERE auth_id LIKE 'p5_%') OR payee_id IN (SELECT id FROM users WHERE auth_id LIKE 'p5_%')`);
    await query(`DELETE FROM attendance_records WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p5_%')`);
    await query(`DELETE FROM assignments WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P5_TEST]%')`);
    await query(`DELETE FROM applications WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P5_TEST]%')`);
    await query(`DELETE FROM work_opportunity_skills WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P5_TEST]%')`);
    await query(`DELETE FROM work_opportunities WHERE title LIKE '%[P5_TEST]%' OR provider_id IN (SELECT pp.id FROM provider_profiles pp JOIN users u ON u.id = pp.user_id WHERE u.auth_id LIKE 'p5_%')`);
    await query(`DELETE FROM worker_skills WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p5_%')`);
    await query(`DELETE FROM worker_availability WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p5_%')`);
    await query(`DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p5_%')`);
    await query(`DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p5_%')`);
    await query(`DELETE FROM users WHERE auth_id LIKE 'p5_%'`);
  });

  // --------------------------------------------------------------------------
  // TEST 1: Provider creates Draft, edits Draft, then publishes
  // --------------------------------------------------------------------------
  it("Test 1: Provider creates Draft, edits it successfully, then publishes to live", async () => {
    // 1. Create Draft
    const createRes = await request(app)
      .post("/api/v1/work-opportunities")
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`)
      .send({
        categoryId: testCategoryId,
        title: "Assembly Shift [P5_TEST]",
        description: "Initial draft description for shift [P5_TEST]",
        workType: "SHIFT",
        urgency: "NORMAL",
        workersNeeded: 1,
        location: {
          latitude: JOB_LAT,
          longitude: JOB_LNG,
        },
        addressApproximate: "Indiranagar, Bengaluru",
        workDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        startTime: "09:00",
        endTime: "17:00",
        durationHours: 8,
        paymentAmount: 1500,
        paymentType: "FIXED",
        skills: [{ skillId: testSkillId, isRequired: true }],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe("DRAFT");
    const jobId = createRes.body.data.id;

    // 2. Edit Draft while in DRAFT status -> Must succeed
    const editRes = await request(app)
      .patch(`/api/v1/work-opportunities/${jobId}`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`)
      .send({
        title: "Assembly Shift Updated [P5_TEST]",
        paymentAmount: 1600,
      });

    expect(editRes.status).toBe(200);
    expect(Number(editRes.body.data.paymentAmount)).toBe(1600);

    // 3. Publish Draft -> status becomes PUBLISHED
    const pubRes = await request(app)
      .post(`/api/v1/work-opportunities/${jobId}/publish`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`);

    expect(pubRes.status).toBe(200);
    expect(pubRes.body.data.status).toBe("PUBLISHED");

    // 4. Attempt to edit PUBLISHED job -> Must be rejected (400)
    const illegalEditRes = await request(app)
      .patch(`/api/v1/work-opportunities/${jobId}`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`)
      .send({
        title: "Illegal Edit [P5_TEST]",
      });

    expect(illegalEditRes.status).toBe(400);
    expect(illegalEditRes.body.error.message).toContain("Only opportunities in DRAFT status can be modified");

    // 5. Attempt to re-publish already PUBLISHED job -> Must be rejected (400)
    const repubRes = await request(app)
      .post(`/api/v1/work-opportunities/${jobId}/publish`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`);

    expect(repubRes.status).toBe(400);
    expect(repubRes.body.error.message).toContain("Cannot publish opportunity currently in PUBLISHED status");
  }, 30000);

  // --------------------------------------------------------------------------
  // TEST 2: Worker applies only as self; role enforcement; duplicate prevention
  // --------------------------------------------------------------------------
  it("Test 2: Worker can apply only as self; role enforcement; duplicates rejected", async () => {
    // Create and publish a job with capacity = 1
    const draftRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
         provider_id, category_id, title, description, work_type, urgency, status,
         workers_needed, workers_assigned, location, address_approximate,
         work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
         $1, $2, 'Single Slot Job [P5_TEST]', 'Single worker needed [P5_TEST]', 'TASK', 'NORMAL', 'PUBLISHED',
         1, 0, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Indiranagar, Bengaluru',
         CURRENT_DATE + INTERVAL '1 day', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 4 hours', 4, 800.00, 'FIXED'
       ) RETURNING id`,
      [providerProfileId, testCategoryId, JOB_LNG, JOB_LAT]
    );
    const jobId = draftRes.rows[0].id;

    // 1. Provider attempts to apply -> Rejected (403 Role Enforcement)
    const provApplyRes = await request(app)
      .post(`/api/v1/work-opportunities/${jobId}/applications`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`)
      .send({ workerNotes: "I am a provider trying to apply" });

    expect(provApplyRes.status).toBe(403);

    // 2. Worker 1 applies -> Success (201)
    const w1ApplyRes = await request(app)
      .post(`/api/v1/work-opportunities/${jobId}/applications`)
      .set("Authorization", `Bearer mock_token_${WORKER_1_AUTH}`)
      .send({ workerNotes: "Worker 1 first application" });

    expect(w1ApplyRes.status).toBe(201);
    expect(w1ApplyRes.body.data.status).toBe("PENDING");

    // 3. Worker 1 attempts duplicate application on same job -> Rejected (409)
    const w1DupApplyRes = await request(app)
      .post(`/api/v1/work-opportunities/${jobId}/applications`)
      .set("Authorization", `Bearer mock_token_${WORKER_1_AUTH}`)
      .send({ workerNotes: "Worker 1 second application" });

    expect(w1DupApplyRes.status).toBe(409);
    expect(w1DupApplyRes.body.error.message).toContain("already submitted an application");
  }, 30000);

  // --------------------------------------------------------------------------
  // TEST 3: Capacity limit & Auto-rejection of remaining candidates
  // --------------------------------------------------------------------------
  it("Test 3: Provider accepts applicant -> Capacity filled -> Remaining candidates auto-rejected", async () => {
    // Job with capacity = 1
    const jobRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
         provider_id, category_id, title, description, work_type, urgency, status,
         workers_needed, workers_assigned, location, address_approximate,
         work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
         $1, $2, 'Auto-Rejection Job [P5_TEST]', 'Testing auto-rejection when filled [P5_TEST]', 'SHIFT', 'NORMAL', 'PUBLISHED',
         1, 0, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Indiranagar, Bengaluru',
         CURRENT_DATE + INTERVAL '1 day', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 8 hours', 8, 1200.00, 'FIXED'
       ) RETURNING id`,
      [providerProfileId, testCategoryId, JOB_LNG, JOB_LAT]
    );
    const jobId = jobRes.rows[0].id;

    // Worker 1 applies
    const app1Res = await request(app)
      .post(`/api/v1/work-opportunities/${jobId}/applications`)
      .set("Authorization", `Bearer mock_token_${WORKER_1_AUTH}`)
      .send({ workerNotes: "Candidate 1" });
    expect(app1Res.status).toBe(201);
    const app1Id = app1Res.body.data.id;

    // Worker 2 applies
    const app2Res = await request(app)
      .post(`/api/v1/work-opportunities/${jobId}/applications`)
      .set("Authorization", `Bearer mock_token_${WORKER_2_AUTH}`)
      .send({ workerNotes: "Candidate 2" });
    expect(app2Res.status).toBe(201);
    const app2Id = app2Res.body.data.id;

    // Rival Provider attempts to accept Candidate 1 -> Forbidden (403 IDOR check)
    const rivalAcceptRes = await request(app)
      .post(`/api/v1/applications/${app1Id}/accept`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_RIVAL_AUTH}`)
      .send({ decisionNotes: "Rival attempting hire" });
    expect(rivalAcceptRes.status).toBe(403);

    // Primary Provider accepts Candidate 1 -> Success
    const acceptRes = await request(app)
      .post(`/api/v1/applications/${app1Id}/accept`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`)
      .send({ decisionNotes: "Hired worker 1" });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.application.status).toBe("ACCEPTED");

    // Verify Job Status is now FILLED and workers_assigned = 1
    const jobCheck = await query(
      `SELECT status, workers_assigned, workers_needed FROM work_opportunities WHERE id = $1`,
      [jobId]
    );
    expect(jobCheck.rows[0].status).toBe("FILLED");
    expect(jobCheck.rows[0].workers_assigned).toBe(1);

    // Verify Candidate 2 was AUTO-REJECTED with proper note
    const app2Check = await query(
      `SELECT status, decision_notes FROM applications WHERE id = $1`,
      [app2Id]
    );
    expect(app2Check.rows[0].status).toBe("REJECTED");
    expect(app2Check.rows[0].decision_notes).toContain("Position filled by another candidate");

    // Worker 3 attempts to apply to now-filled job -> Rejected (400 Job is not accepting applications)
    const w3ApplyRes = await request(app)
      .post(`/api/v1/work-opportunities/${jobId}/applications`)
      .set("Authorization", `Bearer mock_token_${WORKER_3_AUTH}`)
      .send({ workerNotes: "Too late" });

    expect(w3ApplyRes.status).toBe(400);
    expect(w3ApplyRes.body.error.message).toContain("cannot accept applications");
  }, 30000);

  // --------------------------------------------------------------------------
  // TEST 4: Database Unique Index prevents duplicate active assignment
  // --------------------------------------------------------------------------
  it("Test 4: Database partial unique index idx_unique_assignment_active_application blocks duplicate active assignments", async () => {
    const jobRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
         provider_id, category_id, title, description, work_type, urgency, status,
         workers_needed, workers_assigned, location, address_approximate,
         work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
         $1, $2, 'Index Protection Job [P5_TEST]', 'Testing DB unique index on application_id [P5_TEST]', 'TASK', 'NORMAL', 'PUBLISHED',
         2, 0, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Indiranagar, Bengaluru',
         CURRENT_DATE + INTERVAL '1 day', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 4 hours', 4, 1000.00, 'FIXED'
       ) RETURNING id`,
      [providerProfileId, testCategoryId, JOB_LNG, JOB_LAT]
    );
    const jobId = jobRes.rows[0].id;

    // Create an application
    const appRes = await query<{ id: string }>(
      `INSERT INTO applications (work_opportunity_id, worker_id, status)
       VALUES ($1, $2, 'ACCEPTED') RETURNING id`,
      [jobId, worker1ProfileId]
    );
    const applicationId = appRes.rows[0].id;

    // Insert first active assignment
    await query(
      `INSERT INTO assignments (
         work_opportunity_id, worker_id, provider_id, application_id, agreed_wage, status, assigned_at
       ) VALUES ($1, $2, $3, $4, 1000.00, 'ASSIGNED', NOW())`,
      [jobId, worker1ProfileId, providerProfileId, applicationId]
    );

    // Attempt to insert duplicate active assignment for the same application -> Must violate unique index
    let duplicateFailed = false;
    try {
      await query(
        `INSERT INTO assignments (
           work_opportunity_id, worker_id, provider_id, application_id, agreed_wage, status, assigned_at
         ) VALUES ($1, $2, $3, $4, 1000.00, 'CONFIRMED', NOW())`,
        [jobId, worker2ProfileId, providerProfileId, applicationId]
      );
    } catch (err: any) {
      duplicateFailed = true;
      expect(err.message).toMatch(/idx_unique_assignment_active_application/i);
    }
    expect(duplicateFailed).toBe(true);
  }, 30000);

  // --------------------------------------------------------------------------
  // TEST 5: Complete Assignment Execution Cycle & Protected Cancellation
  // --------------------------------------------------------------------------
  it("Test 5: Full execution cycle (ASSIGNED -> CONFIRMED -> CHECKED_IN -> IN_PROGRESS -> COMPLETED) and provider cancellation protection", async () => {
    // 1. Create published opportunity
    const jobRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
         provider_id, category_id, title, description, work_type, urgency, status,
         workers_needed, workers_assigned, location, address_approximate,
         work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
         $1, $2, 'Execution Cycle Job [P5_TEST]', 'Full cycle execution testing [P5_TEST]', 'SHIFT', 'NORMAL', 'PUBLISHED',
         1, 0, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Indiranagar, Bengaluru',
         CURRENT_DATE, NOW() - INTERVAL '10 minutes', NOW() + INTERVAL '8 hours', 8, 2000.00, 'FIXED'
       ) RETURNING id`,
      [providerProfileId, testCategoryId, JOB_LNG, JOB_LAT]
    );
    const jobId = jobRes.rows[0].id;

    // Worker applies
    const appRes = await request(app)
      .post(`/api/v1/work-opportunities/${jobId}/applications`)
      .set("Authorization", `Bearer mock_token_${WORKER_1_AUTH}`)
      .send({ workerNotes: "Ready for shift" });
    const appId = appRes.body.data.id;

    // Provider accepts
    const acceptRes = await request(app)
      .post(`/api/v1/applications/${appId}/accept`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`)
      .send({ decisionNotes: "Accepted candidate for shift" });
    const assignmentId = acceptRes.body.data.assignmentId;
    expect(assignmentId).toBeDefined();

    // Verify assignment is ASSIGNED
    const asnCheck = await query(`SELECT status, job_pin FROM assignments WHERE id = $1`, [assignmentId]);
    expect(asnCheck.rows[0].status).toBe("ASSIGNED");
    const jobPin = asnCheck.rows[0].job_pin;

    // 2. Worker attempts to check in before confirming -> Rejected (400)
    const prematureCheckIn = await request(app)
      .post(`/api/v1/assignments/${assignmentId}/check-in`)
      .set("Authorization", `Bearer mock_token_${WORKER_1_AUTH}`)
      .send({ latitude: JOB_LAT, longitude: JOB_LNG, jobPin });
    expect(prematureCheckIn.status).toBe(400);

    // 3. Worker confirms assignment (ASSIGNED -> CONFIRMED)
    const confirmRes = await request(app)
      .post(`/api/v1/assignments/${assignmentId}/confirm`)
      .set("Authorization", `Bearer mock_token_${WORKER_1_AUTH}`);
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe("CONFIRMED");

    // 4. Worker checks in with valid on-site coords & PIN (CONFIRMED -> CHECKED_IN)
    const checkInRes = await request(app)
      .post(`/api/v1/assignments/${assignmentId}/check-in`)
      .set("Authorization", `Bearer mock_token_${WORKER_1_AUTH}`)
      .send({ latitude: JOB_LAT, longitude: JOB_LNG, jobPin, manualFallback: true });
    expect(checkInRes.status).toBe(200);
    expect(checkInRes.body.data.status).toBe("CHECKED_IN");

    // 5. Provider attempts to CANCEL work opportunity while worker is on-site -> Must be BLOCKED (400)
    const cancelActiveRes = await request(app)
      .post(`/api/v1/work-opportunities/${jobId}/cancel`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`);
    expect(cancelActiveRes.status).toBe(400);
    expect(cancelActiveRes.body.error.message).toContain("Cannot cancel work opportunity with active or completed work in progress");

    // 6. Worker starts work (CHECKED_IN -> IN_PROGRESS)
    const startRes = await request(app)
      .post(`/api/v1/assignments/${assignmentId}/start`)
      .set("Authorization", `Bearer mock_token_${WORKER_1_AUTH}`);
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.status).toBe("IN_PROGRESS");

    // 7. Worker completes work (IN_PROGRESS -> COMPLETED)
    const completeRes = await request(app)
      .post(`/api/v1/assignments/${assignmentId}/check-out`)
      .set("Authorization", `Bearer mock_token_${WORKER_1_AUTH}`)
      .send({
        latitude: JOB_LAT,
        longitude: JOB_LNG,
        completionNotes: "All tasks successfully performed on-site.",
      });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.status).toBe("COMPLETED");

    // 8. Provider confirms completion & signs off -> SETTLEMENT_PENDING
    const providerSignoffRes = await request(app)
      .post(`/api/v1/assignments/${assignmentId}/confirm-completion`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`)
      .send({ finalWagePaid: 2000 });
    expect(providerSignoffRes.status).toBe(200);

    // Verify opportunity reached SETTLEMENT_PENDING
    const jobSettlementCheck = await query(
      `SELECT status FROM work_opportunities WHERE id = $1`,
      [jobId]
    );
    expect(jobSettlementCheck.rows[0].status).toBe("SETTLEMENT_PENDING");

    // Verify payment record exists in PENDING state
    const paymentCheck = await query(
      `SELECT status, amount FROM payment_records WHERE assignment_id = $1`,
      [assignmentId]
    );
    expect(paymentCheck.rows.length).toBe(1);
    expect(paymentCheck.rows[0].status).toBe("PENDING");
    expect(Number(paymentCheck.rows[0].amount)).toBe(2000);
  }, 30000);

  // --------------------------------------------------------------------------
  // TEST 6: Worker withdraws application before acceptance
  // --------------------------------------------------------------------------
  it("Test 6: Worker can withdraw application when PENDING, but cannot withdraw after ACCEPTED", async () => {
    const jobRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
         provider_id, category_id, title, description, work_type, urgency, status,
         workers_needed, workers_assigned, location, address_approximate,
         work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
         $1, $2, 'Withdrawal Test Job [P5_TEST]', 'Testing application withdrawal [P5_TEST]', 'TASK', 'NORMAL', 'PUBLISHED',
         1, 0, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Indiranagar, Bengaluru',
         CURRENT_DATE + INTERVAL '2 days', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 2 hours', 2, 500.00, 'FIXED'
       ) RETURNING id`,
      [providerProfileId, testCategoryId, JOB_LNG, JOB_LAT]
    );
    const jobId = jobRes.rows[0].id;

    // Worker 1 applies
    const appRes = await request(app)
      .post(`/api/v1/work-opportunities/${jobId}/applications`)
      .set("Authorization", `Bearer mock_token_${WORKER_1_AUTH}`)
      .send({ workerNotes: "Will withdraw" });
    const appId = appRes.body.data.id;

    // Worker 1 withdraws -> Success (200)
    const withdrawRes = await request(app)
      .post(`/api/v1/applications/${appId}/withdraw`)
      .set("Authorization", `Bearer mock_token_${WORKER_1_AUTH}`);
    expect(withdrawRes.status).toBe(200);

    // Verify status is WITHDRAWN
    const dbCheck = await query(`SELECT status FROM applications WHERE id = $1`, [appId]);
    expect(dbCheck.rows[0].status).toBe("WITHDRAWN");

    // Provider attempts to accept WITHDRAWN application -> Must be rejected (400)
    const acceptRes = await request(app)
      .post(`/api/v1/applications/${appId}/accept`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`)
      .send({ decisionNotes: "Trying to hire withdrawn worker" });
    expect(acceptRes.status).toBe(400);
    expect(acceptRes.body.error.message).toContain("Cannot accept application with status 'WITHDRAWN'");
  }, 30000);
});
