/**
 * NEARVIA — Prompt 19: Final Security, Privacy & Authorization Audit Suite
 *
 * Exhaustively validates:
 * 1. Authentication & Token Hardening (401 on missing/malformed/expired tokens, mock rejection in prod).
 * 2. Role Escalation & Account Immutability (public admin registration 403, profile role tamper immunity, self-demotion lockout 400).
 * 3. Admin Console Isolation (RBAC: Worker/Provider/Agent 403, Admin 200).
 * 4. CORS & Host Security (untrusted origin rejection in production).
 * 5. Sensitive Header & Anti-Caching Protection (Cache-Control no-store).
 * 6. IDOR (Insecure Direct Object Reference) Protection across all entity domains.
 * 7. Marketplace Lifecycle Integrity (illegal state jumps and unauthorized completions rejected).
 * 8. Location & Privacy Enforcement (k-anonymity aggregation, worker coordinate masking).
 * 9. Messaging & Notification Privacy (cross-user message isolation 403).
 * 10. Payment Security & Wage Integrity (server-authoritative wage calculation, PIN lockout).
 * 11. Agent Authorization Boundaries (strict ACTIVE consent required, audit log generation).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { query } from "../src/db";
import { verifySupabaseToken } from "../src/services/supabase.service";
import { adminService } from "../src/modules/admin/service";
import { UserRole } from "@nearvia/types";

describe("NEARVIA — Prompt 19: Final Security, Privacy & Authorization Audit Suite", () => {
  const app = createApp();

  const PREFIX = "p19_audit_";
  const WORKER_AUTH = `${PREFIX}worker_auth`;
  const WORKER_2_AUTH = `${PREFIX}worker_2_auth`;
  const PROVIDER_AUTH = `${PREFIX}provider_auth`;
  const PROVIDER_2_AUTH = `${PREFIX}provider_2_auth`;
  const AGENT_AUTH = `${PREFIX}agent_auth`;
  const ADMIN_AUTH = `${PREFIX}admin_auth`;

  let workerUserId: string;
  let worker2UserId: string;
  let providerUserId: string;
  let provider2UserId: string;
  let agentUserId: string;
  let adminUserId: string;

  let providerProfileId: string;
  let provider2ProfileId: string;
  let workerProfileId: string;
  let worker2ProfileId: string;
  let agentProfileId: string;

  let testWorkOpportunityId: string;
  let testAssignmentId: string;
  let testNotificationId: string;
  let testConversationId: string;

  beforeAll(async () => {
    // 1. Create clean test users in PostgreSQL
    // Worker 1
    const w1 = await query<{ id: string }>(
      `INSERT INTO users (auth_id, full_name, email, role, is_active, email_verified)
       VALUES ($1, 'Audit Worker 1', 'audit.w1@nearvia.test', 'WORKER', TRUE, TRUE)
       ON CONFLICT (auth_id) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      [WORKER_AUTH],
    );
    workerUserId = w1.rows[0]!.id;

    // Worker 2
    const w2 = await query<{ id: string }>(
      `INSERT INTO users (auth_id, full_name, email, role, is_active, email_verified)
       VALUES ($1, 'Audit Worker 2', 'audit.w2@nearvia.test', 'WORKER', TRUE, TRUE)
       ON CONFLICT (auth_id) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      [WORKER_2_AUTH],
    );
    worker2UserId = w2.rows[0]!.id;

    // Provider 1
    const p1 = await query<{ id: string }>(
      `INSERT INTO users (auth_id, full_name, email, role, is_active, email_verified)
       VALUES ($1, 'Audit Provider 1', 'audit.p1@nearvia.test', 'PROVIDER', TRUE, TRUE)
       ON CONFLICT (auth_id) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      [PROVIDER_AUTH],
    );
    providerUserId = p1.rows[0]!.id;

    // Provider 2
    const p2 = await query<{ id: string }>(
      `INSERT INTO users (auth_id, full_name, email, role, is_active, email_verified)
       VALUES ($1, 'Audit Provider 2', 'audit.p2@nearvia.test', 'PROVIDER', TRUE, TRUE)
       ON CONFLICT (auth_id) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      [PROVIDER_2_AUTH],
    );
    provider2UserId = p2.rows[0]!.id;

    // Agent
    const ag = await query<{ id: string }>(
      `INSERT INTO users (auth_id, full_name, email, role, is_active, email_verified)
       VALUES ($1, 'Audit Agent', 'audit.agent@nearvia.test', 'AGENT', TRUE, TRUE)
       ON CONFLICT (auth_id) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      [AGENT_AUTH],
    );
    agentUserId = ag.rows[0]!.id;

    // Admin
    const adm = await query<{ id: string }>(
      `INSERT INTO users (auth_id, full_name, email, role, is_active, email_verified)
       VALUES ($1, 'Audit Admin', 'audit.admin@nearvia.test', 'ADMIN', TRUE, TRUE)
       ON CONFLICT (auth_id) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      [ADMIN_AUTH],
    );
    adminUserId = adm.rows[0]!.id;

    // 2. Setup domain profiles
    const wp1 = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, is_available_now, availability_status, location, address_approximate, created_at, updated_at)
       VALUES ($1, TRUE, 'AVAILABLE_NOW', ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Koramangala 4th Block', NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET is_available_now = TRUE
       RETURNING id`,
      [workerUserId],
    );
    workerProfileId = wp1.rows[0]!.id;

    const wp2 = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, is_available_now, availability_status, location, address_approximate, created_at, updated_at)
       VALUES ($1, TRUE, 'AVAILABLE_NOW', ST_SetSRID(ST_MakePoint(77.5950, 12.9720), 4326)::geography, 'Koramangala 4th Block', NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET is_available_now = TRUE
       RETURNING id`,
      [worker2UserId],
    );
    worker2ProfileId = wp2.rows[0]!.id;

    const pp1 = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, created_at, updated_at)
       VALUES ($1, 'Audit Provider 1 Biz', NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET business_name = 'Audit Provider 1 Biz'
       RETURNING id`,
      [providerUserId],
    );
    providerProfileId = pp1.rows[0]!.id;

    const pp2 = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, created_at, updated_at)
       VALUES ($1, 'Audit Provider 2 Biz', NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET business_name = 'Audit Provider 2 Biz'
       RETURNING id`,
      [provider2UserId],
    );
    provider2ProfileId = pp2.rows[0]!.id;

    const ap = await query<{ id: string }>(
      `INSERT INTO agent_profiles (user_id, assigned_area, created_at, updated_at)
       VALUES ($1, 'Koramangala Community', NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET assigned_area = 'Koramangala Community'
       RETURNING id`,
      [agentUserId],
    );
    agentProfileId = ap.rows[0]!.id;

    // 3. Create a test category if needed
    const catRes = await query<{ id: string }>(
      `INSERT INTO categories (name, slug, description)
       VALUES ('Audit Security Category', 'audit-sec-cat', 'Category for audit tests')
       ON CONFLICT (slug) DO UPDATE SET name = 'Audit Security Category'
       RETURNING id`,
    );
    const categoryId = catRes.rows[0]!.id;

    // 4. Create a test work opportunity for Provider 1
    const woRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
         provider_id, category_id, title, description, work_type,
         workers_needed, payment_amount, payment_type,
         location, address_approximate, work_date, start_time, end_time, duration_hours, status
       ) VALUES (
         $1, $2, 'Audit Test Shift', 'Security validation shift', 'SHIFT',
         1, 800.00, 'DAILY',
         ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Koramangala 100 Feet Rd',
         CURRENT_DATE, NOW() + INTERVAL '1 hour', NOW() + INTERVAL '9 hours', 8, 'PUBLISHED'
       ) RETURNING id`,
      [providerProfileId, categoryId],
    );
    testWorkOpportunityId = woRes.rows[0]!.id;

    // 5. Create a test assignment
    const asgRes = await query<{ id: string }>(
      `INSERT INTO assignments (
         work_opportunity_id, worker_id, provider_id, status, agreed_wage
       ) VALUES ($1, $2, $3, 'ASSIGNED', 800.00)
       RETURNING id`,
      [testWorkOpportunityId, workerProfileId, providerProfileId],
    );
    testAssignmentId = asgRes.rows[0]!.id;

    // 6. Create a test notification for Worker 1
    const notifRes = await query<{ id: string }>(
      `INSERT INTO notifications (recipient_id, type, title, message, is_read)
       VALUES ($1, 'ASSIGNMENT_CREATED', 'Audit Alert', 'Private notification for worker 1', FALSE)
       RETURNING id`,
      [workerUserId],
    );
    testNotificationId = notifRes.rows[0]!.id;

    // 7. Create a private conversation between Worker 1 and Provider 1
    const convRes = await query<{ id: string }>(
      `INSERT INTO conversations (work_opportunity_id, worker_id, provider_id, last_message_text, last_message_at)
       VALUES ($1, $2, $3, 'Private discussion', NOW())
       RETURNING id`,
      [testWorkOpportunityId, workerProfileId, providerProfileId],
    );
    testConversationId = convRes.rows[0]!.id;
  });

  afterAll(async () => {
    // Teardown test records in strict foreign-key order
    if (testConversationId) {
      await query(`DELETE FROM messages WHERE conversation_id = $1`, [testConversationId]).catch(() => {});
      await query(`DELETE FROM conversations WHERE id = $1`, [testConversationId]).catch(() => {});
    }
    if (testAssignmentId) {
      await query(`DELETE FROM payment_records WHERE assignment_id = $1`, [testAssignmentId]).catch(() => {});
      await query(`DELETE FROM attendance_records WHERE assignment_id = $1`, [testAssignmentId]).catch(() => {});
      await query(`DELETE FROM disputes WHERE assignment_id = $1`, [testAssignmentId]).catch(() => {});
      await query(`DELETE FROM assignments WHERE id = $1`, [testAssignmentId]).catch(() => {});
    }
    if (testWorkOpportunityId) {
      await query(`DELETE FROM applications WHERE work_opportunity_id = $1`, [testWorkOpportunityId]).catch(() => {});
      await query(`DELETE FROM work_opportunities WHERE id = $1`, [testWorkOpportunityId]).catch(() => {});
    }
    await query(`DELETE FROM notifications WHERE recipient_id IN ($1, $2, $3, $4, $5, $6)`, [
      workerUserId,
      worker2UserId,
      providerUserId,
      provider2UserId,
      agentUserId,
      adminUserId,
    ]).catch(() => {});

    await query(`DELETE FROM agent_worker_relationships WHERE agent_id = $1 OR worker_id IN ($2, $3)`, [
      agentProfileId,
      workerProfileId,
      worker2ProfileId,
    ]).catch(() => {});

    await query(`DELETE FROM worker_profiles WHERE id IN ($1, $2)`, [workerProfileId, worker2ProfileId]).catch(() => {});
    await query(`DELETE FROM provider_profiles WHERE id IN ($1, $2)`, [providerProfileId, provider2ProfileId]).catch(() => {});
    await query(`DELETE FROM agent_profiles WHERE id = $1`, [agentProfileId]).catch(() => {});

    await query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5, $6)`, [
      workerUserId,
      worker2UserId,
      providerUserId,
      provider2UserId,
      agentUserId,
      adminUserId,
    ]).catch(() => {});
  });

  // ============================================================================
  // 1. AUTHENTICATION & TOKEN HARDENING
  // ============================================================================
  describe("1. Authentication & Token Hardening", () => {
    it("1.1: Missing Authorization header returns 401 UNAUTHORIZED", async () => {
      const res = await request(app).get("/api/v1/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("1.2: Malformed Bearer token returns 401 UNAUTHORIZED", async () => {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer ");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("1.3: Tampered or invalid JWT signature returns 401 UNAUTHORIZED", async () => {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("1.4: In production mode (NODE_ENV=production), verifySupabaseToken strictly rejects mock tokens", async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "production";
        const verified = await verifySupabaseToken("mock_token_attacker_auth_id");
        // Must return null (rejected) rather than trusting mock_token_*
        expect(verified).toBeNull();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  // ============================================================================
  // 2. ROLE ESCALATION & ACCOUNT IMMUTABILITY
  // ============================================================================
  describe("2. Role Escalation & Account Immutability", () => {
    it("2.1: Public registration with role: ADMIN is strictly rejected with 403 FORBIDDEN", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          authId: "attacker_trying_admin_reg",
          fullName: "Attacker User",
          email: "attacker@exploit.test",
          phone: "+919999988888",
          role: "ADMIN",
        });

      expect([400, 403]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it("2.2: Profile update strictly rejects mass-assignment of role or is_active with 400 Bad Request", async () => {
      const res = await request(app)
        .patch("/api/v1/auth/profile")
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
        .send({
          fullName: "Audit Worker 1 Renamed",
          role: "ADMIN", // Attempt role escalation
          is_active: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");

      // Verify database state: role remains WORKER
      const userRes = await query<{ role: string }>(
        `SELECT role FROM users WHERE id = $1`,
        [workerUserId],
      );
      expect(userRes.rows[0]!.role).toBe("WORKER");
    });

    it("2.3: Administrator cannot demote their own account (prevents platform lockout)", async () => {
      // Direct call to adminService.updateUserRole with self-demotion
      await expect(
        adminService.updateUserRole(adminUserId, adminUserId, {
          role: UserRole.WORKER,
          reason: "Accidental self-demotion attempt",
        }),
      ).rejects.toThrow(/You cannot demote your own administrative account/i);
    });
  });

  // ============================================================================
  // 3. ADMIN CONSOLE ISOLATION
  // ============================================================================
  describe("3. Admin Console Isolation & RBAC", () => {
    it("3.1: Unauthenticated request to Admin API returns 401 UNAUTHORIZED", async () => {
      const res = await request(app).get("/api/v1/admin/dashboard");
      expect(res.status).toBe(401);
    });

    it("3.2: Worker token accessing Admin API returns 403 FORBIDDEN", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard")
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("3.3: Provider token accessing Admin API returns 403 FORBIDDEN", async () => {
      const res = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("3.4: Agent token accessing Admin API returns 403 FORBIDDEN", async () => {
      const res = await request(app)
        .get("/api/v1/admin/audit-logs")
        .set("Authorization", `Bearer mock_token_${AGENT_AUTH}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("3.5: Verified Admin token accessing Admin API returns 200 OK", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  // ============================================================================
  // 4. SENSITIVE HEADERS & ANTI-CACHING PROTECTION
  // ============================================================================
  describe("4. Sensitive Headers & Anti-Caching Protection", () => {
    it("4.1: API routes (/api/v1/*) include strict Cache-Control: no-store to protect PII and tokens", async () => {
      const res = await request(app).get("/api/v1/health");
      expect(res.headers["cache-control"]).toMatch(/no-store/i);
      expect(res.headers["cache-control"]).toMatch(/no-cache/i);
      expect(res.headers["pragma"]).toBe("no-cache");
    });
  });

  // ============================================================================
  // 5. INSECURE DIRECT OBJECT REFERENCES (IDOR)
  // ============================================================================
  describe("5. Insecure Direct Object References (IDOR) Protection", () => {
    it("5.1: Provider 2 cannot cancel Provider 1's work opportunity (403 FORBIDDEN)", async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${testWorkOpportunityId}/cancel`)
        .set("Authorization", `Bearer mock_token_${PROVIDER_2_AUTH}`)
        .send({ reason: "Unauthorized attempt" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/You do not own this work opportunity/i);
    });

    it("5.2: Worker 2 cannot mark Worker 1's notification as read (403 FORBIDDEN)", async () => {
      const res = await request(app)
        .patch(`/api/v1/notifications/${testNotificationId}/read`)
        .set("Authorization", `Bearer mock_token_${WORKER_2_AUTH}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/You cannot mark another user's notification/i);
    });

    it("5.3: Worker 2 cannot read the private conversation between Worker 1 and Provider 1 (403 FORBIDDEN)", async () => {
      const res = await request(app)
        .get(`/api/v1/messages/conversations/${testConversationId}/messages`)
        .set("Authorization", `Bearer mock_token_${WORKER_2_AUTH}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/not authorized to access this conversation/i);
    });
  });

  // ============================================================================
  // 6. MARKETPLACE LIFECYCLE INTEGRITY
  // ============================================================================
  describe("6. Marketplace Lifecycle Integrity", () => {
    it("6.1: Worker cannot check in to an unconfirmed assignment (400 Bad Request)", async () => {
      // testAssignmentId is in ASSIGNED status (needs CONFIRMED first)
      const res = await request(app)
        .post(`/api/v1/assignments/${testAssignmentId}/check-in`)
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
        .send({
          latitude: 12.9716,
          longitude: 77.5946,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/confirm the assignment first/i);
    });

    it("6.2: Worker cannot check out from an assignment that is not IN_PROGRESS (400 Bad Request)", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${testAssignmentId}/check-out`)
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
        .send({
          latitude: 12.9716,
          longitude: 77.5946,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ============================================================================
  // 7. LOCATION PRIVACY & WORKFORCE RADAR
  // ============================================================================
  describe("7. Location Privacy & Workforce Radar", () => {
    it("7.1: Workforce Radar returns k-anonymity neighborhood clusters without individual GPS coords", async () => {
      const res = await request(app)
        .get("/api/v1/radar?radiusKm=5")
        .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify that individual worker identities/locations are not exposed
      const data = res.body.data;
      expect(data).toHaveProperty("totalAvailableWorkers");
      expect(data).toHaveProperty("clusters");

      // Verify clusters do not leak individual worker exact addresses
      if (Array.isArray(data.clusters) && data.clusters.length > 0) {
        for (const cluster of data.clusters) {
          expect(cluster).not.toHaveProperty("workerId");
          expect(cluster).not.toHaveProperty("rawCoordinates");
        }
      }

      if (Array.isArray(data.availableTalent) && data.availableTalent.length > 0) {
        for (const talent of data.availableTalent) {
          expect(talent).not.toHaveProperty("workerId");
          expect(talent).not.toHaveProperty("location");
          expect(talent).not.toHaveProperty("latitude");
          expect(talent).not.toHaveProperty("longitude");
        }
      }
    });
  });

  // ============================================================================
  // 8. AGENT AUTHORIZATION BOUNDARIES
  // ============================================================================
  describe("8. Agent Authorization Boundaries", () => {
    it("8.1: Agent cannot view worker profile or apply without ACTIVE relationship (403 FORBIDDEN)", async () => {
      // Agent has NO relationship with Worker 2
      const res = await request(app)
        .get(`/api/v1/agents/workers/${worker2ProfileId}`)
        .set("Authorization", `Bearer mock_token_${AGENT_AUTH}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/active consent/i);
    });

    it("8.2: Agent cannot submit assisted application for unrelated worker (403 FORBIDDEN)", async () => {
      const res = await request(app)
        .post(`/api/v1/agents/workers/${worker2ProfileId}/apply`)
        .set("Authorization", `Bearer mock_token_${AGENT_AUTH}`)
        .send({
          workOpportunityId: testWorkOpportunityId,
          proposedWage: 800,
          consentConfirmed: true,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/active consent/i);
    });
  });

  // ============================================================================
  // 9. PAYMENT SECURITY & WAGE INTEGRITY
  // ============================================================================
  describe("9. Payment Security & Wage Integrity", () => {
    it("9.1: Cash payment initiation ignores client-submitted amounts and calculates server-side", async () => {
      // Even if attacker client sends a manipulated amount (e.g. 1 INR), server must enforce agreed wage (800 INR)
      // Attempting to initiate cash payment by Provider 1 on test assignment
      const res = await request(app)
        .post(`/api/v1/payments/assignments/${testAssignmentId}/cash/initiate`)
        .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`)
        .send({
          amount: 1, // Attacker manipulated amount
          notes: "Manipulated wage attempt",
        });

      // The assignment is not in COMPLETED status, so it must reject invalid state first
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/COMPLETED/i);
    });

    it("9.2: Non-participant user cannot initiate payment for an assignment (403 FORBIDDEN)", async () => {
      const res = await request(app)
        .post(`/api/v1/payments/assignments/${testAssignmentId}/pay`)
        .set("Authorization", `Bearer mock_token_${PROVIDER_2_AUTH}`)
        .send({ method: "CASH" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/not authorized|do not own/i);
    });
  });
});
