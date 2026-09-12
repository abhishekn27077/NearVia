/**
 * Admin Console Security & Separation Hardening Test Suite — Prompt 16
 *
 * Verifies:
 * 1. Physical & Logical separation of the Admin Console.
 * 2. Strict CORS allowlist permits http://localhost:5174 and rejects unauthorized origins.
 * 3. Server-enforced RBAC: All /api/v1/admin/* routes reject unauthenticated (401)
 *    and non-admin (403: Worker, Provider, Agent) requests.
 * 4. Client-side self-escalation immunity (client role headers/body ignored).
 * 5. Both PUT and PATCH methods supported for user status and role moderation.
 * 6. Audit logs generated on administrative actions.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import cors from "cors";
import { apiRouter } from "../src/routes";
import { query } from "../src/db";
import { notFoundHandler, errorHandler } from "../src/middleware";

describe("NEARVIA — Prompt 16: Admin Console Separation & Hardening Suite", () => {
  let app: express.Express;

  const PREFIX = "p16_admin_sec_";
  const WORKER_AUTH = `${PREFIX}worker_auth`;
  const PROVIDER_AUTH = `${PREFIX}provider_auth`;
  const AGENT_AUTH = `${PREFIX}agent_auth`;
  const ADMIN_AUTH = `${PREFIX}admin_auth`;

  let workerUserId: string;
  let providerUserId: string;
  let agentUserId: string;
  let adminUserId: string;

  beforeAll(async () => {
    app = express();

    // Configure CORS exactly as in app.ts
    const allowedOrigins = "http://localhost:3000,http://localhost:5173,http://localhost:5174"
      .split(",")
      .map((o) => o.trim());

    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          return callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
      }),
    );

    app.use(express.json());
    app.use("/api/v1", apiRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);

    // 1. Cleanup old test data
    await query(`DELETE FROM audit_logs WHERE actor_id IN (SELECT id FROM users WHERE auth_id LIKE '${PREFIX}%')`);
    await query(`DELETE FROM reports WHERE reporter_id IN (SELECT id FROM users WHERE auth_id LIKE '${PREFIX}%')`);
    await query(`DELETE FROM disputes WHERE initiator_id IN (SELECT id FROM users WHERE auth_id LIKE '${PREFIX}%')`);
    await query(`DELETE FROM verifications WHERE target_id IN (SELECT id FROM users WHERE auth_id LIKE '${PREFIX}%')`);
    await query(`DELETE FROM users WHERE auth_id LIKE '${PREFIX}%'`);

    // 2. Create Users
    const wRes = await query<{ id: string }>(`
      INSERT INTO users (auth_id, email, phone, full_name, role, is_active)
      VALUES ($1, 'p16_worker@nearvia.test', '+919900110001', 'P16 Worker', 'WORKER', TRUE)
      RETURNING id
    `, [WORKER_AUTH]);
    workerUserId = wRes.rows[0].id;

    const pRes = await query<{ id: string }>(`
      INSERT INTO users (auth_id, email, phone, full_name, role, is_active)
      VALUES ($1, 'p16_provider@nearvia.test', '+919900110002', 'P16 Provider', 'PROVIDER', TRUE)
      RETURNING id
    `, [PROVIDER_AUTH]);
    providerUserId = pRes.rows[0].id;

    const aRes = await query<{ id: string }>(`
      INSERT INTO users (auth_id, email, phone, full_name, role, is_active)
      VALUES ($1, 'p16_agent@nearvia.test', '+919900110003', 'P16 Agent', 'AGENT', TRUE)
      RETURNING id
    `, [AGENT_AUTH]);
    agentUserId = aRes.rows[0].id;

    const admRes = await query<{ id: string }>(`
      INSERT INTO users (auth_id, email, phone, full_name, role, is_active)
      VALUES ($1, 'p16_admin@nearvia.test', '+919900110004', 'P16 Administrator', 'ADMIN', TRUE)
      RETURNING id
    `, [ADMIN_AUTH]);
    adminUserId = admRes.rows[0].id;
  });

  afterAll(async () => {
    await query(`DELETE FROM audit_logs WHERE actor_id IN (SELECT id FROM users WHERE auth_id LIKE '${PREFIX}%')`);
    await query(`DELETE FROM reports WHERE reporter_id IN (SELECT id FROM users WHERE auth_id LIKE '${PREFIX}%')`);
    await query(`DELETE FROM disputes WHERE initiator_id IN (SELECT id FROM users WHERE auth_id LIKE '${PREFIX}%')`);
    await query(`DELETE FROM verifications WHERE target_id IN (SELECT id FROM users WHERE auth_id LIKE '${PREFIX}%')`);
    await query(`DELETE FROM users WHERE auth_id LIKE '${PREFIX}%'`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CORS POLICY & APPLICATION BOUNDARY TESTS
  // ──────────────────────────────────────────────────────────────────────────
  describe("1. CORS Boundary Verification", () => {
    it("1.1: Allows requests from dedicated admin console origin (http://localhost:5174)", async () => {
      const res = await request(app)
        .options("/api/v1/health")
        .set("Origin", "http://localhost:5174")
        .set("Access-Control-Request-Method", "GET");

      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5174");
    });

    it("1.2: Allows requests from public marketplace origin (http://localhost:5173)", async () => {
      const res = await request(app)
        .options("/api/v1/health")
        .set("Origin", "http://localhost:5173")
        .set("Access-Control-Request-Method", "GET");

      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    });

    it("1.3: Rejects requests from unauthorized external origins", async () => {
      const res = await request(app)
        .get("/api/v1/health")
        .set("Origin", "http://malicious-attacker.com");

      // CORS error handled by middleware or supertest
      expect(res.status).toBe(500);
      expect(res.body.message || res.body.error?.message).toContain("CORS policy does not allow access");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. SERVER-ENFORCED RBAC SECURITY TESTS
  // ──────────────────────────────────────────────────────────────────────────
  describe("2. Server-Enforced RBAC on Admin Routes", () => {
    it("2.1: Rejects unauthenticated request to /api/v1/admin/dashboard with 401", async () => {
      const res = await request(app).get("/api/v1/admin/dashboard");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("2.2: Rejects WORKER token attempting to access /api/v1/admin/dashboard with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard")
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message || res.body.message).toMatch(/Requires one of roles|Forbidden/i);
    });

    it("2.3: Rejects PROVIDER token attempting to access /api/v1/admin/users with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("2.4: Rejects AGENT token attempting to access /api/v1/admin/audit-logs with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/admin/audit-logs")
        .set("Authorization", `Bearer mock_token_${AGENT_AUTH}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("2.5: Rejects client-supplied role spoofing headers (Zero Client Trust)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard")
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`)
        .set("X-User-Role", "ADMIN")
        .set("x-admin-override", "true");

      // Server must rely exclusively on DB user record associated with JWT, not client headers
      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ADMIN PRIVILEGED OPERATIONS & USER MODERATION (PUT & PATCH)
  // ──────────────────────────────────────────────────────────────────────────
  describe("3. Admin Operations & Method Support", () => {
    it("3.1: Permitted ADMIN token successfully fetches platform overview dashboard", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it("3.2: Permitted ADMIN token updates user status via PUT /api/v1/admin/users/:id/status", async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${workerUserId}/status`)
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`)
        .send({ status: "SUSPENDED", reason: "Operational suspension for testing" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify DB update
      const check = await query<{ is_active: boolean }>("SELECT is_active FROM users WHERE id = $1", [workerUserId]);
      expect(check.rows[0].is_active).toBe(false);
    });

    it("3.3: Permitted ADMIN token updates user status via PATCH /api/v1/admin/users/:id/status", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${workerUserId}/status`)
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`)
        .send({ status: "ACTIVE", reason: "Reactivation after compliance check" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await query<{ is_active: boolean }>("SELECT is_active FROM users WHERE id = $1", [workerUserId]);
      expect(check.rows[0].is_active).toBe(true);
    });

    it("3.4: Permitted ADMIN token updates user role via PUT & PATCH", async () => {
      // Test PATCH
      const resPatch = await request(app)
        .patch(`/api/v1/admin/users/${workerUserId}/role`)
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`)
        .send({ role: "PROVIDER", reason: "Role change for testing" });

      expect(resPatch.status).toBe(200);
      expect(resPatch.body.success).toBe(true);

      // Revert with PUT
      const resPut = await request(app)
        .put(`/api/v1/admin/users/${workerUserId}/role`)
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`)
        .send({ role: "WORKER", reason: "Role revert for testing" });

      expect(resPut.status).toBe(200);
      expect(resPut.body.success).toBe(true);
    });

    it("3.5: Verifies audit log is created on administrative action", async () => {
      const logs = await query<{ action: string; target_entity: string }>(
        "SELECT action, target_entity FROM audit_logs WHERE actor_id = $1 ORDER BY created_at DESC",
        [adminUserId],
      );
      expect(logs.rows.length).toBeGreaterThan(0);
      expect(logs.rows[0].target_entity).toBe("users");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. PUBLIC APP INVARIANTS: NO ADMIN SELF-PROVISIONING
  // ──────────────────────────────────────────────────────────────────────────
  describe("4. Public Endpoint Protection Against Admin Self-Provisioning", () => {
    it("4.1: Public signup requesting role 'ADMIN' is rejected or normalized", async () => {
      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          email: "malicious_admin@test.nearvia.in",
          password: "RandomSecurePassword123!",
          fullName: "Fake Admin",
          role: "ADMIN",
        });

      // Backend auth service either rejects with 400 or rejects ADMIN creation
      if (res.status === 200 || res.status === 201) {
        // If created, its role MUST NOT be ADMIN
        expect(res.body.data.role).not.toBe("ADMIN");
      } else {
        expect([400, 403]).toContain(res.status);
      }

      // Cleanup
      await query("DELETE FROM users WHERE email = 'malicious_admin@test.nearvia.in'");
    });
  });
});
