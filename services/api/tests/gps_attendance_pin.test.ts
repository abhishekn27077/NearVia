import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { UserRole, WorkOpportunityStatus, AssignmentStatus } from "@nearvia/types";
import { apiRouter } from "../src/routes";
import { errorHandler, notFoundHandler } from "../src/middleware";
import { query } from "../src/db";

describe("NEARVIA Phase 12: GPS Check-In/Out + Job PIN Verification Suite", () => {
  let app: Express;

  // Test Auth Identifiers with prefix p12_
  const PROVIDER_OWNER_AUTH = "p12_prov_owner";
  const PROVIDER_RIVAL_AUTH = "p12_prov_rival";
  const WORKER_ASSIGNED_AUTH = "p12_work_assigned";
  const WORKER_OTHER_AUTH = "p12_work_other";

  let providerOwnerUserId: string;
  let providerOwnerProfileId: string;
  let providerRivalUserId: string;
  let providerRivalProfileId: string;

  let workerAssignedUserId: string;
  let workerAssignedProfileId: string;
  let workerOtherUserId: string;
  let workerOtherProfileId: string;

  let testCategoryId: string;
  let testSkillId: string;

  // Test Job & Assignment references
  let jobOpportunityId: string;
  let assignmentId: string;
  let assignmentPin: string;

  let secondaryJobId: string;
  let secondaryAssignmentId: string;
  let secondaryPin: string;

  // Reference coordinates (Indiranagar, Bengaluru)
  const JOB_LAT = 12.9716;
  const JOB_LNG = 77.5946;

  // Coordinates ~50 meters away (Valid proximity)
  const NEAR_LAT = 12.9719;
  const NEAR_LNG = 77.5949;

  // Coordinates ~15 kilometers away (Outside 1000m & 1500m proximity)
  const FAR_LAT = 13.0827;
  const FAR_LNG = 77.5877;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/v1", apiRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Cleanup existing p12 test data
    const cleanup = async () => {
      await query(`DELETE FROM platform_events WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p12_%')`);
      await query(`DELETE FROM payment_records WHERE payer_id IN (SELECT id FROM users WHERE auth_id LIKE 'p12_%') OR payee_id IN (SELECT id FROM users WHERE auth_id LIKE 'p12_%')`);
      await query(`DELETE FROM attendance_records WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p12_%')`);
      await query(`DELETE FROM assignments WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P12_TEST]%')`);
      await query(`DELETE FROM applications WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P12_TEST]%')`);
      await query(`DELETE FROM work_opportunity_skills WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P12_TEST]%')`);
      await query(`DELETE FROM work_opportunities WHERE title LIKE '%[P12_TEST]%' OR provider_id IN (SELECT pp.id FROM provider_profiles pp JOIN users u ON u.id = pp.user_id WHERE u.auth_id LIKE 'p12_%')`);
      await query(`DELETE FROM worker_skills WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p12_%')`);
      await query(`DELETE FROM worker_availability WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p12_%')`);
      await query(`DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p12_%')`);
      await query(`DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p12_%')`);
      await query(`DELETE FROM users WHERE auth_id LIKE 'p12_%'`);
    };

    await cleanup();

    // 1. Seed Category & Skill
    const catRes = await query<{ id: string }>(
      `INSERT INTO categories (name, slug, description, is_active)
       VALUES ('Appliance Repair [P12_TEST]', 'appliances-p12', 'Repair and installation services', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`
    );
    testCategoryId = catRes.rows[0].id;

    const skillRes = await query<{ id: string }>(
      `INSERT INTO skills (category_id, name, description, is_active)
       VALUES ($1, 'AC Diagnostics [P12_TEST]', 'HVAC Diagnostics and Repair', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      [testCategoryId]
    );
    testSkillId = skillRes.rows[0].id;

    // 2. Seed Provider Owner
    const provOwnerRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919900330001', 'Provider Owner [P12]', 'owner_p12@nearvia.test', 'PROVIDER', TRUE)
       RETURNING id`,
      [PROVIDER_OWNER_AUTH]
    );
    providerOwnerUserId = provOwnerRes.rows[0].id;

    const provOwnerProfRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, description, location, address_approximate)
       VALUES ($1, 'Apex Services Bangalore', 'Primary Provider [P12_TEST]', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Indiranagar, Bengaluru')
       RETURNING id`,
      [providerOwnerUserId, JOB_LNG, JOB_LAT]
    );
    providerOwnerProfileId = provOwnerProfRes.rows[0].id;

    // 3. Seed Provider Rival (for authorization rejection testing)
    const provRivalRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919900330002', 'Provider Rival [P12]', 'rival_p12@nearvia.test', 'PROVIDER', TRUE)
       RETURNING id`,
      [PROVIDER_RIVAL_AUTH]
    );
    providerRivalUserId = provRivalRes.rows[0].id;

    const provRivalProfRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, description, location, address_approximate)
       VALUES ($1, 'Rival Electro Corp', 'Rival Provider [P12_TEST]', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Whitefield, Bengaluru')
       RETURNING id`,
      [providerRivalUserId, JOB_LNG, JOB_LAT]
    );
    providerRivalProfileId = provRivalProfRes.rows[0].id;

    // 4. Seed Assigned Worker
    const wAssignedRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919900440001', 'Assigned Worker [P12]', 'worker_assigned@nearvia.test', 'WORKER', TRUE)
       RETURNING id`,
      [WORKER_ASSIGNED_AUTH]
    );
    workerAssignedUserId = wAssignedRes.rows[0].id;

    const wpAssignedRes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (
         user_id, location, address_approximate,
         reliability_score, completed_tasks_count, total_ratings_count, average_rating,
         is_available_now, availability_status, verified_badge
       ) VALUES (
         $1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Indiranagar, Bengaluru',
         96.0, 15, 8, 4.9,
         TRUE, 'AVAILABLE_NOW', TRUE
       ) RETURNING id`,
      [workerAssignedUserId, JOB_LNG, JOB_LAT]
    );
    workerAssignedProfileId = wpAssignedRes.rows[0].id;

    await query(
      `INSERT INTO worker_skills (worker_id, skill_id, years_experience, is_verified)
       VALUES ($1, $2, 4.0, TRUE)`,
      [workerAssignedProfileId, testSkillId]
    );

    // 5. Seed Other Worker (for IDOR / unauthorized checks)
    const wOtherRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919900440002', 'Other Worker [P12]', 'worker_other@nearvia.test', 'WORKER', TRUE)
       RETURNING id`,
      [WORKER_OTHER_AUTH]
    );
    workerOtherUserId = wOtherRes.rows[0].id;

    const wpOtherRes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (
         user_id, location, address_approximate,
         reliability_score, completed_tasks_count, total_ratings_count, average_rating,
         is_available_now, availability_status, verified_badge
       ) VALUES (
         $1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Koramangala, Bengaluru',
         90.0, 5, 2, 4.5,
         TRUE, 'AVAILABLE_NOW', FALSE
       ) RETURNING id`,
      [workerOtherUserId, JOB_LNG, JOB_LAT]
    );
    workerOtherProfileId = wpOtherRes.rows[0].id;

    // 6. Seed Primary Job Opportunity
    const jobRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
         provider_id, category_id, title, description, work_type, urgency, status,
         workers_needed, workers_assigned, location, address_approximate,
         work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
         $1, $2, 'AC Repair Task [P12_TEST]', 'In-person AC diagnostics and servicing', 'TASK', 'NORMAL', 'FILLED',
         1, 1, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Indiranagar 100ft Rd, Bengaluru',
         CURRENT_DATE, NOW(), NOW() + INTERVAL '4 hours', 4, 850.00, 'FIXED'
       ) RETURNING id`,
      [providerOwnerProfileId, testCategoryId, JOB_LNG, JOB_LAT]
    );
    jobOpportunityId = jobRes.rows[0].id;

    // 7. Seed Primary Assignment with known PIN '4821'
    assignmentPin = "4821";
    const asnRes = await query<{ id: string }>(
      `INSERT INTO assignments (
         work_opportunity_id, worker_id, provider_id, status,
         agreed_wage, payment_status, job_pin, job_pin_attempts
       ) VALUES (
         $1, $2, $3, 'ASSIGNED',
         850.00, 'PENDING', $4, 0
       ) RETURNING id`,
      [jobOpportunityId, workerAssignedProfileId, providerOwnerProfileId, assignmentPin]
    );
    assignmentId = asnRes.rows[0].id;

    // 8. Seed Secondary Job & Assignment for separate PIN lockout testing
    const secJobRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
         provider_id, category_id, title, description, work_type, urgency, status,
         workers_needed, workers_assigned, location, address_approximate,
         work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
         $1, $2, 'Secondary Lockout Job [P12_TEST]', 'Test job for pin lockout', 'TASK', 'NORMAL', 'FILLED',
         1, 1, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Indiranagar 100ft Rd, Bengaluru',
         CURRENT_DATE, NOW(), NOW() + INTERVAL '2 hours', 2, 500.00, 'FIXED'
       ) RETURNING id`,
      [providerOwnerProfileId, testCategoryId, JOB_LNG, JOB_LAT]
    );
    secondaryJobId = secJobRes.rows[0].id;

    secondaryPin = "7392";
    const secAsnRes = await query<{ id: string }>(
      `INSERT INTO assignments (
         work_opportunity_id, worker_id, provider_id, status,
         agreed_wage, payment_status, job_pin, job_pin_attempts
       ) VALUES (
         $1, $2, $3, 'CONFIRMED',
         500.00, 'PENDING', $4, 0
       ) RETURNING id`,
      [secondaryJobId, workerAssignedProfileId, providerOwnerProfileId, secondaryPin]
    );
    secondaryAssignmentId = secAsnRes.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup p12 test data
    await query(`DELETE FROM platform_events WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p12_%')`);
    await query(`DELETE FROM payment_records WHERE payer_id IN (SELECT id FROM users WHERE auth_id LIKE 'p12_%') OR payee_id IN (SELECT id FROM users WHERE auth_id LIKE 'p12_%')`);
    await query(`DELETE FROM attendance_records WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p12_%')`);
    await query(`DELETE FROM assignments WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P12_TEST]%')`);
    await query(`DELETE FROM applications WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P12_TEST]%')`);
    await query(`DELETE FROM work_opportunity_skills WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P12_TEST]%')`);
    await query(`DELETE FROM work_opportunities WHERE title LIKE '%[P12_TEST]%' OR provider_id IN (SELECT pp.id FROM provider_profiles pp JOIN users u ON u.id = pp.user_id WHERE u.auth_id LIKE 'p12_%')`);
    await query(`DELETE FROM worker_skills WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p12_%')`);
    await query(`DELETE FROM worker_availability WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p12_%')`);
    await query(`DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p12_%')`);
    await query(`DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p12_%')`);
    await query(`DELETE FROM users WHERE auth_id LIKE 'p12_%'`);
  });

  // ==========================================================================
  // SECTION 1: Authentication & Authorization Security (IDOR)
  // ==========================================================================
  describe("1. Authentication and Authorization Guardrails", () => {
    it("1.1: Unauthenticated request to check-in returns 401", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-in`)
        .send({ latitude: NEAR_LAT, longitude: NEAR_LNG });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("1.2: Unauthenticated request to check-out returns 401", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-out`)
        .send({ latitude: NEAR_LAT, longitude: NEAR_LNG });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("1.3: Unauthenticated request to verify-pin returns 401", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/verify-pin`)
        .send({ jobPin: "1234" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("1.4: Other worker cannot check in to another worker's assignment (403)", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-in`)
        .set("Authorization", `Bearer mock_token_${WORKER_OTHER_AUTH}`)
        .send({ latitude: NEAR_LAT, longitude: NEAR_LNG });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("1.5: Rival provider cannot verify PIN on another provider's assignment (403)", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/verify-pin`)
        .set("Authorization", `Bearer mock_token_${PROVIDER_RIVAL_AUTH}`)
        .send({ jobPin: assignmentPin });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================================================
  // SECTION 2: State Machine Validation & Pre-conditions
  // ==========================================================================
  describe("2. State Machine Pre-conditions", () => {
    it("2.1: Check-in rejected when assignment is in ASSIGNED state (must be CONFIRMED)", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-in`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`)
        .send({ latitude: NEAR_LAT, longitude: NEAR_LNG });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("ASSIGNMENT_INVALID_STATE");
    });

    it("2.2: Worker confirms assignment (ASSIGNED -> CONFIRMED)", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/confirm`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(AssignmentStatus.CONFIRMED);
    });

    it("2.3: Check-out rejected when assignment is in CONFIRMED state (must be IN_PROGRESS or CHECKED_IN)", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-out`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`)
        .send({ latitude: NEAR_LAT, longitude: NEAR_LNG });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CHECK_OUT_INVALID_STATE");
    });
  });

  // ==========================================================================
  // SECTION 3: GPS Check-In Proximity, Schema Validation & Fallback
  // ==========================================================================
  describe("3. GPS Check-In Proximity and Verification", () => {
    it("3.1: Invalid coordinates (latitude > 90) rejected by schema validator", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-in`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`)
        .send({ latitude: 120.5, longitude: NEAR_LNG });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("3.2: Worker outside 1000m radius rejected (CHECK_IN_PROXIMITY_EXCEEDED)", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-in`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`)
        .send({ latitude: FAR_LAT, longitude: FAR_LNG });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CHECK_IN_PROXIMITY_EXCEEDED");
    });

    it("3.3: Worker inside 1000m radius checks in successfully without PIN", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-in`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`)
        .send({ latitude: NEAR_LAT, longitude: NEAR_LNG });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(AssignmentStatus.CHECKED_IN);
      expect(res.body.data.checkedInAt).toBeDefined();
      expect(res.body.data.checkInDistanceMeters).toBeDefined();
      expect(res.body.data.checkInDistanceMeters).toBeLessThanOrEqual(1000);

      // Verify privacy: worker coordinates must NOT be exposed in assignment detail
      expect(res.body.data).not.toHaveProperty("workerLatitude");
      expect(res.body.data).not.toHaveProperty("workerLongitude");
    });

    it("3.4: Duplicate check-in rejected with ALREADY_CHECKED_IN (400)", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-in`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`)
        .send({ latitude: NEAR_LAT, longitude: NEAR_LNG });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("ALREADY_CHECKED_IN");
    });
  });

  // ==========================================================================
  // SECTION 4: Job PIN Verification & Lockout Protection
  // ==========================================================================
  describe("4. Job PIN Verification and Lockout Protection", () => {
    it("4.1: Check-in with incorrect PIN fails with INVALID_JOB_PIN", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${secondaryAssignmentId}/check-in`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`)
        .send({ latitude: NEAR_LAT, longitude: NEAR_LNG, jobPin: "0000" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_JOB_PIN");
      expect(res.body.error.message).toMatch(/attempts remaining/i);
    });

    it("4.2: Dedicated verify-pin endpoint increments failed attempts until lockout (5 max)", async () => {
      // Failed attempt 2
      const res2 = await request(app)
        .post(`/api/v1/assignments/${secondaryAssignmentId}/verify-pin`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`)
        .send({ jobPin: "1111" });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe("INVALID_JOB_PIN");

      // Failed attempt 3
      const res3 = await request(app)
        .post(`/api/v1/assignments/${secondaryAssignmentId}/verify-pin`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`)
        .send({ jobPin: "2222" });
      expect(res3.status).toBe(400);

      // Failed attempt 4
      const res4 = await request(app)
        .post(`/api/v1/assignments/${secondaryAssignmentId}/verify-pin`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`)
        .send({ jobPin: "3333" });
      expect(res4.status).toBe(400);

      // Failed attempt 5: Triggers lockout (429)
      const res5 = await request(app)
        .post(`/api/v1/assignments/${secondaryAssignmentId}/verify-pin`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`)
        .send({ jobPin: "4444" });
      expect(res5.status).toBe(429);
      expect(res5.body.error.code).toBe("JOB_PIN_MAX_ATTEMPTS_EXCEEDED");
      expect(res5.body.error.message).toMatch(/locked|maximum pin/i);

      // Subsequent attempt 6: Must remain locked out (429)
      const res6 = await request(app)
        .post(`/api/v1/assignments/${secondaryAssignmentId}/verify-pin`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`)
        .send({ jobPin: "5555" });
      expect(res6.status).toBe(429);
      expect(res6.body.error.code).toBe("JOB_PIN_MAX_ATTEMPTS_EXCEEDED");
    });

    it("4.3: Correct PIN verification on primary assignment succeeds", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/verify-pin`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`)
        .send({ jobPin: assignmentPin });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobPinVerifiedAt).toBeDefined();

      // Verify attendance_records table was updated
      const attCheck = await query(
        `SELECT verified_by_provider FROM attendance_records WHERE assignment_id = $1`,
        [assignmentId]
      );
      expect(attCheck.rows.length).toBeGreaterThan(0);
      expect(attCheck.rows[0].verified_by_provider).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 5: GPS Check-Out Proximity, Duration & Completion
  // ==========================================================================
  describe("5. GPS Check-Out Proximity, Completion and Attendance", () => {
    it("5.1: Worker outside 1500m radius rejected for check-out (CHECK_OUT_PROXIMITY_EXCEEDED)", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-out`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`)
        .send({ latitude: FAR_LAT, longitude: FAR_LNG });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CHECK_OUT_PROXIMITY_EXCEEDED");
    });

    it("5.2: Worker inside 1500m radius checks out successfully (IN_PROGRESS -> COMPLETED)", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-out`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`)
        .send({
          latitude: NEAR_LAT,
          longitude: NEAR_LNG,
          completionNotes: "Job completed with thorough inspection [P12_TEST]",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(AssignmentStatus.COMPLETED);
      expect(res.body.data.completedAt).toBeDefined();
      expect(res.body.data.checkOutDistanceMeters).toBeDefined();
      expect(res.body.data.checkOutDistanceMeters).toBeLessThanOrEqual(1500);

      // Verify privacy: worker coordinates must NOT be exposed in assignment detail
      expect(res.body.data).not.toHaveProperty("workerLatitude");
      expect(res.body.data).not.toHaveProperty("workerLongitude");
    });

    it("5.3: Duplicate check-out rejected with ALREADY_COMPLETED (400)", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/check-out`)
        .set("Authorization", `Bearer mock_token_${WORKER_ASSIGNED_AUTH}`)
        .send({ latitude: NEAR_LAT, longitude: NEAR_LNG });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("ALREADY_COMPLETED");
    });
  });

  // ==========================================================================
  // SECTION 6: Provider Inspection & Privacy Verification
  // ==========================================================================
  describe("6. Provider View and Worker Privacy Protection", () => {
    it("6.1: Provider views assignment: sees timestamps & distance, NEVER worker GPS coordinates", async () => {
      const res = await request(app)
        .get(`/api/v1/assignments/${assignmentId}`)
        .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      // Provider sees status and timestamps
      expect(data.status).toBe(AssignmentStatus.COMPLETED);
      expect(data.checkedInAt).toBeDefined();
      expect(data.completedAt).toBeDefined();
      expect(data.checkInDistanceMeters).toBeDefined();
      expect(data.checkOutDistanceMeters).toBeDefined();

      // Provider sees job PIN
      expect(data.jobPin).toBe(assignmentPin);

      // CRITICAL PRIVACY: Worker's live or historical device coordinates must NOT be exposed
      expect(data).not.toHaveProperty("workerLatitude");
      expect(data).not.toHaveProperty("workerLongitude");
      expect(data).not.toHaveProperty("checkInLatitude");
      expect(data).not.toHaveProperty("checkInLongitude");
      expect(data).not.toHaveProperty("checkOutLatitude");
      expect(data).not.toHaveProperty("checkOutLongitude");
    });
  });

  // ==========================================================================
  // SECTION 7: Database State & Platform Events Audit
  // ==========================================================================
  describe("7. Authoritative Database State & Event Auditing", () => {
    it("7.1: attendance_records table stores check_in, check_out and proximity accurately", async () => {
      const attRes = await query<{
        check_in_time: Date;
        check_out_time: Date;
        distance_meters: number;
        check_out_distance_meters: number;
        verified_by_provider: boolean;
      }>(
        `SELECT check_in_time, check_out_time, distance_meters, check_out_distance_meters, verified_by_provider
         FROM attendance_records
         WHERE assignment_id = $1`,
        [assignmentId]
      );

      expect(attRes.rows.length).toBe(1);
      const record = attRes.rows[0];
      expect(record.check_in_time).not.toBeNull();
      expect(record.check_out_time).not.toBeNull();
      expect(Number(record.distance_meters)).toBeGreaterThanOrEqual(0);
      expect(Number(record.check_out_distance_meters)).toBeGreaterThanOrEqual(0);
      expect(record.verified_by_provider).toBe(true);
    });

    it("7.2: platform_events records WORKER_CHECKED_IN, JOB_PIN_VERIFIED, and WORKER_CHECKED_OUT", async () => {
      const evRes = await query<{ event_type: string }>(
        `SELECT event_type FROM platform_events
         WHERE resource_id = $1
         ORDER BY created_at ASC`,
        [assignmentId]
      );

      const eventTypes = evRes.rows.map((r) => r.event_type);
      expect(eventTypes).toContain("WORKER_CHECKED_IN");
      expect(eventTypes).toContain("JOB_PIN_VERIFIED");
      expect(eventTypes).toContain("WORKER_CHECKED_OUT");
      expect(eventTypes).toContain("WORK_COMPLETED");
    });
  });
});
