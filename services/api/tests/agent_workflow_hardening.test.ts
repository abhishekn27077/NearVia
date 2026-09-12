/**
 * NEARVIA Prompt 10: Agent-Assisted Worker Workflow Hardening Test Suite
 *
 * Covers:
 * 1. Unauthorized access & non-agent role rejection (403)
 * 2. Self-relationship prevention at API & DB trigger levels (400)
 * 3. Unlinked / unrelated worker protection (403)
 * 4. Inactive relationship lifecycle (PENDING -> ACTIVE -> REVOKED)
 * 5. Privacy & data minimization (no passwords, tokens, job_pin, exact GPS)
 * 6. Job explanation endpoint (GET /work/:jobId) & audit logging
 * 7. Mandatory worker consent on applications (rejects without consent with 400)
 * 8. Assignment coordination endpoint (GET /assignments/:assignmentId) & audit logging
 * 9. Worker sovereignty & role boundary (agent cannot confirm, check in, or edit worker profile)
 * 10. IDOR across agents and workers
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { UserRole, WorkOpportunityStatus, AssignmentStatus } from "@nearvia/types";
import { apiRouter } from "../src/routes";
import { errorHandler, notFoundHandler } from "../src/middleware";
import { query } from "../src/db";

describe("Prompt 10: Agent-Assisted Worker Workflow Hardening", () => {
  let app: Express;

  const AUTH_AGENT_A = "p10_agent_a";
  const AUTH_AGENT_B = "p10_agent_b";
  const AUTH_WORKER_1 = "p10_worker_1";
  const AUTH_WORKER_2 = "p10_worker_2";
  const AUTH_PROVIDER = "p10_provider";

  let agentAUserId: string;
  let agentAProfileId: string;
  let agentBUserId: string;
  let agentBProfileId: string;

  let worker1UserId: string;
  let worker1ProfileId: string;
  const worker1Phone = "+919876000001";

  let worker2UserId: string;
  let worker2ProfileId: string;
  const worker2Phone = "+919876000002";

  let providerUserId: string;
  let providerProfileId: string;

  let testCategoryId: string;
  let testJobId: string;
  let testAssignmentId: string;
  let relationshipId: string;

  const LNG = 77.5946;
  const LAT = 12.9716;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/v1", apiRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Cleanup previous test fixtures
    await query(
      `DELETE FROM agent_worker_relationships WHERE agent_id IN (
        SELECT ap.id FROM agent_profiles ap JOIN users u ON ap.user_id = u.id WHERE u.auth_id LIKE 'p10_%'
      ) OR worker_id IN (
        SELECT wp.id FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE u.auth_id LIKE 'p10_%'
      )`
    );
    await query(
      `DELETE FROM assignments WHERE work_opportunity_id IN (
        SELECT id FROM work_opportunities WHERE title LIKE '%[P10_TEST]%'
      )`
    );
    await query(
      `DELETE FROM applications WHERE work_opportunity_id IN (
        SELECT id FROM work_opportunities WHERE title LIKE '%[P10_TEST]%'
      )`
    );
    await query(
      `DELETE FROM work_opportunities WHERE title LIKE '%[P10_TEST]%' OR provider_id IN (
        SELECT pp.id FROM provider_profiles pp JOIN users u ON pp.user_id = u.id WHERE u.auth_id LIKE 'p10_%'
      )`
    );
    await query(
      `DELETE FROM worker_skills WHERE worker_id IN (
        SELECT wp.id FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE u.auth_id LIKE 'p10_%'
      )`
    );
    await query(`DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p10_%')`);
    await query(`DELETE FROM agent_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p10_%')`);
    await query(`DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p10_%')`);
    await query(`DELETE FROM notifications WHERE recipient_id IN (SELECT id FROM users WHERE auth_id LIKE 'p10_%')`);
    await query(`DELETE FROM users WHERE auth_id LIKE 'p10_%'`);

    // 1. Category
    const catRes = await query<{ id: string }>(
      `INSERT INTO categories (name, slug, description, is_active)
       VALUES ('Hardening Category [P10_TEST]', 'hardening-cat-p10', 'Test category for Prompt 10', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`
    );
    testCategoryId = catRes.rows[0].id;

    // 2. Provider
    const provUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919876000099', 'Provider P10 [P10_TEST]', 'prov_p10@nearvia.test', 'PROVIDER', TRUE)
       RETURNING id`,
      [AUTH_PROVIDER]
    );
    providerUserId = provUserRes.rows[0].id;

    const provProfRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, description, location, address_approximate)
       VALUES ($1, 'P10 Builders', 'Premier Construction', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Koramangala, Bengaluru')
       RETURNING id`,
      [providerUserId, LNG, LAT]
    );
    providerProfileId = provProfRes.rows[0].id;

    // 3. Agent A
    const agentAUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919876000011', 'Agent Suresh [P10_TEST]', 'agent_a_p10@nearvia.test', 'AGENT', TRUE)
       RETURNING id`,
      [AUTH_AGENT_A]
    );
    agentAUserId = agentAUserRes.rows[0].id;

    const agentAProfRes = await query<{ id: string }>(
      `INSERT INTO agent_profiles (user_id, assigned_area, description, languages, address_approximate)
       VALUES ($1, 'Koramangala, Bengaluru', 'Field Agent for Trade Workers', ARRAY['Kannada', 'Tamil'], 'Koramangala')
       RETURNING id`,
      [agentAUserId]
    );
    agentAProfileId = agentAProfRes.rows[0].id;

    // 4. Agent B (for IDOR)
    const agentBUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919876000012', 'Agent Deepak [P10_TEST]', 'agent_b_p10@nearvia.test', 'AGENT', TRUE)
       RETURNING id`,
      [AUTH_AGENT_B]
    );
    agentBUserId = agentBUserRes.rows[0].id;

    const agentBProfRes = await query<{ id: string }>(
      `INSERT INTO agent_profiles (user_id, assigned_area, description, languages, address_approximate)
       VALUES ($1, 'Whitefield, Bengaluru', 'Whitefield Community Agent', ARRAY['Hindi', 'English'], 'Whitefield')
       RETURNING id`,
      [agentBUserId]
    );
    agentBProfileId = agentBProfRes.rows[0].id;

    // 5. Worker 1
    const worker1UserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, $2, 'Worker Raju [P10_TEST]', 'worker1_p10@nearvia.test', 'WORKER', TRUE)
       RETURNING id`,
      [AUTH_WORKER_1, worker1Phone]
    );
    worker1UserId = worker1UserRes.rows[0].id;

    const worker1ProfRes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, bio, experience_years, location, address_approximate, service_radius_km, is_available_now)
       VALUES ($1, 'Mason and tile worker', 5.0, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Koramangala 4th Block', 5.0, TRUE)
       RETURNING id`,
      [worker1UserId, LNG, LAT]
    );
    worker1ProfileId = worker1ProfRes.rows[0].id;

    // 6. Worker 2 (Unlinked)
    const worker2UserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, $2, 'Worker Priya [P10_TEST]', 'worker2_p10@nearvia.test', 'WORKER', TRUE)
       RETURNING id`,
      [AUTH_WORKER_2, worker2Phone]
    );
    worker2UserId = worker2UserRes.rows[0].id;

    const worker2ProfRes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, bio, experience_years, location, address_approximate, service_radius_km, is_available_now)
       VALUES ($1, 'Painter and plasterer', 3.0, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Indiranagar 100ft Rd', 5.0, TRUE)
       RETURNING id`,
      [worker2UserId, LNG, LAT]
    );
    worker2ProfileId = worker2ProfRes.rows[0].id;

    // 7. Active Job
    const startTime = new Date(Date.now() + 86400000);
    const endTime = new Date(startTime.getTime() + 4 * 3600000);
    const jobRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
         provider_id, category_id, title, description, work_type, urgency, status,
         workers_needed, workers_assigned, location, address_approximate,
         work_date, start_time, end_time, duration_hours, payment_amount, payment_type,
         instructions, published_at
       ) VALUES (
         $1, $2, 'Masonry Shift [P10_TEST]', 'Site construction and bricklaying', 'SHIFT', 'NORMAL', 'PUBLISHED',
         2, 0, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Koramangala 6th Block, Bengaluru',
         CURRENT_DATE + INTERVAL '1 day', $5, $6, 4.0, 1200.00, 'DAILY',
         'Wear safety shoes and arrive 15 min early.', NOW()
       ) RETURNING id`,
      [providerProfileId, testCategoryId, LNG, LAT, startTime.toISOString(), endTime.toISOString()]
    );
    testJobId = jobRes.rows[0].id;
  });

  afterAll(async () => {
    await query(
      `DELETE FROM agent_worker_relationships WHERE agent_id IN (
        SELECT ap.id FROM agent_profiles ap JOIN users u ON ap.user_id = u.id WHERE u.auth_id LIKE 'p10_%'
      ) OR worker_id IN (
        SELECT wp.id FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE u.auth_id LIKE 'p10_%'
      )`
    );
    await query(`DELETE FROM assignments WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P10_TEST]%')`);
    await query(`DELETE FROM applications WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P10_TEST]%')`);
    await query(`DELETE FROM work_opportunities WHERE title LIKE '%[P10_TEST]%'`);
    await query(`DELETE FROM worker_skills WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE u.auth_id LIKE 'p10_%')`);
    await query(`DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p10_%')`);
    await query(`DELETE FROM agent_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p10_%')`);
    await query(`DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p10_%')`);
    await query(`DELETE FROM notifications WHERE recipient_id IN (SELECT id FROM users WHERE auth_id LIKE 'p10_%')`);
    await query(`DELETE FROM users WHERE auth_id LIKE 'p10_%'`);
  });

  // ─────────────────────────────────────────────────────────────
  // 1. Role Authorization Checks
  // ─────────────────────────────────────────────────────────────
  it("rejects non-authenticated requests to agent endpoints with 401", async () => {
    const res = await request(app).get("/api/v1/agents/me");
    expect(res.status).toBe(401);
  });

  it("rejects non-agent users (Worker and Provider) from accessing agent endpoints with 403", async () => {
    const workerRes = await request(app)
      .get("/api/v1/agents/me")
      .set("Authorization", `Bearer mock_token_${AUTH_WORKER_1}`);
    expect(workerRes.status).toBe(403);

    const provRes = await request(app)
      .get("/api/v1/agents/me")
      .set("Authorization", `Bearer mock_token_${AUTH_PROVIDER}`);
    expect(provRes.status).toBe(403);
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Self-Relationship Prevention
  // ─────────────────────────────────────────────────────────────
  it("rejects agent attempting to establish an assistance relationship with themselves (400)", async () => {
    // 1. By Phone: Agent passes their own phone
    const res = await request(app)
      .post("/api/v1/agents/workers/request")
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_A}`)
      .send({
        workerPhone: "+919876000011",
        consentConfirmed: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.message).toContain("cannot establish an agent-worker relationship with yourself");

    // 2. DB Trigger: Direct SQL insertion with same user_id in both agent and worker profiles
    const selfWorkerRes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, bio, location, address_approximate)
       VALUES ($1, 'Self worker test', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Self')
       RETURNING id`,
      [agentAUserId, LNG, LAT]
    );
    const selfWorkerId = selfWorkerRes.rows[0].id;

    await expect(
      query(
        `INSERT INTO agent_worker_relationships (agent_id, worker_id, status)
         VALUES ($1, $2, 'PENDING')`,
        [agentAProfileId, selfWorkerId]
      )
    ).rejects.toThrow(/cannot establish an assistance relationship with themselves/i);

    // Cleanup self worker profile
    await query(`DELETE FROM worker_profiles WHERE id = $1`, [selfWorkerId]);
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Unlinked Worker & Inactive Relationship Protection
  // ─────────────────────────────────────────────────────────────
  it("rejects agent accessing unlinked worker (403)", async () => {
    const res = await request(app)
      .get(`/api/v1/agents/workers/${worker1ProfileId}`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_A}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("agent requests worker access; relationship enters PENDING status", async () => {
    const res = await request(app)
      .post("/api/v1/agents/workers/request")
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_A}`)
      .send({
        workerPhone: worker1Phone,
        consentConfirmed: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("PENDING");
    relationshipId = res.body.data.id;
  });

  it("agent cannot view worker data or search jobs while relationship is PENDING (403)", async () => {
    const viewRes = await request(app)
      .get(`/api/v1/agents/workers/${worker1ProfileId}`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_A}`);
    expect(viewRes.status).toBe(403);

    const workRes = await request(app)
      .get(`/api/v1/agents/workers/${worker1ProfileId}/work`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_A}`);
    expect(workRes.status).toBe(403);
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Worker Acceptance & Activation
  // ─────────────────────────────────────────────────────────────
  it("worker accepts pending request; relationship status becomes ACTIVE", async () => {
    const acceptRes = await request(app)
      .post(`/api/v1/workers/me/agents/${relationshipId}/accept`)
      .set("Authorization", `Bearer mock_token_${AUTH_WORKER_1}`);

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.success).toBe(true);

    const dbRel = await query(
      `SELECT status, accepted_at FROM agent_worker_relationships WHERE id = $1`,
      [relationshipId]
    );
    expect(dbRel.rows[0].status).toBe("ACTIVE");
    expect(dbRel.rows[0].accepted_at).not.toBeNull();
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Privacy & Data Minimization
  // ─────────────────────────────────────────────────────────────
  it("active agent views worker profile with privacy protections (no passwords, tokens, or exact GPS)", async () => {
    const res = await request(app)
      .get(`/api/v1/agents/workers/${worker1ProfileId}`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_A}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.fullName).toBe("Worker Raju [P10_TEST]");
    expect(data.addressApproximate).toBe("Koramangala 4th Block");
    // Verify no raw coordinate exposure
    expect(data).not.toHaveProperty("latitude");
    expect(data).not.toHaveProperty("longitude");
    expect(data).not.toHaveProperty("location");
    expect(data).not.toHaveProperty("password_hash");
    expect(data).not.toHaveProperty("bank_account_number");
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Job Explanation Endpoint & Audit Logging
  // ─────────────────────────────────────────────────────────────
  it("agent retrieves job details to explain to the worker (GET /work/:jobId)", async () => {
    const res = await request(app)
      .get(`/api/v1/agents/workers/${worker1ProfileId}/work/${testJobId}`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_A}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const job = res.body.data;
    expect(job.title).toContain("Masonry Shift");
    expect(job.paymentAmount).toBe(1200);
    expect(job.paymentType).toBe("DAILY");
    expect(job.specialInstructions).toContain("Wear safety shoes");
    expect(job.addressApproximate).toContain("Koramangala");
    // Privacy check on provider
    expect(job).not.toHaveProperty("providerPhone");
    expect(job).not.toHaveProperty("providerEmail");

    // Verify audit log entry
    const auditRes = await query(
      `SELECT action, target_id FROM audit_logs
       WHERE actor_id = $1 AND action = 'AGENT_JOB_DETAIL_EXPLAINED'
       ORDER BY created_at DESC LIMIT 1`,
      [agentAUserId]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].target_id).toBe(worker1ProfileId);
  });

  // ─────────────────────────────────────────────────────────────
  // 7. Mandatory Worker Consent on Applications
  // ─────────────────────────────────────────────────────────────
  it("rejects assisted application when consentConfirmed is missing or false (400)", async () => {
    // Missing consentConfirmed
    const resNoConsent = await request(app)
      .post(`/api/v1/agents/workers/${worker1ProfileId}/apply`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_A}`)
      .send({
        workOpportunityId: testJobId,
        proposedWage: 1200,
        workerNotes: "Expert mason",
      });

    expect(resNoConsent.status).toBe(400);
    expect(resNoConsent.body.success).toBe(false);

    // False consentConfirmed
    const resFalseConsent = await request(app)
      .post(`/api/v1/agents/workers/${worker1ProfileId}/apply`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_A}`)
      .send({
        workOpportunityId: testJobId,
        proposedWage: 1200,
        consentConfirmed: false,
      });

    expect(resFalseConsent.status).toBe(400);
    expect(resFalseConsent.body.success).toBe(false);
  });

  it("submits assisted application successfully when consentConfirmed is true", async () => {
    const res = await request(app)
      .post(`/api/v1/agents/workers/${worker1ProfileId}/apply`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_A}`)
      .send({
        workOpportunityId: testJobId,
        proposedWage: 1250,
        workerNotes: "Worker Raju is available and agreed to this shift.",
        consentConfirmed: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const applicationId = res.body.data.id;

    // Verify DB application ownership and agent tracking
    const appRow = await query(
      `SELECT worker_id, assisted_by_agent_id, status FROM applications WHERE id = $1`,
      [applicationId]
    );
    expect(appRow.rows[0].worker_id).toBe(worker1ProfileId);
    expect(appRow.rows[0].assisted_by_agent_id).toBe(agentAProfileId);

    // Verify audit log entry
    const auditRes = await query(
      `SELECT action FROM audit_logs
       WHERE actor_id = $1 AND action = 'AGENT_APPLICATION_ASSISTED'
       ORDER BY created_at DESC LIMIT 1`,
      [agentAUserId]
    );
    expect(auditRes.rows.length).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────
  // 8. Shift Coordination Endpoint (GET /assignments/:id)
  // ─────────────────────────────────────────────────────────────
  it("creates an assignment and verifies agent coordination endpoint", async () => {
    // Directly insert an assignment for worker1
    const asgRes = await query<{ id: string }>(
      `INSERT INTO assignments (
         work_opportunity_id, worker_id, provider_id, status, agreed_wage, assigned_at
       ) VALUES (
         $1, $2, $3, 'ASSIGNED', 1250.00, NOW()
       ) RETURNING id`,
      [testJobId, worker1ProfileId, providerProfileId]
    );
    testAssignmentId = asgRes.rows[0].id;

    const res = await request(app)
      .get(`/api/v1/agents/workers/${worker1ProfileId}/assignments/${testAssignmentId}`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_A}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const asg = res.body.data;
    expect(asg.id).toBe(testAssignmentId);
    expect(asg.status).toBe("ASSIGNED");
    expect(asg.agreedWage).toBe(1250);
    expect(asg.addressApproximate).toContain("Koramangala");
    expect(asg.coordinationNotes).toBeDefined();
    // Verify job_pin is NEVER leaked to agent
    expect(asg).not.toHaveProperty("job_pin");
    expect(asg).not.toHaveProperty("job_pin_hash");

    // Verify audit log entry
    const auditRes = await query(
      `SELECT action FROM audit_logs
       WHERE actor_id = $1 AND action = 'AGENT_ASSIGNMENT_COORDINATION_VIEWED'
       ORDER BY created_at DESC LIMIT 1`,
      [agentAUserId]
    );
    expect(auditRes.rows.length).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────
  // 9. Worker Sovereignty & Non-Usurpation
  // ─────────────────────────────────────────────────────────────
  it("prevents agent from confirming assignment on worker's behalf (403)", async () => {
    const res = await request(app)
      .post(`/api/v1/assignments/${testAssignmentId}/confirm`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_A}`);

    expect(res.status).toBe(403);
  });

  it("prevents agent from checking in to assignment on worker's behalf (403)", async () => {
    const res = await request(app)
      .post(`/api/v1/assignments/${testAssignmentId}/check-in`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_A}`)
      .send({
        latitude: LAT,
        longitude: LNG,
        pin: "1234",
      });

    expect(res.status).toBe(403);
  });

  it("prevents agent from modifying worker's profile or skills (403)", async () => {
    const res = await request(app)
      .patch("/api/v1/workers/me")
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_A}`)
      .send({ bio: "Hacked by agent" });

    expect(res.status).toBe(403);
  });

  // ─────────────────────────────────────────────────────────────
  // 10. IDOR Across Agents & Cross-Worker Access
  // ─────────────────────────────────────────────────────────────
  it("strictly prevents Agent B from accessing Agent A's worker data (403)", async () => {
    // Agent B tries to view Worker 1's profile
    const viewRes = await request(app)
      .get(`/api/v1/agents/workers/${worker1ProfileId}`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_B}`);
    expect(viewRes.status).toBe(403);

    // Agent B tries to search jobs for Worker 1
    const workRes = await request(app)
      .get(`/api/v1/agents/workers/${worker1ProfileId}/work`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_B}`);
    expect(workRes.status).toBe(403);

    // Agent B tries to apply for Worker 1
    const applyRes = await request(app)
      .post(`/api/v1/agents/workers/${worker1ProfileId}/apply`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_B}`)
      .send({
        workOpportunityId: testJobId,
        consentConfirmed: true,
      });
    expect(applyRes.status).toBe(403);

    // Agent B tries to coordinate Worker 1's assignment
    const coordRes = await request(app)
      .get(`/api/v1/agents/workers/${worker1ProfileId}/assignments/${testAssignmentId}`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_B}`);
    expect(coordRes.status).toBe(403);
  });

  // ─────────────────────────────────────────────────────────────
  // 11. Worker Revocation Immediately Cuts Access
  // ─────────────────────────────────────────────────────────────
  it("worker revokes agent; agent is immediately barred from all assistance endpoints (403)", async () => {
    const revokeRes = await request(app)
      .post(`/api/v1/workers/me/agents/${relationshipId}/revoke`)
      .set("Authorization", `Bearer mock_token_${AUTH_WORKER_1}`);

    expect(revokeRes.status).toBe(200);

    // Agent A immediately gets 403 on worker endpoints
    const viewRes = await request(app)
      .get(`/api/v1/agents/workers/${worker1ProfileId}`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_A}`);
    expect(viewRes.status).toBe(403);

    const coordRes = await request(app)
      .get(`/api/v1/agents/workers/${worker1ProfileId}/assignments/${testAssignmentId}`)
      .set("Authorization", `Bearer mock_token_${AUTH_AGENT_A}`);
    expect(coordRes.status).toBe(403);
  });
});
