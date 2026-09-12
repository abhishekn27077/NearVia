import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { apiRouter } from "../src/routes";
import { errorHandler, notFoundHandler } from "../src/middleware";
import { query } from "../src/db";
import { notificationsService, NotificationType } from "../src/modules/notifications/service";
import { messagesService } from "../src/modules/messages/service";
import { reviewsService } from "../src/modules/reviews/service";
import { applicationsService } from "../src/modules/applications/service";

describe("NEARVIA Prompt 11: Notifications & Messaging Hardening Test Suite", () => {
  let app: Express;

  // Test identities
  const PROVIDER_AUTH = "p11_notif_provider";
  const WORKER_AUTH = "p11_notif_worker";
  const UNRELATED_WORKER_AUTH = "p11_notif_unrelated";
  const AGENT_AUTH = "p11_notif_agent";
  const ADMIN_AUTH = "p11_notif_admin";

  let providerUserId: string;
  let providerProfileId: string;

  let workerUserId: string;
  let workerProfileId: string;

  let unrelatedWorkerUserId: string;
  let unrelatedWorkerProfileId: string;

  let agentUserId: string;
  let agentProfileId: string;

  let adminUserId: string;

  let testCategoryId: string;
  let testJobId: string;
  let testApplicationId: string;
  let testAssignmentId: string;
  let testConversationId: string;

  const LOCATION_LNG = 77.5946;
  const LOCATION_LAT = 12.9716;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/v1", apiRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Clean up any stale data
    const cleanup = async () => {
      await query(
        `DELETE FROM messages WHERE conversation_id IN (
          SELECT c.id FROM conversations c 
          WHERE c.worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE u.auth_id LIKE 'p11_%')
        )`
      );
      await query(
        `DELETE FROM conversations WHERE worker_id IN (
          SELECT wp.id FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE u.auth_id LIKE 'p11_%'
        )`
      );
      await query(
        `DELETE FROM agent_worker_relationships WHERE agent_id IN (
          SELECT ap.id FROM agent_profiles ap JOIN users u ON ap.user_id = u.id WHERE u.auth_id LIKE 'p11_%'
        ) OR worker_id IN (
          SELECT wp.id FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE u.auth_id LIKE 'p11_%'
        )`
      );
      await query(
        `DELETE FROM reviews WHERE reviewer_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')
         OR reviewee_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`
      );
      await query(
        `DELETE FROM payment_records WHERE assignment_id IN (
          SELECT id FROM assignments WHERE work_opportunity_id IN (
            SELECT id FROM work_opportunities WHERE title LIKE '%[P11_TEST]%'
          )
        )`
      );
      await query(
        `DELETE FROM assignments WHERE work_opportunity_id IN (
          SELECT id FROM work_opportunities WHERE title LIKE '%[P11_TEST]%'
        )`
      );
      await query(
        `DELETE FROM applications WHERE work_opportunity_id IN (
          SELECT id FROM work_opportunities WHERE title LIKE '%[P11_TEST]%'
        )`
      );
      await query(
        `DELETE FROM work_opportunities WHERE title LIKE '%[P11_TEST]%'`
      );
      await query(
        `DELETE FROM notifications WHERE recipient_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`
      );
      await query(
        `DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`
      );
      await query(
        `DELETE FROM agent_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`
      );
      await query(
        `DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`
      );
      await query(`DELETE FROM users WHERE auth_id LIKE 'p11_%'`);
    };

    await cleanup();

    // 1. Seed Category
    const catRes = await query<{ id: string }>(
      `INSERT INTO categories (name, slug, description, is_active)
       VALUES ('P11 Notifications Category [P11_TEST]', 'notif-p11', 'Category for P11 testing', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`
    );
    testCategoryId = catRes.rows[0].id;

    // 2. Seed Provider
    const provUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919817000001', 'Provider P11 [P11_TEST]', 'prov_p11@nearvia.test', 'PROVIDER', TRUE)
       RETURNING id`,
      [PROVIDER_AUTH]
    );
    providerUserId = provUserRes.rows[0].id;

    const provProfRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, description, location, address_approximate)
       VALUES ($1, 'P11 Logistics', 'Enterprise Employer', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Koramangala, Bengaluru')
       RETURNING id`,
      [providerUserId, LOCATION_LNG, LOCATION_LAT]
    );
    providerProfileId = provProfRes.rows[0].id;

    // 3. Seed Worker
    const workerUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919817000002', 'Worker P11 [P11_TEST]', 'worker_p11@nearvia.test', 'WORKER', TRUE)
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

    // 4. Seed Unrelated Worker
    const unrelatedUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919817000003', 'Unrelated P11 [P11_TEST]', 'unrelated_p11@nearvia.test', 'WORKER', TRUE)
       RETURNING id`,
      [UNRELATED_WORKER_AUTH]
    );
    unrelatedWorkerUserId = unrelatedUserRes.rows[0].id;

    const unrelatedProfRes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, location, address_approximate, is_available_now)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Indiranagar, Bengaluru', TRUE)
       RETURNING id`,
      [unrelatedWorkerUserId, LOCATION_LNG, LOCATION_LAT]
    );
    unrelatedWorkerProfileId = unrelatedProfRes.rows[0].id;

    // 5. Seed Agent
    const agentUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919817000004', 'Agent P11 [P11_TEST]', 'agent_p11@nearvia.test', 'AGENT', TRUE)
       RETURNING id`,
      [AGENT_AUTH]
    );
    agentUserId = agentUserRes.rows[0].id;

    const agentProfRes = await query<{ id: string }>(
      `INSERT INTO agent_profiles (user_id, assigned_area, description)
       VALUES ($1, 'Koramangala, Bengaluru', 'P11 Community Center')
       RETURNING id`,
      [agentUserId]
    );
    agentProfileId = agentProfRes.rows[0].id;

    // 6. Seed Admin
    const adminUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919817000005', 'Admin P11 [P11_TEST]', 'admin_p11@nearvia.test', 'ADMIN', TRUE)
       RETURNING id`,
      [ADMIN_AUTH]
    );
    adminUserId = adminUserRes.rows[0].id;

    // 7. Seed Job
    const jobRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
        provider_id, category_id, title, description, work_type, urgency, status,
        workers_needed, workers_assigned, location, address_approximate,
        work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
        $1, $2, 'Package Delivery Assistant [P11_TEST]', 'Assist with route sorting',
        'TASK', 'NORMAL', 'PUBLISHED', 2, 1,
        ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Koramangala, Bengaluru',
        CURRENT_DATE + INTERVAL '1 day', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 4 hours',
        4, 750.00, 'HOURLY'
       ) RETURNING id`,
      [providerProfileId, testCategoryId, LOCATION_LNG, LOCATION_LAT]
    );
    testJobId = jobRes.rows[0].id;

    // 8. Seed Application for worker
    const appRes = await query<{ id: string }>(
      `INSERT INTO applications (
        work_opportunity_id, worker_id, status, proposed_wage, created_at, updated_at
       ) VALUES ($1, $2, 'PENDING', 750.00, NOW(), NOW())
       RETURNING id`,
      [testJobId, workerProfileId]
    );
    testApplicationId = appRes.rows[0].id;

    // 9. Seed Assignment for completed work and review test
    const asgRes = await query<{ id: string }>(
      `INSERT INTO assignments (
        work_opportunity_id, worker_id, provider_id, status, agreed_wage,
        job_pin, created_at, updated_at
       ) VALUES ($1, $2, $3, 'COMPLETED', 750.00, '1234', NOW(), NOW())
       RETURNING id`,
      [testJobId, workerProfileId, providerProfileId]
    );
    testAssignmentId = asgRes.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup test artifacts
    await query(
      `DELETE FROM messages WHERE conversation_id IN (
        SELECT c.id FROM conversations c 
        WHERE c.worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE u.auth_id LIKE 'p11_%')
      )`
    );
    await query(
      `DELETE FROM conversations WHERE worker_id IN (
        SELECT wp.id FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE u.auth_id LIKE 'p11_%'
      )`
    );
    await query(
      `DELETE FROM agent_worker_relationships WHERE agent_id IN (
        SELECT ap.id FROM agent_profiles ap JOIN users u ON ap.user_id = u.id WHERE u.auth_id LIKE 'p11_%'
      ) OR worker_id IN (
        SELECT wp.id FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE u.auth_id LIKE 'p11_%'
      )`
    );
    await query(
      `DELETE FROM reviews WHERE reviewer_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')
       OR reviewee_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`
    );
    await query(
      `DELETE FROM assignments WHERE work_opportunity_id IN (
        SELECT id FROM work_opportunities WHERE title LIKE '%[P11_TEST]%'
      )`
    );
    await query(
      `DELETE FROM applications WHERE work_opportunity_id IN (
        SELECT id FROM work_opportunities WHERE title LIKE '%[P11_TEST]%'
      )`
    );
    await query(
      `DELETE FROM work_opportunities WHERE title LIKE '%[P11_TEST]%'`
    );
    await query(
      `DELETE FROM notifications WHERE recipient_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`
    );
    await query(
      `DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`
    );
    await query(
      `DELETE FROM agent_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`
    );
    await query(
      `DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p11_%')`
    );
    await query(`DELETE FROM users WHERE auth_id LIKE 'p11_%'`);
  });

  // =========================================================================
  // 1. IN-APP NOTIFICATIONS & PRIVACY HARDENING
  // =========================================================================

  it("1.1: Notifications access enforces strict authentication and recipient isolation", async () => {
    // Unauthenticated
    const unauthRes = await request(app).get("/api/v1/notifications");
    expect(unauthRes.status).toBe(401);

    // Create test notification for Worker
    const notifId = await notificationsService.createNotification(
      workerUserId,
      NotificationType.APPLICATION_ACCEPTED,
      "Hired for Delivery",
      "You were selected for the shift.",
      { workOpportunityId: testJobId }
    );
    expect(notifId).toBeTruthy();

    // Provider attempts to mark worker's notification as read (IDOR attempt)
    const idorRes = await request(app)
      .patch(`/api/v1/notifications/${notifId}/read`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`);

    expect(idorRes.status).toBe(403);
    expect(idorRes.body.error.message).toMatch(/cannot mark another user's notification/i);

    // Worker marks own notification as read
    const ownRes = await request(app)
      .patch(`/api/v1/notifications/${notifId}/read`)
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`);

    expect(ownRes.status).toBe(200);
    expect(ownRes.body.data.updated).toBe(true);
  });

  it("1.2: Sensitive data is automatically scrubbed from notification payloads", async () => {
    const sensitiveNotifId = await notificationsService.createNotification(
      workerUserId,
      NotificationType.PAYMENT_RELEASED,
      "Payment Released with Secret Token: Bearer secret_jwt_token_12345",
      "Your wages have been sent to your account.",
      {
        workOpportunityId: testJobId,
        password: "super_secret_password",
        token: "jwt_token_abcdef123",
        pin: "4321",
        bankAccount: "1234567890",
        fullAddress: "Flat 402, Private Villa, Secret Lane",
        safeMeta: "verified_settlement",
      }
    );

    expect(sensitiveNotifId).toBeTruthy();

    // Fetch from database to verify stored content
    const dbRes = await query<{ title: string; data: any }>(
      "SELECT title, data FROM notifications WHERE id = $1",
      [sensitiveNotifId]
    );

    const notif = dbRes.rows[0];
    expect(notif).toBeTruthy();
    // Verify token redaction in title
    expect(notif.title).toMatch(/\[REDACTED(?:_TOKEN)?\]/);
    expect(notif.title).not.toContain("secret_jwt_token_12345");

    // Verify sensitive keys stripped from json data
    expect(notif.data.password).toBeUndefined();
    expect(notif.data.token).toBeUndefined();
    expect(notif.data.pin).toBeUndefined();
    expect(notif.data.bankAccount).toBeUndefined();
    expect(notif.data.fullAddress).toBeUndefined();
    expect(notif.data.safeMeta).toBe("verified_settlement");
    expect(notif.data.workOpportunityId).toBe(testJobId);
  });

  it("1.3: Event deduplication and sliding window suppress duplicate notifications", async () => {
    // 1. Explicit eventId deduplication
    const eventId = "unique_event_p11_001";
    const idA = await notificationsService.createNotification(
      providerUserId,
      NotificationType.NEW_APPLICATION,
      "Applicant Alert",
      "A worker applied for shift.",
      { eventId, workOpportunityId: testJobId }
    );

    const idB = await notificationsService.createNotification(
      providerUserId,
      NotificationType.NEW_APPLICATION,
      "Applicant Alert",
      "A worker applied for shift.",
      { eventId, workOpportunityId: testJobId }
    );

    expect(idB).toBe(idA); // exact same ID returned, no duplicate inserted

    // 2. Sliding window deduplication on workOpportunityId
    const idC = await notificationsService.createNotification(
      providerUserId,
      NotificationType.WORKER_CONFIRMED,
      "Shift Confirmed",
      "Worker confirmed attendance.",
      { workOpportunityId: testJobId }
    );

    const idD = await notificationsService.createNotification(
      providerUserId,
      NotificationType.WORKER_CONFIRMED,
      "Shift Confirmed",
      "Worker confirmed attendance.",
      { workOpportunityId: testJobId }
    );

    expect(idD).toBe(idC); // duplicate suppressed within 2-minute window
  });

  it("1.4: Application withdrawal triggers APPLICATION_WITHDRAWN notification to provider", async () => {
    // Worker withdraws their application
    await applicationsService.withdrawApplication(
      workerUserId,
      testApplicationId,
      "Change in schedule"
    );

    // Verify provider received notification
    const provNotifs = await notificationsService.getMyNotifications(providerUserId);
    const withdrawnNotif = provNotifs.items.find(
      (n) => n.type === NotificationType.APPLICATION_WITHDRAWN
    );

    expect(withdrawnNotif).toBeTruthy();
    expect(withdrawnNotif?.title).toContain("Applicant Withdrawn");
    expect(withdrawnNotif?.data?.applicationId).toBe(testApplicationId);
  });

  it("1.5: Review creation triggers NEW_REVIEW notification to reviewee", async () => {
    // Provider submits review for worker
    await reviewsService.submitReview(testAssignmentId, providerUserId, {
      rating: 5,
      comments: "Excellent punctuality and work ethic!",
    });

    // Verify worker received notification
    const workerNotifs = await notificationsService.getMyNotifications(workerUserId);
    const reviewNotif = workerNotifs.items.find(
      (n) => n.type === NotificationType.NEW_REVIEW
    );

    expect(reviewNotif).toBeTruthy();
    expect(reviewNotif?.title).toContain("New Rating & Review Received");
    expect(reviewNotif?.data?.assignmentId).toBe(testAssignmentId);
    expect(reviewNotif?.data?.rating).toBe(5);
  });

  // =========================================================================
  // 2. MESSAGING LEGITIMACY & SECURITY HARDENING
  // =========================================================================

  it("2.1: Arbitrary user cannot message a provider without application or assignment", async () => {
    const res = await request(app)
      .post("/api/v1/messages/conversations")
      .set("Authorization", `Bearer mock_token_${UNRELATED_WORKER_AUTH}`)
      .send({ workOpportunityId: testJobId });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/valid application or shift assignment is required/i);
  });

  it("2.2: Legitimate Worker <-> Provider conversation can be initiated", async () => {
    const res = await request(app)
      .post("/api/v1/messages/conversations")
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
      .send({ workOpportunityId: testJobId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.workerUserId).toBe(workerUserId);
    expect(res.body.data.providerUserId).toBe(providerUserId);

    testConversationId = res.body.data.id;
  });

  it("2.3: Direct Agent <-> Worker conversation requires ACTIVE relationship", async () => {
    // Attempt before relationship is created -> 403
    const unlinkedRes = await request(app)
      .post("/api/v1/messages/conversations")
      .set("Authorization", `Bearer mock_token_${AGENT_AUTH}`)
      .send({ workerUserId });

    expect(unlinkedRes.status).toBe(403);
    expect(unlinkedRes.body.error.message).toMatch(/active agent-worker relationship is required/i);

    // Establish ACTIVE relationship
    await query(
      `INSERT INTO agent_worker_relationships (agent_id, worker_id, status, accepted_at)
       VALUES ($1, $2, 'ACTIVE', NOW())
       ON CONFLICT (agent_id, worker_id) DO UPDATE SET status = 'ACTIVE'`,
      [agentProfileId, workerProfileId]
    );

    // Agent now initiates direct assistance conversation
    const directRes = await request(app)
      .post("/api/v1/messages/conversations")
      .set("Authorization", `Bearer mock_token_${AGENT_AUTH}`)
      .send({ workerUserId });

    expect(directRes.status).toBe(200);
    expect(directRes.body.data.agentUserId).toBe(agentUserId);
    expect(directRes.body.data.workerUserId).toBe(workerUserId);
    expect(directRes.body.data.opportunityTitle).toContain("Direct");
  });

  it("2.4: Revoked agent cannot initiate or access conversations", async () => {
    // Revoke relationship
    await query(
      `UPDATE agent_worker_relationships SET status = 'REVOKED' WHERE agent_id = $1 AND worker_id = $2`,
      [agentProfileId, workerProfileId]
    );

    const revokedRes = await request(app)
      .post("/api/v1/messages/conversations")
      .set("Authorization", `Bearer mock_token_${AGENT_AUTH}`)
      .send({ workerUserId });

    expect(revokedRes.status).toBe(403);
  });

  it("2.5: Sender identity is strictly derived from session; senderName cannot be spoofed", async () => {
    // Worker sends message to Provider
    const sendRes = await request(app)
      .post(`/api/v1/messages/conversations/${testConversationId}/messages`)
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
      .send({ content: "Hi, I have completed the shift and submitted attendance." });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body.data.senderId).toBe(workerUserId); // Derived from auth token!
    expect(sendRes.body.data.senderName).toBe("Worker P11 [P11_TEST]"); // Authoritative name!
    expect(sendRes.body.data.recipientId).toBe(providerUserId);
  });

  it("2.6: Duplicate message spam within 3 seconds is safely suppressed", async () => {
    const text = "Checking in regarding the payment confirmation.";

    const msg1 = await messagesService.sendMessage(workerUserId, testConversationId, text);
    expect(msg1.id).toBeTruthy();

    // Immediate duplicate send
    const msg2 = await messagesService.sendMessage(workerUserId, testConversationId, text);
    expect(msg2.id).toBe(msg1.id); // Same message returned, no duplicate created!
  });

  it("2.7: Private conversations are hidden from non-participants and admins", async () => {
    // Unrelated worker cannot view conversation or messages
    const unrelConv = await request(app)
      .get(`/api/v1/messages/conversations/${testConversationId}`)
      .set("Authorization", `Bearer mock_token_${UNRELATED_WORKER_AUTH}`);
    expect(unrelConv.status).toBe(403);

    const unrelMsgs = await request(app)
      .get(`/api/v1/messages/conversations/${testConversationId}/messages`)
      .set("Authorization", `Bearer mock_token_${UNRELATED_WORKER_AUTH}`);
    expect(unrelMsgs.status).toBe(403);

    // Admin cannot read private conversations without a moderation scope
    const adminConv = await request(app)
      .get(`/api/v1/messages/conversations/${testConversationId}`)
      .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);
    expect(adminConv.status).toBe(403);
  });

  it("2.8: Unread counts accurately increment and clear upon reading messages", async () => {
    // Send a message from Provider to Worker
    await messagesService.sendMessage(
      providerUserId,
      testConversationId,
      "Thanks, I have reviewed your shift signoff!"
    );

    // Worker checks conversations list -> unreadCount should be >= 1
    const listRes = await request(app)
      .get("/api/v1/messages/conversations")
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`);

    const myConv = listRes.body.data.find((c: any) => c.id === testConversationId);
    expect(myConv).toBeTruthy();
    expect(myConv.unreadCount).toBeGreaterThanOrEqual(1);

    // Worker fetches messages (which marks them as read)
    const readMsgsRes = await request(app)
      .get(`/api/v1/messages/conversations/${testConversationId}/messages`)
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`);

    expect(readMsgsRes.status).toBe(200);

    // Check conversation list again -> unreadCount should now be 0
    const listAfterRes = await request(app)
      .get("/api/v1/messages/conversations")
      .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`);

    const myConvAfter = listAfterRes.body.data.find((c: any) => c.id === testConversationId);
    expect(myConvAfter.unreadCount).toBe(0);
  });
});
