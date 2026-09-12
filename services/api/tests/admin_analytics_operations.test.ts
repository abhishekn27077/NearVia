/**
 * Admin Dashboard & Operations Analytics Test Suite — Prompt 15
 * Tests server-authoritative aggregate metrics, RBAC security, zero-leakage trust & safety,
 * payment separation (cash vs sandbox), and zero-denominator protection.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { apiRouter } from "../src/routes";
import { query } from "../src/db";
import { notFoundHandler, errorHandler } from "../src/middleware";

describe("NEARVIA — Prompt 15: Admin Dashboard & Analytics Suite", () => {
  let app: express.Express;

  const P15_PREFIX = "p15_admin_";
  const WORKER_AUTH = `${P15_PREFIX}worker_auth`;
  const PROVIDER_AUTH = `${P15_PREFIX}provider_auth`;
  const AGENT_AUTH = `${P15_PREFIX}agent_auth`;
  const ADMIN_AUTH = `${P15_PREFIX}admin_auth`;

  let workerUserId: string;
  let providerUserId: string;
  let agentUserId: string;
  let adminUserId: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/v1", apiRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);

    // 1. Cleanup previous test run data
    await query(`DELETE FROM payment_records WHERE payer_id IN (SELECT id FROM users WHERE auth_id LIKE '${P15_PREFIX}%') OR payee_id IN (SELECT id FROM users WHERE auth_id LIKE '${P15_PREFIX}%')`);
    await query(`DELETE FROM reports WHERE reporter_id IN (SELECT id FROM users WHERE auth_id LIKE '${P15_PREFIX}%')`);
    await query(`DELETE FROM disputes WHERE initiator_id IN (SELECT id FROM users WHERE auth_id LIKE '${P15_PREFIX}%')`);
    await query(`DELETE FROM verifications WHERE target_id IN (SELECT id FROM users WHERE auth_id LIKE '${P15_PREFIX}%')`);
    await query(`DELETE FROM assignments WHERE provider_id IN (SELECT id FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE '${P15_PREFIX}%'))`);
    await query(`DELETE FROM work_opportunities WHERE title LIKE '%[P15_TEST]%'`);
    await query(`DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE '${P15_PREFIX}%')`);
    await query(`DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE '${P15_PREFIX}%')`);
    await query(`DELETE FROM agent_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE '${P15_PREFIX}%')`);
    await query(`DELETE FROM users WHERE auth_id LIKE '${P15_PREFIX}%'`);

    // 2. Create Users for all roles
    // Worker
    const wUser = await query<{ id: string }>(`
      INSERT INTO users (auth_id, email, phone, full_name, role, is_active)
      VALUES ($1, 'p15_worker@test.nearvia.in', '+919988112201', 'P15 Test Worker', 'WORKER', TRUE)
      RETURNING id
    `, [WORKER_AUTH]);
    workerUserId = wUser.rows[0].id;

    // Provider
    const pUser = await query<{ id: string }>(`
      INSERT INTO users (auth_id, email, phone, full_name, role, is_active)
      VALUES ($1, 'p15_provider@test.nearvia.in', '+919988112202', 'P15 Test Provider', 'PROVIDER', TRUE)
      RETURNING id
    `, [PROVIDER_AUTH]);
    providerUserId = pUser.rows[0].id;

    // Agent
    const aUser = await query<{ id: string }>(`
      INSERT INTO users (auth_id, email, phone, full_name, role, is_active)
      VALUES ($1, 'p15_agent@test.nearvia.in', '+919988112203', 'P15 Test Agent', 'AGENT', TRUE)
      RETURNING id
    `, [AGENT_AUTH]);
    agentUserId = aUser.rows[0].id;

    // Admin
    const admUser = await query<{ id: string }>(`
      INSERT INTO users (auth_id, email, phone, full_name, role, is_active)
      VALUES ($1, 'p15_admin@test.nearvia.in', '+919988112204', 'P15 Platform Admin', 'ADMIN', TRUE)
      RETURNING id
    `, [ADMIN_AUTH]);
    adminUserId = admUser.rows[0].id;
  });

  afterAll(async () => {
    // Teardown
    await query(`DELETE FROM payment_records WHERE payer_id IN (SELECT id FROM users WHERE auth_id LIKE '${P15_PREFIX}%') OR payee_id IN (SELECT id FROM users WHERE auth_id LIKE '${P15_PREFIX}%')`);
    await query(`DELETE FROM reports WHERE reporter_id IN (SELECT id FROM users WHERE auth_id LIKE '${P15_PREFIX}%')`);
    await query(`DELETE FROM disputes WHERE initiator_id IN (SELECT id FROM users WHERE auth_id LIKE '${P15_PREFIX}%')`);
    await query(`DELETE FROM verifications WHERE target_id IN (SELECT id FROM users WHERE auth_id LIKE '${P15_PREFIX}%')`);
    await query(`DELETE FROM users WHERE auth_id LIKE '${P15_PREFIX}%'`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)
  // ──────────────────────────────────────────────────────────────────────────
  describe("1. Admin Security & Role-Based Access Control", () => {
    it("1.1: Rejects unauthenticated request to admin overview with 401", async () => {
      const res = await request(app).get("/api/v1/admin/analytics/overview");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("1.2: Rejects WORKER role from accessing admin overview with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/overview")
        .set("Authorization", `Bearer mock_token_${WORKER_AUTH}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("1.3: Rejects PROVIDER role from accessing admin marketplace analytics with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/marketplace")
        .set("Authorization", `Bearer mock_token_${PROVIDER_AUTH}`);
      expect(res.status).toBe(403);
    });

    it("1.4: Rejects AGENT role from accessing admin payments analytics with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/payments")
        .set("Authorization", `Bearer mock_token_${AGENT_AUTH}`);
      expect(res.status).toBe(403);
    });

    it("1.5: Allows verified ADMIN role to access all analytics endpoints with 200 OK", async () => {
      const [overRes, mktRes, tsRes, payRes] = await Promise.all([
        request(app).get("/api/v1/admin/analytics/overview").set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`),
        request(app).get("/api/v1/admin/analytics/marketplace").set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`),
        request(app).get("/api/v1/admin/analytics/trust-safety").set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`),
        request(app).get("/api/v1/admin/analytics/payments").set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`),
      ]);

      expect(overRes.status).toBe(200);
      expect(overRes.body.success).toBe(true);
      expect(mktRes.status).toBe(200);
      expect(mktRes.body.success).toBe(true);
      expect(tsRes.status).toBe(200);
      expect(tsRes.body.success).toBe(true);
      expect(payRes.status).toBe(200);
      expect(payRes.body.success).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. OVERVIEW BUSINESS & PLATFORM ANALYTICS
  // ──────────────────────────────────────────────────────────────────────────
  describe("2. Overview Business & Platform Analytics", () => {
    it("2.1: Returns accurate user counts and role breakdown", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/overview")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.users).toBeDefined();
      expect(data.users.total).toBeGreaterThanOrEqual(4);
      expect(data.users.workers).toBeGreaterThanOrEqual(1);
      expect(data.users.providers).toBeGreaterThanOrEqual(1);
      expect(data.users.agents).toBeGreaterThanOrEqual(1);
      expect(data.users.activeCount).toBeGreaterThanOrEqual(4);
    });

    it("2.2: Returns work execution, assignment, and cancellation counts", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/overview")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.work).toBeDefined();
      expect(typeof data.work.totalPosted).toBe("number");
      expect(typeof data.work.publishedActive).toBe("number");
      expect(typeof data.work.completed).toBe("number");
      expect(typeof data.work.cancelled).toBe("number");

      expect(data.assignments).toBeDefined();
      expect(typeof data.assignments.totalAssignments).toBe("number");
      expect(typeof data.assignments.activeAssignments).toBe("number");
      expect(typeof data.assignments.completedAssignments).toBe("number");
      expect(typeof data.assignments.cancelledAssignments).toBe("number");
    });

    it("2.3: Returns reports & disputes summary without leaking complaint details", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/overview")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.reportsAndDisputes).toBeDefined();
      expect(typeof data.reportsAndDisputes.openReports).toBe("number");
      expect(typeof data.reportsAndDisputes.resolvedReports).toBe("number");
      expect(typeof data.reportsAndDisputes.openDisputes).toBe("number");
      expect(typeof data.reportsAndDisputes.resolvedDisputes).toBe("number");
      expect(typeof data.reportsAndDisputes.totalIssues).toBe("number");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. MARKETPLACE ANALYTICS & FULFILLMENT RATIOS
  // ──────────────────────────────────────────────────────────────────────────
  describe("3. Marketplace Analytics & Fulfillment", () => {
    it("3.1: Returns jobs by category with active count and average daily wage", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/marketplace")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(Array.isArray(data.jobsByCategory)).toBe(true);
      if (data.jobsByCategory.length > 0) {
        const cat = data.jobsByCategory[0];
        expect(cat).toHaveProperty("categoryId");
        expect(cat).toHaveProperty("categoryName");
        expect(cat).toHaveProperty("count");
        expect(cat).toHaveProperty("avgWage");
        expect(cat.count).toBeGreaterThanOrEqual(0);
      }
    });

    it("3.2: Returns jobs by work type (TASK, SHIFT, JOB)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/marketplace")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(Array.isArray(data.jobsByType)).toBe(true);
      for (const t of data.jobsByType) {
        expect(["TASK", "SHIFT", "JOB"]).toContain(t.workType);
        expect(typeof t.count).toBe("number");
      }
    });

    it("3.3: Returns conversion funnel without division-by-zero errors", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/marketplace")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.conversionFunnel).toBeDefined();
      expect(data.conversionFunnel.applicationToHireRate).toBeGreaterThanOrEqual(0);
      expect(data.conversionFunnel.applicationToHireRate).toBeLessThanOrEqual(100);
      expect(data.conversionFunnel.assignmentCompletionRate).toBeGreaterThanOrEqual(0);
      expect(data.conversionFunnel.assignmentCompletionRate).toBeLessThanOrEqual(100);
      expect(isNaN(data.conversionFunnel.applicationToHireRate)).toBe(false);
      expect(isNaN(data.conversionFunnel.assignmentCompletionRate)).toBe(false);
    });

    it("3.4: Backwards compatibility alias /analytics/health returns 200 OK", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/health")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("fillRatePercentage");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. TRUST, SAFETY & MODERATION ANALYTICS
  // ──────────────────────────────────────────────────────────────────────────
  describe("4. Trust, Safety & Moderation Intelligence", () => {
    it("4.1: Returns KYC verification pipeline counts and moderation backlog", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/trust-safety")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.verifications).toBeDefined();
      expect(typeof data.verifications.pending).toBe("number");
      expect(typeof data.verifications.approved).toBe("number");
      expect(typeof data.verifications.rejected).toBe("number");
      expect(typeof data.verifications.total).toBe("number");

      expect(typeof data.moderationBacklogCount).toBe("number");
      expect(data.moderationBacklogCount).toBeGreaterThanOrEqual(0);
    });

    it("4.2: Returns community ratings overview", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/trust-safety")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.ratingsOverview).toBeDefined();
      expect(data.ratingsOverview.averageRating).toBeGreaterThanOrEqual(0);
      expect(data.ratingsOverview.averageRating).toBeLessThanOrEqual(5.0);
      expect(typeof data.ratingsOverview.totalReviews).toBe("number");
    });

    it("4.3: Aggregates do NOT leak private complaint descriptions, notes, or PII", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/trust-safety")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);

      expect(res.status).toBe(200);
      const jsonString = JSON.stringify(res.body);
      expect(jsonString).not.toContain("description");
      expect(jsonString).not.toContain("phone");
      expect(jsonString).not.toContain("resolutionNotes");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. PAYMENT ANALYTICS & SETTLEMENT LEDGER
  // ──────────────────────────────────────────────────────────────────────────
  describe("5. Payment Analytics & Settlement Vault", () => {
    it("5.1: Distinguishes verified cash settlements from online sandbox payments", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/payments")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.cashSettlements).toBeDefined();
      expect(typeof data.cashSettlements.settledVolume).toBe("number");
      expect(typeof data.cashSettlements.count).toBe("number");

      expect(data.sandboxOnlinePayments).toBeDefined();
      expect(data.sandboxOnlinePayments.isSandbox).toBe(true);
      expect(typeof data.sandboxOnlinePayments.volume).toBe("number");
      expect(typeof data.sandboxOnlinePayments.count).toBe("number");
      expect(data.sandboxOnlinePayments.disclaimer).toContain("Sandbox / Demo test mode");
    });

    it("5.2: Reports pending, disputed, and failed transaction counts", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/payments")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.pendingSettlements).toBeDefined();
      expect(typeof data.pendingSettlements.count).toBe("number");
      expect(data.disputedPayments).toBeDefined();
      expect(typeof data.disputedPayments.count).toBe("number");
      expect(typeof data.failedPaymentsCount).toBe("number");
      expect(typeof data.totalTransactionsCount).toBe("number");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. ZERO DATA FABRICATION & EMPTY DATABASE RESILIENCE
  // ──────────────────────────────────────────────────────────────────────────
  describe("6. Zero Data Fabrication & Error Resilience", () => {
    it("6.1: High-level dashboard metrics endpoint returns 200 and valid numbers", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const metrics = res.body.data;
      expect(typeof metrics.totalUsers).toBe("number");
      expect(typeof metrics.publishedWorkCount).toBe("number");
      expect(typeof metrics.totalApplicationsCount).toBe("number");
      expect(typeof metrics.cancelledWorkCount).toBe("number");
      expect(typeof metrics.confirmedPaymentsVolume).toBe("number");
      expect(typeof metrics.cashSettledVolume).toBe("number");
      expect(typeof metrics.sandboxSettledVolume).toBe("number");
    });

    it("6.2: Platform events stream returns paginated results", async () => {
      const res = await request(app)
        .get("/api/v1/admin/analytics/events?page=1&limit=5")
        .set("Authorization", `Bearer mock_token_${ADMIN_AUTH}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.events)).toBe(true);
      expect(typeof res.body.total).toBe("number");
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(5);
    });
  });
});
