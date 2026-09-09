import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { UserRole, WorkOpportunityStatus, AssignmentStatus } from "@nearvia/types";
import { apiRouter } from "../src/routes";
import { errorHandler, notFoundHandler } from "../src/middleware";
import { query } from "../src/db";

describe("NEARVIA Phase 15: Agent-Assisted Marketplace Test Suite", () => {
  let app: Express;

  // Auth IDs
  const AGENT_PRIMARY_AUTH = "p15_agent_primary";
  const AGENT_SECONDARY_AUTH = "p15_agent_secondary"; // for IDOR testing
  const WORKER_PRIMARY_AUTH = "p15_worker_primary";
  const WORKER_UNLINKED_AUTH = "p15_worker_unlinked"; // unlinked worker
  const PROVIDER_AUTH = "p15_provider_test";

  let agentPrimaryUserId: string;
  let agentPrimaryProfileId: string;

  let agentSecondaryUserId: string;
  let agentSecondaryProfileId: string;

  let workerPrimaryUserId: string;
  let workerPrimaryProfileId: string;
  const workerPrimaryPhone = "+919815000001";

  let workerUnlinkedUserId: string;
  let workerUnlinkedProfileId: string;
  const workerUnlinkedPhone = "+919815000002";

  let providerUserId: string;
  let providerProfileId: string;

  let testCategoryId: string;
  let testJobId: string;
  let testAssignmentId: string;
  let relationshipId: string;

  const LOCATION_LNG = 77.5946;
  const LOCATION_LAT = 12.9716;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/v1", apiRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Cleanup previous test data
    const cleanup = async () => {
      await query(
        `DELETE FROM agent_worker_relationships WHERE agent_id IN (
          SELECT ap.id FROM agent_profiles ap JOIN users u ON ap.user_id = u.id WHERE u.auth_id LIKE 'p15_%'
        ) OR worker_id IN (
          SELECT wp.id FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE u.auth_id LIKE 'p15_%'
        )`
      );
      await query(
        `DELETE FROM assignments WHERE work_opportunity_id IN (
          SELECT id FROM work_opportunities WHERE title LIKE '%[P15_TEST]%'
        )`
      );
      await query(
        `DELETE FROM applications WHERE work_opportunity_id IN (
          SELECT id FROM work_opportunities WHERE title LIKE '%[P15_TEST]%'
        )`
      );
      await query(
        `DELETE FROM work_opportunities WHERE title LIKE '%[P15_TEST]%' OR provider_id IN (
          SELECT pp.id FROM provider_profiles pp JOIN users u ON pp.user_id = u.id WHERE u.auth_id LIKE 'p15_%'
        )`
      );
      await query(
        `DELETE FROM notifications WHERE recipient_id IN (SELECT id FROM users WHERE auth_id LIKE 'p15_%')`
      );
      await query(
        `DELETE FROM worker_skills WHERE worker_id IN (
          SELECT wp.id FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE u.auth_id LIKE 'p15_%'
        )`
      );
      await query(
        `DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p15_%')`
      );
      await query(
        `DELETE FROM agent_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p15_%')`
      );
      await query(
        `DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p15_%')`
      );
      await query(`DELETE FROM users WHERE auth_id LIKE 'p15_%'`);
    };

    await cleanup();

    // 1. Seed Category
    const catRes = await query<{ id: string }>(
      `INSERT INTO categories (name, slug, description, is_active)
       VALUES ('Agent Assisted Test Category [P15_TEST]', 'agent-assisted-p15', 'Test Category for Phase 15', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`
    );
    testCategoryId = catRes.rows[0].id;

    // 2. Seed Provider
    const provUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919815000099', 'Provider P15 [P15_TEST]', 'prov_p15@nearvia.test', 'PROVIDER', TRUE)
       RETURNING id`,
      [PROVIDER_AUTH]
    );
    providerUserId = provUserRes.rows[0].id;

    const provProfRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, description, location, address_approximate)
       VALUES ($1, 'P15 Construction', 'Reliable Provider', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Indiranagar, Bengaluru')
       RETURNING id`,
      [providerUserId, LOCATION_LNG, LOCATION_LAT]
    );
    providerProfileId = provProfRes.rows[0].id;

    // 3. Seed Primary Agent
    const agent1UserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919815000010', 'Ramesh Agent [P15_TEST]', 'agent1_p15@nearvia.test', 'AGENT', TRUE)
       RETURNING id`,
      [AGENT_PRIMARY_AUTH]
    );
    agentPrimaryUserId = agent1UserRes.rows[0].id;

    const agent1ProfRes = await query<{ id: string }>(
      `INSERT INTO agent_profiles (user_id, assigned_area, description, languages, address_approximate)
       VALUES ($1, 'Indiranagar, Bengaluru', 'Helping local workers find quick work', ARRAY['Kannada', 'Hindi', 'English'], 'Indiranagar')
       RETURNING id`,
      [agentPrimaryUserId]
    );
    agentPrimaryProfileId = agent1ProfRes.rows[0].id;

    // 4. Seed Secondary Agent (for IDOR)
    const agent2UserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919815000020', 'Suresh Secondary Agent [P15_TEST]', 'agent2_p15@nearvia.test', 'AGENT', TRUE)
       RETURNING id`,
      [AGENT_SECONDARY_AUTH]
    );
    agentSecondaryUserId = agent2UserRes.rows[0].id;

    const agent2ProfRes = await query<{ id: string }>(
      `INSERT INTO agent_profiles (user_id, assigned_area, description, languages)
       VALUES ($1, 'Whitefield, Bengaluru', 'Whitefield local agent', ARRAY['English'])
       RETURNING id`,
      [agentSecondaryUserId]
    );
    agentSecondaryProfileId = agent2ProfRes.rows[0].id;

    // 5. Seed Primary Worker
    const worker1UserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, $2, 'Anil Worker [P15_TEST]', 'worker1_p15@nearvia.test', 'WORKER', TRUE)
       RETURNING id`,
      [WORKER_PRIMARY_AUTH, workerPrimaryPhone]
    );
    workerPrimaryUserId = worker1UserRes.rows[0].id;

    const worker1ProfRes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, bio, experience_years, location, address_approximate, service_radius_km, is_available_now)
       VALUES ($1, 'Skilled Carpenter and Mason', 4, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Indiranagar, Bengaluru', 5, TRUE)
       RETURNING id`,
      [workerPrimaryUserId, LOCATION_LNG, LOCATION_LAT]
    );
    workerPrimaryProfileId = worker1ProfRes.rows[0].id;

    // 6. Seed Unlinked Worker
    const worker2UserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, $2, 'Sunil Unlinked Worker [P15_TEST]', 'worker2_p15@nearvia.test', 'WORKER', TRUE)
       RETURNING id`,
      [WORKER_UNLINKED_AUTH, workerUnlinkedPhone]
    );
    workerUnlinkedUserId = worker2UserRes.rows[0].id;

    const worker2ProfRes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, bio, experience_years, location, address_approximate, service_radius_km, is_available_now)
       VALUES ($1, 'Painter and Helper', 2, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Koramangala, Bengaluru', 5, TRUE)
       RETURNING id`,
      [workerUnlinkedUserId, LOCATION_LNG, LOCATION_LAT]
    );
    workerUnlinkedProfileId = worker2ProfRes.rows[0].id;

    // 7. Seed Work Opportunity in same location (Indiranagar)
    const jobRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
         provider_id, category_id, title, description, work_type, urgency, status,
         workers_needed, workers_assigned, location, address_approximate,
         work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
         $1, $2, 'Carpentry Shift [P15_TEST]', 'Need assistance with wooden shelving', 'TASK', 'NORMAL', 'PUBLISHED',
         1, 0, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Indiranagar, Bengaluru',
         CURRENT_DATE + INTERVAL '1 day', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 4 hours', 4, 900, 'FIXED'
       ) RETURNING id`,
      [providerProfileId, testCategoryId, LOCATION_LNG, LOCATION_LAT]
    );
    testJobId = jobRes.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    await query(
      `DELETE FROM agent_worker_relationships WHERE agent_id IN (
        SELECT ap.id FROM agent_profiles ap JOIN users u ON ap.user_id = u.id WHERE u.auth_id LIKE 'p15_%'
      ) OR worker_id IN (
        SELECT wp.id FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE u.auth_id LIKE 'p15_%'
      )`
    );
    await query(
      `DELETE FROM assignments WHERE work_opportunity_id IN (
        SELECT id FROM work_opportunities WHERE title LIKE '%[P15_TEST]%'
      )`
    );
    await query(
      `DELETE FROM applications WHERE work_opportunity_id IN (
        SELECT id FROM work_opportunities WHERE title LIKE '%[P15_TEST]%'
      )`
    );
    await query(
      `DELETE FROM work_opportunities WHERE title LIKE '%[P15_TEST]%' OR provider_id IN (
        SELECT pp.id FROM provider_profiles pp JOIN users u ON pp.user_id = u.id WHERE u.auth_id LIKE 'p15_%'
      )`
    );
    await query(
      `DELETE FROM notifications WHERE recipient_id IN (SELECT id FROM users WHERE auth_id LIKE 'p15_%')`
    );
    await query(
      `DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p15_%')`
    );
    await query(
      `DELETE FROM agent_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p15_%')`
    );
    await query(
      `DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p15_%')`
    );
    await query(`DELETE FROM users WHERE auth_id LIKE 'p15_%'`);
  });

  // ─────────────────────────────────────────────────────────────
  // 1. Agent Registration / Profile
  // ─────────────────────────────────────────────────────────────
  it("Test 1: Agent views own profile via GET /api/v1/agents/me", async () => {
    const res = await request(app)
      .get("/api/v1/agents/me")
      .set("Authorization", `Bearer mock_token_${AGENT_PRIMARY_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fullName).toContain("Ramesh Agent");
    expect(res.body.data.assignedArea).toBe("Indiranagar, Bengaluru");
    expect(res.body.data.languages).toContain("Kannada");
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Link Worker (Initializes as PENDING with Notification)
  // ─────────────────────────────────────────────────────────────
  it("Test 2: Agent requests access to worker by phone; initializes relationship as PENDING", async () => {
    const res = await request(app)
      .post("/api/v1/agents/workers/request")
      .set("Authorization", `Bearer mock_token_${AGENT_PRIMARY_AUTH}`)
      .send({ workerPhone: workerPrimaryPhone });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.workerFullName).toContain("Anil Worker");
    expect(res.body.data.acceptedAt).toBeNull();
    relationshipId = res.body.data.id;

    // Verify in database
    const dbRel = await query(
      `SELECT status, agent_id, worker_id FROM agent_worker_relationships WHERE id = $1`,
      [relationshipId]
    );
    expect(dbRel.rows[0].status).toBe("PENDING");
    expect(dbRel.rows[0].agent_id).toBe(agentPrimaryProfileId);
    expect(dbRel.rows[0].worker_id).toBe(workerPrimaryProfileId);

    // Verify notification was sent to worker
    const notifRes = await query(
      `SELECT type, title FROM notifications WHERE recipient_id = $1 AND type = 'AGENT_ACCESS_REQUEST'`,
      [workerPrimaryUserId]
    );
    expect(notifRes.rows.length).toBeGreaterThanOrEqual(1);
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Duplicate Link Prevention
  // ─────────────────────────────────────────────────────────────
  it("Test 3: Prevents duplicate relationship requests while already pending or active", async () => {
    const res = await request(app)
      .post("/api/v1/agents/workers/request")
      .set("Authorization", `Bearer mock_token_${AGENT_PRIMARY_AUTH}`)
      .send({ workerPhone: workerPrimaryPhone });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/already pending/i);
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Worker Views Pending Agent Request
  // ─────────────────────────────────────────────────────────────
  it("Test 4: Worker views pending agent requests via GET /api/v1/workers/me/agents", async () => {
    const res = await request(app)
      .get("/api/v1/workers/me/agents")
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const pendingRel = res.body.data.find((r: any) => r.id === relationshipId);
    expect(pendingRel).toBeDefined();
    expect(pendingRel.status).toBe("PENDING");
    expect(pendingRel.agentName).toContain("Ramesh Agent");
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Worker Accepts Request (Transitions to ACTIVE)
  // ─────────────────────────────────────────────────────────────
  it("Test 5: Worker accepts pending request, transitioning status to ACTIVE with timestamp", async () => {
    const res = await request(app)
      .post(`/api/v1/workers/me/agents/${relationshipId}/accept`)
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify database row
    const dbRel = await query(
      `SELECT status, accepted_at FROM agent_worker_relationships WHERE id = $1`,
      [relationshipId]
    );
    expect(dbRel.rows[0].status).toBe("ACTIVE");
    expect(dbRel.rows[0].accepted_at).not.toBeNull();
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Worker Sees Active Linked Agent
  // ─────────────────────────────────────────────────────────────
  it("Test 6: Worker sees active agent in their list", async () => {
    const res = await request(app)
      .get("/api/v1/workers/me/agents")
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`);

    expect(res.status).toBe(200);
    const activeRel = res.body.data.find((r: any) => r.id === relationshipId);
    expect(activeRel).toBeDefined();
    expect(activeRel.status).toBe("ACTIVE");
  });

  // ─────────────────────────────────────────────────────────────
  // 7. Worker Revokes Relationship
  // ─────────────────────────────────────────────────────────────
  it("Test 7: Worker revokes assistance relationship immediately", async () => {
    const res = await request(app)
      .post(`/api/v1/workers/me/agents/${relationshipId}/revoke`)
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const dbRel = await query(
      `SELECT status, revoked_at, revoked_by FROM agent_worker_relationships WHERE id = $1`,
      [relationshipId]
    );
    expect(dbRel.rows[0].status).toBe("REVOKED");
    expect(dbRel.rows[0].revoked_at).not.toBeNull();
    expect(dbRel.rows[0].revoked_by).toBe("WORKER");
  });

  // ─────────────────────────────────────────────────────────────
  // 8. Revoked Agent Access Rejected (403 Forbidden)
  // ─────────────────────────────────────────────────────────────
  it("Test 8: Revoked agent cannot view details, search work, or apply for worker (403)", async () => {
    // 8a. View detail
    const detailRes = await request(app)
      .get(`/api/v1/agents/workers/${workerPrimaryProfileId}`)
      .set("Authorization", `Bearer mock_token_${AGENT_PRIMARY_AUTH}`);
    expect(detailRes.status).toBe(403);
    expect(detailRes.body.error.message).toMatch(/active consent/i);

    // 8b. Discover work
    const workRes = await request(app)
      .get(`/api/v1/agents/workers/${workerPrimaryProfileId}/work`)
      .set("Authorization", `Bearer mock_token_${AGENT_PRIMARY_AUTH}`);
    expect(workRes.status).toBe(403);

    // 8c. Submit application
    const applyRes = await request(app)
      .post(`/api/v1/agents/workers/${workerPrimaryProfileId}/apply`)
      .set("Authorization", `Bearer mock_token_${AGENT_PRIMARY_AUTH}`)
      .send({ workOpportunityId: testJobId });
    expect(applyRes.status).toBe(403);
  });

  // ─────────────────────────────────────────────────────────────
  // 9. Unlinked Worker Access Rejected (403 Forbidden)
  // ─────────────────────────────────────────────────────────────
  it("Test 9: Agent cannot access an unlinked worker's profile or job discovery (403)", async () => {
    const res = await request(app)
      .get(`/api/v1/agents/workers/${workerUnlinkedProfileId}`)
      .set("Authorization", `Bearer mock_token_${AGENT_PRIMARY_AUTH}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/active consent/i);
  });

  // ─────────────────────────────────────────────────────────────
  // 10. Re-link Worker and Worker Re-accepts
  // ─────────────────────────────────────────────────────────────
  it("Test 10: Agent re-requests access by Worker ID; worker accepts, restoring ACTIVE state", async () => {
    // Re-request using RESTful POST /api/v1/agents/me/workers/:workerId
    const reqRes = await request(app)
      .post(`/api/v1/agents/me/workers/${workerPrimaryProfileId}`)
      .set("Authorization", `Bearer mock_token_${AGENT_PRIMARY_AUTH}`)
      .send({ consentConfirmed: true });

    expect(reqRes.status).toBe(201);
    expect(reqRes.body.data.status).toBe("PENDING");

    // Worker accepts
    const acceptRes = await request(app)
      .post(`/api/v1/workers/me/agents/${relationshipId}/accept`)
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`);

    expect(acceptRes.status).toBe(200);

    const dbRel = await query(
      `SELECT status FROM agent_worker_relationships WHERE id = $1`,
      [relationshipId]
    );
    expect(dbRel.rows[0].status).toBe("ACTIVE");
  });

  // ─────────────────────────────────────────────────────────────
  // 11. Agent Discovers Real Jobs for Active Worker
  // ─────────────────────────────────────────────────────────────
  it("Test 11: Agent searches nearby jobs within 5km radius for active worker", async () => {
    const res = await request(app)
      .get(`/api/v1/agents/workers/${workerPrimaryProfileId}/work`)
      .set("Authorization", `Bearer mock_token_${AGENT_PRIMARY_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.opportunities).toBeDefined();
    expect(res.body.data.opportunities.length).toBeGreaterThanOrEqual(1);

    const job = res.body.data.opportunities.find((o: any) => o.id === testJobId);
    expect(job).toBeDefined();
    expect(job.title).toContain("Carpentry Shift");
    expect(job.paymentAmount).toBe(900);
    // Ensure sensitive provider fields like email/phone are NOT exposed in discovery
    expect(job.providerPhone).toBeUndefined();
    expect(job.providerEmail).toBeUndefined();
  });

  // ─────────────────────────────────────────────────────────────
  // 12. Agent-Assisted Application Belongs to Worker
  // ─────────────────────────────────────────────────────────────
  it("Test 12: Agent submits application; worker is authoritative applicant, tagged with assisted_by_agent_id", async () => {
    const res = await request(app)
      .post(`/api/v1/agents/workers/${workerPrimaryProfileId}/apply`)
      .set("Authorization", `Bearer mock_token_${AGENT_PRIMARY_AUTH}`)
      .send({
        workOpportunityId: testJobId,
        proposedWage: 950,
        workerNotes: "Anil is a highly experienced carpenter with 4 years in joinery.",
        consentConfirmed: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const applicationId = res.body.data.id;

    // Verify in database: Application MUST belong to worker, NOT agent
    const appRow = await query<{
      worker_id: string;
      assisted_by_agent_id: string;
      status: string;
    }>(
      `SELECT worker_id, assisted_by_agent_id, status FROM applications WHERE id = $1`,
      [applicationId]
    );
    expect(appRow.rows[0].worker_id).toBe(workerPrimaryProfileId);
    expect(appRow.rows[0].assisted_by_agent_id).toBe(agentPrimaryProfileId);
    expect(appRow.rows[0].status).toBe("PENDING");

    // Worker notification check
    const notifRow = await query(
      `SELECT type FROM notifications WHERE recipient_id = $1 AND type = 'AGENT_ASSISTED_APPLICATION'`,
      [workerPrimaryUserId]
    );
    expect(notifRow.rows.length).toBeGreaterThanOrEqual(1);
  });

  // ─────────────────────────────────────────────────────────────
  // 13. Provider Sees Correct Applicant with isAgentAssisted
  // ─────────────────────────────────────────────────────────────
  it("Test 13: Provider views applicant list; worker is applicant and isAgentAssisted is true", async () => {
    const res = await request(app)
      .get(`/api/v1/work-opportunities/${testJobId}/applicants`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const applicant = res.body.data.find(
      (a: any) => a.workerId === workerPrimaryProfileId
    );
    expect(applicant).toBeDefined();
    expect(applicant.workerFullName).toContain("Anil Worker");
    expect(applicant.isAgentAssisted).toBe(true);
    expect(applicant.assistedByAgentId).toBe(agentPrimaryProfileId);
  });

  // ─────────────────────────────────────────────────────────────
  // 14. Agent Cannot Become Applicant Directly
  // ─────────────────────────────────────────────────────────────
  it("Test 14: Agent cannot apply directly as an applicant using normal worker apply endpoint", async () => {
    const res = await request(app)
      .post(`/api/v1/work-opportunities/${testJobId}/applications`)
      .set("Authorization", `Bearer mock_token_${AGENT_PRIMARY_AUTH}`)
      .send({ proposedWage: 900 });

    // Rejected because AGENT role does not have WORKER privileges
    expect(res.status).toBe(403);
  });

  // ─────────────────────────────────────────────────────────────
  // 15. Agent Cannot Accept or Confirm Assignments
  // ─────────────────────────────────────────────────────────────
  it("Test 15: Agent cannot accept or confirm an assignment on worker's behalf (403)", async () => {
    // 15a. Provider hires Worker 1
    const appRes = await query<{ id: string }>(
      `SELECT id FROM applications WHERE work_opportunity_id = $1 AND worker_id = $2`,
      [testJobId, workerPrimaryProfileId]
    );
    const applicationId = appRes.rows[0].id;

    const hireRes = await request(app)
      .post(`/api/v1/applications/${applicationId}/accept`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`)
      .send({ decisionNotes: "Hired for carpentry work" });

    expect(hireRes.status).toBe(200);
    testAssignmentId = hireRes.body.data.assignmentId;

    // 15b. Agent attempts to confirm assignment
    const confirmRes = await request(app)
      .post(`/api/v1/assignments/${testAssignmentId}/confirm`)
      .set("Authorization", `Bearer mock_token_${AGENT_PRIMARY_AUTH}`);

    // Must be rejected with 403 because agent is not the worker
    expect(confirmRes.status).toBe(403);
    expect(confirmRes.body.error.message).toMatch(/Requires one of roles: \[WORKER\]|only the assigned worker/i);
  });

  // ─────────────────────────────────────────────────────────────
  // 16. IDOR Defense
  // ─────────────────────────────────────────────────────────────
  it("Test 16: IDOR attempts across agents and workers are strictly rejected", async () => {
    // 16a. Agent 2 attempts to view Worker 1 (linked only to Agent 1)
    const idorViewRes = await request(app)
      .get(`/api/v1/agents/workers/${workerPrimaryProfileId}`)
      .set("Authorization", `Bearer mock_token_${AGENT_SECONDARY_AUTH}`);
    expect(idorViewRes.status).toBe(403);

    // 16b. Agent 2 attempts to apply for Worker 1
    const idorApplyRes = await request(app)
      .post(`/api/v1/agents/workers/${workerPrimaryProfileId}/apply`)
      .set("Authorization", `Bearer mock_token_${AGENT_SECONDARY_AUTH}`)
      .send({ workOpportunityId: testJobId });
    expect(idorApplyRes.status).toBe(403);

    // 16c. Agent 2 attempts to revoke Agent 1's relationship
    const idorRevokeRes = await request(app)
      .delete(`/api/v1/agents/workers/${workerPrimaryProfileId}`)
      .set("Authorization", `Bearer mock_token_${AGENT_SECONDARY_AUTH}`);
    expect(idorRevokeRes.status).toBe(400); // No active relationship for Agent 2 to revoke

    // 16d. Worker 2 attempts to accept Worker 1's relationship
    const idorWorkerAccept = await request(app)
      .post(`/api/v1/workers/me/agents/${relationshipId}/accept`)
      .set("Authorization", `Bearer mock_token_${WORKER_UNLINKED_AUTH}`);
    expect(idorWorkerAccept.status).toBe(404); // Not found for Worker 2
  });

  // ─────────────────────────────────────────────────────────────
  // 17. Database Integrity & Worker Direct Access
  // ─────────────────────────────────────────────────────────────
  it("Test 17: Worker logs in directly and sees assisted application and assignment in full sovereignty", async () => {
    // Worker inspects own applications
    const workerAppsRes = await request(app)
      .get("/api/v1/applications/mine")
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`);

    expect(workerAppsRes.status).toBe(200);
    const appItem = workerAppsRes.body.data.find(
      (a: any) => a.workOpportunityId === testJobId
    );
    expect(appItem).toBeDefined();
    expect(appItem.isAgentAssisted).toBe(true);
    expect(appItem.assistedByAgentId).toBe(agentPrimaryProfileId);

    // Verify audit logs were captured
    const auditRes = await query(
      `SELECT action, actor_id, target_id FROM audit_logs 
       WHERE actor_id = $1 AND target_id = $2`,
      [agentPrimaryUserId, workerPrimaryProfileId]
    );
    expect(auditRes.rows.length).toBeGreaterThanOrEqual(1);
    const actions = auditRes.rows.map((r) => r.action);
    expect(actions).toContain("AGENT_ACCESS_REQUESTED");
  });
});
