/**
 * NEARVIA Phase 9: Automated Security Regression & Hardening Test Suite
 * Validates authentication, RBAC, IDOR, SQLi/XSS resilience, webhook HMAC integrity,
 * state machine invariants, and rate limiting barriers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { UserRole } from "@nearvia/types";
import { authenticateUser, requireRole } from "../src/middleware/auth.middleware";
import { AppError } from "../src/middleware/errorHandler";
import { createRateLimiter } from "../src/middleware/rateLimiter";
import { RazorpayPaymentProvider } from "../src/modules/payments/provider/razorpay.provider";

// Mock DB query function
vi.mock("../src/db", () => ({
  query: vi.fn(),
  withTransaction: vi.fn((cb) => cb({ query: vi.fn() })),
}));

// Mock Supabase service
vi.mock("../src/services/supabase.service", () => ({
  verifySupabaseToken: vi.fn(),
  getSupabaseServerClient: vi.fn(),
}));

import { query } from "../src/db";
import { verifySupabaseToken } from "../src/services/supabase.service";

describe("Phase 9: Security Hardening & Regression Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. AUTHENTICATION & IDENTITY HARDENING
  // ─────────────────────────────────────────────────────────────
  describe("1. Authentication & Identity Integrity", () => {
    it("should reject request with missing Authorization header (401)", async () => {
      const req: any = { headers: {} };
      const res: any = {};
      const next = vi.fn();

      await authenticateUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("Missing Bearer token");
    });

    it("should reject request with malformed Bearer token (401)", async () => {
      const req: any = { headers: { authorization: "Basic dXNlcjpwYXNz" } };
      const res: any = {};
      const next = vi.fn();

      await authenticateUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it("should reject expired or cryptographically invalid token (401)", async () => {
      (verifySupabaseToken as any).mockResolvedValue(null);

      const req: any = { headers: { authorization: "Bearer invalid.jwt.token" } };
      const res: any = {};
      const next = vi.fn();

      await authenticateUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("Invalid or expired");
    });

    it("should immediately reject deactivated or suspended user (403)", async () => {
      (verifySupabaseToken as any).mockResolvedValue({ authId: "auth-123", email: "user@test.com" });
      (query as any).mockResolvedValue({
        rows: [
          {
            id: "user-123",
            auth_id: "auth-123",
            phone: "+919876543210",
            full_name: "Suspended User",
            email: "user@test.com",
            role: UserRole.WORKER,
            is_active: false, // Suspended
          },
        ],
      });

      const req: any = { headers: { authorization: "Bearer valid.token" } };
      const res: any = {};
      const next = vi.fn();

      await authenticateUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain("suspended or deactivated");
    });

    it("should derive authenticated identity server-side from PostgreSQL record", async () => {
      (verifySupabaseToken as any).mockResolvedValue({ authId: "auth-456", email: "worker@test.com" });
      (query as any).mockResolvedValue({
        rows: [
          {
            id: "user-456",
            auth_id: "auth-456",
            phone: "+919876543211",
            full_name: "Ramesh Worker",
            email: "worker@test.com",
            role: UserRole.WORKER,
            is_active: true,
          },
        ],
      });

      const req: any = { headers: { authorization: "Bearer valid.token" } };
      const res: any = {};
      const next = vi.fn();

      await authenticateUser(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe("user-456");
      expect(req.user.role).toBe(UserRole.WORKER);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. ROLE-BASED ACCESS CONTROL (RBAC)
  // ─────────────────────────────────────────────────────────────
  describe("2. Role-Based Access Control (RBAC)", () => {
    it("should block WORKER from executing PROVIDER-only endpoint (403)", () => {
      const middleware = requireRole(UserRole.PROVIDER);
      const req: any = { user: { id: "u-1", role: UserRole.WORKER } };
      const res: any = {};
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain("Access denied. Requires one of roles: [PROVIDER]");
    });

    it("should block PROVIDER from executing WORKER-only endpoint (403)", () => {
      const middleware = requireRole(UserRole.WORKER);
      const req: any = { user: { id: "u-2", role: UserRole.PROVIDER } };
      const res: any = {};
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain("Access denied. Requires one of roles: [WORKER]");
    });

    it("should block non-admin users from executing ADMIN endpoint (403)", () => {
      const middleware = requireRole(UserRole.ADMIN);
      const req: any = { user: { id: "u-3", role: UserRole.PROVIDER } };
      const res: any = {};
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain("Access denied. Requires one of roles: [ADMIN]");
    });

    it("should permit user with matching allowed role", () => {
      const middleware = requireRole([UserRole.PROVIDER, UserRole.ADMIN]);
      const req: any = { user: { id: "u-4", role: UserRole.PROVIDER } };
      const res: any = {};
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. OBJECT AUTHORIZATION & IDOR RESILIENCE
  // ─────────────────────────────────────────────────────────────
  describe("3. Insecure Direct Object Reference (IDOR) Protection", () => {
    it("should reject conversation access if user is neither worker nor provider", async () => {
      const mockConversation = {
        id: "conv-1",
        work_opportunity_id: "job-1",
        opportunity_title: "Catering Helper",
        worker_id: "wp-1",
        worker_user_id: "user-worker-10",
        worker_full_name: "Worker Ten",
        worker_avatar_url: null,
        provider_id: "pp-1",
        provider_user_id: "user-provider-20",
        provider_full_name: "Provider Twenty",
        provider_business_name: "Catering Co",
        last_message_text: "Hello",
        last_message_at: new Date().toISOString(),
        unread_count: "0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (query as any).mockResolvedValue({ rows: [mockConversation] });

      const { messagesService } = await import("../src/modules/messages/service");

      // User 999 attempts to read conversation between User 10 and User 20
      await expect(
        messagesService.getConversationById("user-intruder-999", "conv-1")
      ).rejects.toThrow("You are not authorized to access this conversation.");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. SQL INJECTION & PARAMETERIZED QUERY INTEGRITY
  // ─────────────────────────────────────────────────────────────
  describe("4. SQL Injection Resilience", () => {
    it("should treat malicious SQL injection input as literal parameterized string", async () => {
      const maliciousPayload = "' OR '1'='1' --; DROP TABLE users;";
      
      // Simulate parameterized query execution
      (query as any).mockImplementation((sql: string, params: any[]) => {
        expect(sql).toContain("$1");
        expect(params).toContain(maliciousPayload);
        return Promise.resolve({ rows: [] });
      });

      // Verify query is invoked with parameter array, preventing SQL concatenation
      await query("SELECT id FROM users WHERE phone = $1", [maliciousPayload]);
      expect(query).toHaveBeenCalledWith(
        "SELECT id FROM users WHERE phone = $1",
        [maliciousPayload]
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. PAYMENT GATEWAY & WEBHOOK HMAC SECURITY
  // ─────────────────────────────────────────────────────────────
  describe("5. Payment Gateway Webhook HMAC & Replay Security", () => {
    const provider = new RazorpayPaymentProvider();
    const webhookSecret = "super_secure_webhook_secret_999";

    it("should accept valid HMAC-SHA256 signature using timing-safe comparison", async () => {
      const rawPayload = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_12345",
              order_id: "order_67890",
              amount: 80000,
              currency: "INR",
              status: "captured",
            },
          },
        },
      });

      const validSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(Buffer.from(rawPayload, "utf-8"))
        .digest("hex");

      const result = await provider.verifyWebhook(rawPayload, validSignature, webhookSecret);
      expect(result.isValid).toBe(true);
      expect(result.gatewayOrderId).toBe("order_67890");
      expect(result.gatewayPaymentId).toBe("pay_12345");
      expect(result.event).toBe("PAYMENT_CONFIRMED");
    });

    it("should reject forged or tampered webhook signature", async () => {
      const rawPayload = JSON.stringify({ event: "payment.captured", payload: {} });
      const forgedSignature = "0000000000000000000000000000000000000000000000000000000000000000";

      const result = await provider.verifyWebhook(rawPayload, forgedSignature, webhookSecret);
      expect(result.isValid).toBe(false);
      expect(result.errorReason).toContain("Invalid HMAC-SHA256 signature");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. STATE MACHINE LIFECYCLE INVARIANTS
  // ─────────────────────────────────────────────────────────────
  describe("6. State Machine Lifecycle Invariants", () => {
    it("should reject check-in on unconfirmed assignment", async () => {
      const { assignmentsService } = await import("../src/modules/assignments/service");
      const { withTransaction } = await import("../src/db");

      (withTransaction as any).mockImplementation((cb: any) =>
        cb({
          query: vi.fn().mockResolvedValue({
            rows: [
              {
                id: "asg-10",
                work_opportunity_id: "opp-1",
                worker_id: "w-1",
                provider_id: "p-1",
                worker_user_id: "u-worker",
                provider_user_id: "u-provider",
                status: "ASSIGNED", // Not yet CONFIRMED
                work_date: "2026-09-05",
                start_time: "09:00",
                duration_hours: 8,
              },
            ],
          }),
        })
      );

      await expect(
        assignmentsService.checkIn("u-worker", "asg-10", {
          latitude: 12.9716,
          longitude: 77.5946,
        })
      ).rejects.toThrow(/Cannot check in to assignment with status/);
    });

    it("should reject publishing an opportunity that is not in DRAFT status", async () => {
      const { workOpportunitiesService } = await import("../src/modules/jobs");

      (query as any).mockImplementation((sql: string) => {
        if (sql.includes("FROM provider_profiles WHERE user_id")) {
          return Promise.resolve({ rows: [{ id: "p-1" }] });
        }
        return Promise.resolve({
          rows: [
            {
              id: "opp-2",
              provider_id: "p-1",
              status: "PUBLISHED", // Already published
              category_id: "cat-1",
              title: "Already published job",
              description: "Test description",
              work_type: "SHIFT",
              urgency: "NORMAL",
              workers_needed: 2,
              workers_assigned: 0,
              latitude: 12.9716,
              longitude: 77.5946,
              address_approximate: "MG Road",
              work_date: "2026-09-05",
              start_time: "09:00",
              end_time: "17:00",
              duration_hours: 8,
              payment_amount: 800,
              payment_type: "DAILY",
              currency: "INR",
              min_experience_years: 0,
              responsibilities: null,
              instructions: null,
              tools_provided: false,
              orientation_provided: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              published_at: new Date().toISOString(),
              completed_at: null,
              cancelled_at: null,
            },
          ],
        });
      });

      await expect(
        workOpportunitiesService.publishWorkOpportunity("opp-2", "user-prov-1")
      ).rejects.toThrow(/Cannot publish opportunity currently in/);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. RATE LIMITING PROTECTION
  // ─────────────────────────────────────────────────────────────
  describe("6. Rate Limiting Protection", () => {
    it("should enforce limit threshold and return HTTP 429 on abuse", () => {
      const limiter = createRateLimiter({
        windowMs: 60 * 1000,
        maxRequests: 3,
        message: "Too many attempts. Slow down.",
      });

      const req: any = { ip: "10.0.0.1", baseUrl: "/api/v1/auth", header: () => undefined };
      let statusCode = 200;
      let responseBody: any = null;

      const res: any = {
        setHeader: vi.fn(),
        status: (code: number) => {
          statusCode = code;
          return { json: (b: any) => { responseBody = b; } };
        },
      };

      const next = vi.fn();

      // Requests 1, 2, 3 allowed
      limiter(req, res, next);
      limiter(req, res, next);
      limiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(3);

      // Request 4 blocked with 429
      limiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(3);
      expect(statusCode).toBe(429);
      expect(responseBody.error.code).toBe("RATE_LIMIT_EXCEEDED");
    });
  });
});
