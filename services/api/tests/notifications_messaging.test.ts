import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { UserRole } from "@nearvia/types";
import { apiRouter } from "../src/routes";
import { errorHandler, notFoundHandler } from "../src/middleware";
import { query } from "../src/db";
import { notificationsService } from "../src/modules/notifications/service";

describe("NEARVIA Phase 16: Notifications & Messaging Security & Flow Test Suite", () => {
  let app: Express;

  // Test auth identifiers
  const PROVIDER_AUTH = "p16_provider_test";
  const WORKER_AUTH = "p16_worker_test";
  const UNRELATED_WORKER_AUTH = "p16_worker_unrelated";
  const AGENT_AUTH = "p16_agent_test";

  let providerUserId: string;
  let providerProfileId: string;

  let workerUserId: string;
  let workerProfileId: string;

  let unrelatedWorkerUserId: string;
  let unrelatedWorkerProfileId: string;

  let agentUserId: string;
  let agentProfileId: string;

  let testCategoryId: string;
  let testJobId: string;
  let testApplicationId: string;
  let testConversationId: string;

  let notificationWorkerId: string;
  let notificationProviderId: string;

  const LOCATION_LNG = 77.5946;
  const LOCATION_LAT = 12.9716;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/v1", apiRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Cleanup previous Phase 16 test data
    const cleanup = async () => {
      await query(
        `DELETE FROM messages WHERE conversation_id IN (
          SELECT c.id FROM conversations c 
          JOIN work_opportunities wo ON c.work_opportunity_id = wo.id 
          WHERE wo.title LIKE '%[P16_TEST]%'
        )`
      );
      await query(
        `DELETE FROM conversations WHERE work_opportunity_id IN (
          SELECT id FROM work_opportunities WHERE title LIKE '%[P16_TEST]%'
        )`
      );
      await query(
        `DELETE FROM agent_worker_relationships WHERE agent_id IN (
          SELECT ap.id FROM agent_profiles ap JOIN users u ON ap.user_id = u.id WHERE u.auth_id LIKE 'p16_%'
        ) OR worker_id IN (
          SELECT wp.id FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE u.auth_id LIKE 'p16_%'
        )`
      );
      await query(
        `DELETE FROM assignments WHERE work_opportunity_id IN (
          SELECT id FROM work_opportunities WHERE title LIKE '%[P16_TEST]%'
        )`
      );
      await query(
        `DELETE FROM applications WHERE work_opportunity_id IN (
          SELECT id FROM work_opportunities WHERE title LIKE '%[P16_TEST]%'
        )`
      );
      await query(
        `DELETE FROM work_opportunities WHERE title LIKE '%[P16_TEST]%'`
      );
      await query(
        `DELETE FROM notifications WHERE recipient_id IN (SELECT id FROM users WHERE auth_id LIKE 'p16_%')`
      );
      await query(
        `DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p16_%')`
      );
      await query(
        `DELETE FROM agent_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p16_%')`
      );
      await query(
        `DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p16_%')`
      );
      await query(`DELETE FROM users WHERE auth_id LIKE 'p16_%'`);
    };

    await cleanup();

    // 1. Seed Category
    const catRes = await query<{ id: string }>(
      `INSERT INTO categories (name, slug, description, is_active)
       VALUES ('Notifications Test Category [P16_TEST]', 'notif-p16', 'Test Category for Phase 16', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`
    );
    testCategoryId = catRes.rows[0].id;

    // 2. Seed Provider
    const provUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919816000001', 'Provider P16 [P16_TEST]', 'prov_p16@nearvia.test', 'PROVIDER', TRUE)
       RETURNING id`,
      [PROVIDER_AUTH]
    );
    providerUserId = provUserRes.rows[0].id;

    const provProfRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, description, location, address_approximate)
       VALUES ($1, 'P16 Enterprises', 'Verified Employer', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Koramangala, Bengaluru')
       RETURNING id`,
      [providerUserId, LOCATION_LNG, LOCATION_LAT]
    );
    providerProfileId = provProfRes.rows[0].id;

    // 3. Seed Worker (with application on test job)
    const workerUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919816000002', 'Worker P16 [P16_TEST]', 'worker_p16@nearvia.test', 'WORKER', TRUE)
       RETURNING id`,
      [WORKER_AUTH]
    );
    workerUserId = workerUserRes.rows[0].id;

    const workerProfRes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, location, address_approximate, is_available_now)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Koramangala, Bengaluru', TRUE)
       RETURNING id`,
      [workerUserId, LOCATION_LNG, LOCATION_LAT]
    );
    workerProfileId = workerProfRes.rows[0].id;

    // 4. Seed Unrelated Worker (no application or assignment)
    const unrelatedUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919816000003', 'Unrelated Worker [P16_TEST]', 'unrelated_p16@nearvia.test', 'WORKER', TRUE)
       RETURNING id`,
      [UNRELATED_WORKER_AUTH]
    );
    unrelatedWorkerUserId = unrelatedUserRes.rows[0].id;

    const unrelatedProfRes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, location, address_approximate, is_available_now)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Whitefield, Bengaluru', TRUE)
       RETURNING id`,
      [unrelatedWorkerUserId, LOCATION_LNG, LOCATION_LAT]
    );
    unrelatedWorkerProfileId = unrelatedProfRes.rows[0].id;

    // 5. Seed Assisting Agent
    const agentUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919816000004', 'Agent P16 [P16_TEST]', 'agent_p16@nearvia.test', 'AGENT', TRUE)
       RETURNING id`,
      [AGENT_AUTH]
    );
    agentUserId = agentUserRes.rows[0].id;

    const agentProfRes = await query<{ id: string }>(
      `INSERT INTO agent_profiles (user_id, assigned_area, description)
       VALUES ($1, 'Koramangala, Bengaluru', 'P16 Assistance Bureau')
       RETURNING id`,
      [agentUserId]
    );
    agentProfileId = agentProfRes.rows[0].id;

    // 6. Seed Work Opportunity (Job)
    const jobRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
        provider_id, category_id, title, description, work_type, urgency, status,
        workers_needed, workers_assigned, location, address_approximate,
        work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
        $1, $2, 'Store Inventory Assistant [P16_TEST]', 'Assist with retail inventory stock count',
        'TASK', 'NORMAL', 'PUBLISHED', 2, 0,
        ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Koramangala, Bengaluru',
        CURRENT_DATE + INTERVAL '1 day', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 4 hours',
        4, 850.00, 'HOURLY'
       ) RETURNING id`,
      [providerProfileId, testCategoryId, LOCATION_LNG, LOCATION_LAT]
    );
    testJobId = jobRes.rows[0].id;

    // 7. Seed Application for Worker on this Job
    const appRes = await query<{ id: string }>(
      `INSERT INTO applications (
        work_opportunity_id, worker_id, status, proposed_wage, created_at, updated_at
       ) VALUES ($1, $2, 'PENDING', 850.00, NOW(), NOW())
       RETURNING id`,
      [testJobId, workerProfileId]
    );
    testApplicationId = appRes.rows[0].id;

    // 8. Seed Initial Notifications
    const n1 = await query<{ id: string }>(
      `INSERT INTO notifications (recipient_id, type, title, message, data, is_read, created_at)
       VALUES ($1, 'NEW_APPLICATION', 'New Applicant for Job', 'Worker P16 applied.', '{"workOpportunityId":"${testJobId}"}', FALSE, NOW())
       RETURNING id`,
      [providerUserId]
    );
    notificationProviderId = n1.rows[0].id;

    const n2 = await query<{ id: string }>(
      `INSERT INTO notifications (recipient_id, type, title, message, data, is_read, created_at)
       VALUES ($1, 'APPLICATION_SHORTLISTED', 'You were shortlisted', 'Check your application.', '{"workOpportunityId":"${testJobId}"}', FALSE, NOW())
       RETURNING id`,
      [workerUserId]
    );
    notificationWorkerId = n2.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup
    await query(
      `DELETE FROM messages WHERE conversation_id IN (
        SELECT c.id FROM conversations c 
        JOIN work_opportunities wo ON c.work_opportunity_id = wo.id 
        WHERE wo.title LIKE '%[P16_TEST]%'
      )`
    );
    await query(
      `DELETE FROM conversations WHERE work_opportunity_id IN (
        SELECT id FROM work_opportunities WHERE title LIKE '%[P16_TEST]%'
      )`
    );
    await query(
      `DELETE FROM agent_worker_relationships WHERE agent_id IN (
        SELECT ap.id FROM agent_profiles ap JOIN users u ON ap.user_id = u.id WHERE u.auth_id LIKE 'p16_%'
      ) OR worker_id IN (
        SELECT wp.id FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE u.auth_id LIKE 'p16_%'
      )`
    );
    await query(
      `DELETE FROM assignments WHERE work_opportunity_id IN (
        SELECT id FROM work_opportunities WHERE title LIKE '%[P16_TEST]%'
      )`
    );
    await query(
      `DELETE FROM applications WHERE work_opportunity_id IN (
        SELECT id FROM work_opportunities WHERE title LIKE '%[P16_TEST]%'
      )`
    );
    await query(
      `DELETE FROM work_opportunities WHERE title LIKE '%[P16_TEST]%'`
    );
    await query(
      `DELETE FROM notifications WHERE recipient_id IN (SELECT id FROM users WHERE auth_id LIKE 'p16_%')`
    );
    await query(
      `DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p16_%')`
    );
    await query(
      `DELETE FROM agent_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p16_%')`
    );
    await query(
      `DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p16_%')`
    );
    await query(`DELETE FROM users WHERE auth_id LIKE 'p16_%'`);
  });

  // -------------------------------------------------------------------------
  // NOTIFICATIONS TESTS
  // -------------------------------------------------------------------------

  it("Test 1: Unauthenticated notifications access rejected (401)", async () => {
    const res = await request(app).get("/api/v1/notifications");
    expect(res.status).toBe(401);
  });

  it("Test 2: User sees only own notifications via GET /api/v1/notifications", async () => {
    const res = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);

    // Assert all returned notifications belong to workerUserId
    for (const item of res.body.data.items) {
      expect(item.recipientId).toBe(workerUserId);
    }
  });

  it("Test 3: Attempting to mark another user's notification as read is rejected (403)", async () => {
    // Worker attempts to mark Provider's notification as read
    const res = await request(app)
      .patch(`/api/v1/notifications/${notificationProviderId}/read`)
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/cannot mark another user's notification/i);
  });

  it("Test 4: Marking non-existent notification as read returns 404", async () => {
    const res = await request(app)
      .patch(`/api/v1/notifications/00000000-0000-0000-0000-000000000000/read`)
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`);

    expect(res.status).toBe(404);
  });

  it("Test 5: GET /api/v1/notifications/unread-count returns accurate count", async () => {
    const res = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(1);
  });

  it("Test 6: PATCH /api/v1/notifications/:id/read marks individual notification read", async () => {
    const res = await request(app)
      .patch(`/api/v1/notifications/${notificationWorkerId}/read`)
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.updated).toBe(true);

    // Verify unread count is now 0 for worker
    const countRes = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`);

    expect(countRes.body.data.unreadCount).toBe(0);
  });

  it("Test 7: PATCH /api/v1/notifications/read-all marks all notifications read", async () => {
    // Add two unread notifications for provider
    await notificationsService.createNotification(
      providerUserId,
      "TEST_NOTIF_1",
      "Notice 1",
      "Description 1"
    );
    await notificationsService.createNotification(
      providerUserId,
      "TEST_NOTIF_2",
      "Notice 2",
      "Description 2"
    );

    const markRes = await request(app)
      .patch("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`);

    expect(markRes.status).toBe(200);
    expect(markRes.body.success).toBe(true);
    expect(markRes.body.data.markedCount).toBeGreaterThanOrEqual(1);

    const countRes = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`);

    expect(countRes.body.data.unreadCount).toBe(0);
  });

  it("Test 8: Sliding window deduplication suppresses duplicate notifications", async () => {
    // First notification
    const id1 = await notificationsService.createNotification(
      workerUserId,
      "SHIFT_REMINDER",
      "Shift starting soon",
      "Please arrive on time.",
      { workOpportunityId: testJobId }
    );
    expect(id1).toBeTruthy();

    // Immediate duplicate attempt for same worker, type, and workOpportunityId
    const id2 = await notificationsService.createNotification(
      workerUserId,
      "SHIFT_REMINDER",
      "Shift starting soon",
      "Please arrive on time.",
      { workOpportunityId: testJobId }
    );

    // Should return the exact same notification ID due to deduplication suppression
    expect(id2).toBe(id1);
  });

  // -------------------------------------------------------------------------
  // MESSAGING TESTS
  // -------------------------------------------------------------------------

  it("Test 9: Unrelated worker cannot create conversation for a job without application (403)", async () => {
    const res = await request(app)
      .post("/api/v1/messages/conversations")
      .set("Authorization", `Bearer mock_token_${UNRELATED_WORKER_AUTH}`)
      .send({ workOpportunityId: testJobId });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/valid application or shift assignment is required/i);
  });

  it("Test 10: Worker with application successfully creates conversation (POST /conversations)", async () => {
    const res = await request(app)
      .post("/api/v1/messages/conversations")
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
      .send({ workOpportunityId: testJobId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.workOpportunityId).toBe(testJobId);
    expect(res.body.data.workerUserId).toBe(workerUserId);
    expect(res.body.data.providerUserId).toBe(providerUserId);

    testConversationId = res.body.data.id;
  });

  it("Test 11: Authorized participants can fetch conversation list and conversation by ID", async () => {
    // Worker lists conversations
    const listRes = await request(app)
      .get("/api/v1/messages/conversations")
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.some((c: any) => c.id === testConversationId)).toBe(true);

    // Provider views specific conversation
    const detailRes = await request(app)
      .get(`/api/v1/messages/conversations/${testConversationId}`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.id).toBe(testConversationId);
  });

  it("Test 12: Unrelated user cannot read conversation or messages (403)", async () => {
    const convRes = await request(app)
      .get(`/api/v1/messages/conversations/${testConversationId}`)
      .set("Authorization", `Bearer mock_token_${UNRELATED_WORKER_AUTH}`);

    expect(convRes.status).toBe(403);
    expect(convRes.body.error.message).toMatch(/not authorized to access this conversation/i);

    const msgRes = await request(app)
      .get(`/api/v1/messages/conversations/${testConversationId}/messages`)
      .set("Authorization", `Bearer mock_token_${UNRELATED_WORKER_AUTH}`);

    expect(msgRes.status).toBe(403);
  });

  it("Test 13: Malformed conversation UUID is rejected cleanly (400 Validation Error)", async () => {
    const res = await request(app)
      .get("/api/v1/messages/conversations/not-a-valid-uuid")
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body.error)).toMatch(/invalid conversation id format|validation failed/i);
  });

  it("Test 14: Non-existent conversation UUID returns 404", async () => {
    const res = await request(app)
      .get("/api/v1/messages/conversations/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`);

    expect(res.status).toBe(404);
  });

  it("Test 15: Empty message rejected (400 Validation Error)", async () => {
    const res = await request(app)
      .post(`/api/v1/messages/conversations/${testConversationId}/messages`)
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
      .send({ content: "   " });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body.error)).toMatch(/message content cannot be empty|validation failed/i);
  });

  it("Test 16: Oversized message (>2000 chars) rejected (400 Validation Error)", async () => {
    const oversizedContent = "A".repeat(2001);
    const res = await request(app)
      .post(`/api/v1/messages/conversations/${testConversationId}/messages`)
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
      .send({ content: oversizedContent });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body.error)).toMatch(/2000 characters|validation failed/i);
  });

  it("Test 17: Message recipient cannot be spoofed; sending delivers to counterparty and notifies", async () => {
    // Worker sends message to Provider
    const sendRes = await request(app)
      .post(`/api/v1/messages/conversations/${testConversationId}/messages`)
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
      .send({ content: "Hello, I am ready for the inventory stock count shift!" });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body.success).toBe(true);
    expect(sendRes.body.data.senderId).toBe(workerUserId);
    expect(sendRes.body.data.recipientId).toBe(providerUserId); // Authoritatively set to provider!

    // Provider reads messages
    const readRes = await request(app)
      .get(`/api/v1/messages/conversations/${testConversationId}/messages`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`);

    expect(readRes.status).toBe(200);
    expect(readRes.body.data.length).toBeGreaterThanOrEqual(1);
    const lastMsg = readRes.body.data[readRes.body.data.length - 1];
    expect(lastMsg.content).toBe("Hello, I am ready for the inventory stock count shift!");

    // Verify in-app notification was generated for Provider
    const notifRes = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`);

    const msgNotif = notifRes.body.data.items.find((n: any) => n.type === "NEW_MESSAGE");
    expect(msgNotif).toBeTruthy();
    expect(msgNotif.recipientId).toBe(providerUserId);
  });

  it("Test 18: Assisting agent with ACTIVE relationship can view worker's conversation", async () => {
    // Establish ACTIVE relationship between agent and worker
    await query(
      `INSERT INTO agent_worker_relationships (
        agent_id, worker_id, status, accepted_at, created_at, updated_at
       ) VALUES ($1, $2, 'ACTIVE', NOW(), NOW(), NOW())
       ON CONFLICT (agent_id, worker_id) DO UPDATE SET status = 'ACTIVE'`,
      [agentProfileId, workerProfileId]
    );

    // Assisting agent reads the conversation
    const res = await request(app)
      .get(`/api/v1/messages/conversations/${testConversationId}`)
      .set("Authorization", `Bearer mock_token_${AGENT_AUTH}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(testConversationId);
  });

  it("Test 19: Revoked agent cannot access the worker's conversation (403)", async () => {
    // Revoke relationship
    await query(
      `UPDATE agent_worker_relationships
       SET status = 'REVOKED', updated_at = NOW()
       WHERE agent_id = $1 AND worker_id = $2`,
      [agentProfileId, workerProfileId]
    );

    const res = await request(app)
      .get(`/api/v1/messages/conversations/${testConversationId}`)
      .set("Authorization", `Bearer mock_token_${AGENT_AUTH}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/not authorized to access this conversation/i);
  });
});
