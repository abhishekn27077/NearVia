/**
 * NEARVIA PROMPT 8: Full Security, Privacy, and API Hardening Test Suite
 * 
 * Verifies:
 * 1. Authentication & Session Validation (401 on missing/expired/invalid)
 * 2. Role Enforcement & Multi-role boundaries (403 on role mismatch)
 * 3. Role Escalation Immunity (Client cannot claim ADMIN)
 * 4. Input & URL Protocol Validation (rejects javascript: / unsafe protocols)
 * 5. Private Storage & Evidence Access Control (IDOR defense)
 * 6. Error Sanitization & Secret Redaction (Zero connection string/password leak)
 * 7. Rate Limiting Protection (429 on abuse)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserRole } from "@nearvia/types";
import { authenticateUser, requireRole } from "../src/middleware/auth.middleware";
import { errorHandler, AppError } from "../src/middleware/errorHandler";
import { createRateLimiter } from "../src/middleware/rateLimiter";
import { uploadJobEvidenceSchema } from "@nearvia/validation";
import { validateUuid } from "../src/utils/security";

// Mock Database
vi.mock("../src/db", () => {
  const queryMock = vi.fn();
  return {
    query: queryMock,
    withTransaction: vi.fn((cb) => cb({ query: (...args: any[]) => queryMock(...args) })),
  };
});

// Mock Supabase service
vi.mock("../src/services/supabase.service", () => ({
  verifySupabaseToken: vi.fn(),
  getSupabaseServerClient: vi.fn(),
}));

import { query } from "../src/db";
import { verifySupabaseToken } from "../src/services/supabase.service";
import { assignmentsService } from "../src/modules/assignments/service";

const TEST_WORKER_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_PROVIDER_USER_ID = "22222222-2222-4222-8222-222222222222";
const TEST_ATTACKER_USER_ID = "99999999-9999-4999-8999-999999999999";
const TEST_ASSIGNMENT_ID = "33333333-3333-4333-8333-333333333333";

describe("PROMPT 8: Full Security, Privacy & API Hardening Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (query as any).mockReset();
  });

  // ============================================================================
  // 1. AUTHENTICATION AUDIT
  // ============================================================================
  describe("1. Authentication Audit", () => {
    it("rejects unauthenticated requests without Bearer header (401)", async () => {
      const req: any = { headers: {} };
      const res: any = {};
      let caughtError: any = null;

      await authenticateUser(req, res, (err) => {
        caughtError = err;
      });

      expect(caughtError).toBeInstanceOf(AppError);
      expect(caughtError.statusCode).toBe(401);
      expect(caughtError.code).toBe("UNAUTHORIZED");
    });

    it("rejects invalid or expired tokens (401)", async () => {
      (verifySupabaseToken as any).mockResolvedValueOnce(null);

      const req: any = { headers: { authorization: "Bearer invalid_expired_token" } };
      const res: any = {};
      let caughtError: any = null;

      await authenticateUser(req, res, (err) => {
        caughtError = err;
      });

      expect(caughtError).toBeInstanceOf(AppError);
      expect(caughtError.statusCode).toBe(401);
      expect(caughtError.code).toBe("UNAUTHORIZED");
    });

    it("rejects suspended or deactivated user accounts (403)", async () => {
      (verifySupabaseToken as any).mockResolvedValueOnce({
        authId: "auth_suspended_user",
        emailVerified: true,
      });

      (query as any).mockResolvedValueOnce({
        rows: [
          {
            id: TEST_ATTACKER_USER_ID,
            auth_id: "auth_suspended_user",
            full_name: "Suspended User",
            email: "suspended@nearvia.test",
            role: UserRole.WORKER,
            is_active: false, // Account suspended!
          },
        ],
      });

      const req: any = { headers: { authorization: "Bearer valid_token_but_suspended" } };
      const res: any = {};
      let caughtError: any = null;

      await authenticateUser(req, res, (err) => {
        caughtError = err;
      });

      expect(caughtError).toBeInstanceOf(AppError);
      expect(caughtError.statusCode).toBe(403);
      expect(caughtError.code).toBe("FORBIDDEN");
    });
  });

  // ============================================================================
  // 2. AUTHORIZATION & ROLE BOUNDARIES
  // ============================================================================
  describe("2. Authorization & Role Boundaries", () => {
    it("blocks WORKER from accessing ADMIN endpoints (403)", () => {
      const guard = requireRole(UserRole.ADMIN);
      const req: any = { user: { role: UserRole.WORKER, id: TEST_WORKER_USER_ID } };
      const res: any = {};
      let caughtError: any = null;

      guard(req, res, (err) => {
        caughtError = err;
      });

      expect(caughtError).toBeInstanceOf(AppError);
      expect(caughtError.statusCode).toBe(403);
      expect(caughtError.code).toBe("FORBIDDEN");
    });

    it("blocks PROVIDER from accessing ADMIN endpoints (403)", () => {
      const guard = requireRole(UserRole.ADMIN);
      const req: any = { user: { role: UserRole.PROVIDER, id: TEST_PROVIDER_USER_ID } };
      const res: any = {};
      let caughtError: any = null;

      guard(req, res, (err) => {
        caughtError = err;
      });

      expect(caughtError).toBeInstanceOf(AppError);
      expect(caughtError.statusCode).toBe(403);
      expect(caughtError.code).toBe("FORBIDDEN");
    });

    it("blocks AGENT from accessing ADMIN endpoints (403)", () => {
      const guard = requireRole(UserRole.ADMIN);
      const req: any = { user: { role: UserRole.AGENT, id: "agent-123" } };
      const res: any = {};
      let caughtError: any = null;

      guard(req, res, (err) => {
        caughtError = err;
      });

      expect(caughtError).toBeInstanceOf(AppError);
      expect(caughtError.statusCode).toBe(403);
      expect(caughtError.code).toBe("FORBIDDEN");
    });
  });

  // ============================================================================
  // 3. INPUT VALIDATION & URL SANITIZATION
  // ============================================================================
  describe("3. Input Validation & URL Sanitization", () => {
    it("rejects malformed or SQL-injected UUIDs with 400", () => {
      expect(() => validateUuid("123; DROP TABLE users;--", "Test ID")).toThrow(AppError);
      expect(() => validateUuid("../etc/passwd", "Path ID")).toThrow(AppError);
      expect(() => validateUuid("not-a-valid-uuid", "Invalid ID")).toThrow(AppError);
    });

    it("rejects dangerous or unsafe URL protocols in job evidence uploads", () => {
      const maliciousPayloads = [
        { evidenceType: "BEFORE", fileUrl: "javascript:alert('XSS')" },
        { evidenceType: "AFTER", fileUrl: "vbscript:msgbox('hack')" },
        { evidenceType: "RECEIPT", fileUrl: "data:text/html;base64,PHNjcmlwdD4=" },
      ];

      for (const payload of maliciousPayloads) {
        const result = uploadJobEvidenceSchema.safeParse(payload);
        expect(result.success).toBe(false);
      }
    });

    it("accepts valid, safe HTTPS/storage URLs for job evidence", () => {
      const safePayload = {
        evidenceType: "BEFORE",
        fileUrl: "https://storage.nearvia.in/evidence/job-evidence-123.jpg",
        notes: "Work completed successfully as scheduled.",
      };

      const result = uploadJobEvidenceSchema.safeParse(safePayload);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // 4. STORAGE & EVIDENCE ACCESS CONTROL (IDOR DEFENSE)
  // ============================================================================
  describe("4. Storage & Job Evidence IDOR Defense", () => {
    it("prevents third-party attacker from uploading evidence to another user's assignment (403)", async () => {
      // Mock assignment belonging to TEST_WORKER and TEST_PROVIDER
      (query as any).mockResolvedValueOnce({
        rows: [
          {
            id: TEST_ASSIGNMENT_ID,
            worker_user_id: TEST_WORKER_USER_ID,
            provider_user_id: TEST_PROVIDER_USER_ID,
            status: "IN_PROGRESS",
          },
        ],
      });

      await expect(
        assignmentsService.uploadJobEvidence(TEST_ATTACKER_USER_ID, TEST_ASSIGNMENT_ID, {
          evidenceType: "BEFORE" as any,
          fileUrl: "https://storage.nearvia.in/evidence/photo.jpg",
        }),
      ).rejects.toThrow("You are not authorized to upload evidence for this assignment.");
    });

    it("prevents third-party attacker from viewing private evidence of another assignment (403)", async () => {
      (query as any).mockResolvedValueOnce({
        rows: [
          {
            id: TEST_ASSIGNMENT_ID,
            worker_user_id: TEST_WORKER_USER_ID,
            provider_user_id: TEST_PROVIDER_USER_ID,
            status: "COMPLETED",
          },
        ],
      });

      await expect(
        assignmentsService.getJobEvidence(TEST_ATTACKER_USER_ID, TEST_ASSIGNMENT_ID),
      ).rejects.toThrow("You are not authorized to view evidence for this assignment.");
    });
  });

  // ============================================================================
  // 5. ERROR & INFORMATION LEAKAGE DEFENSE
  // ============================================================================
  describe("5. Error & Information Leakage Defense", () => {
    it("redacts raw database connection strings and passwords from error responses", () => {
      const rawError = new AppError(
        "Connection failed to postgresql://postgres:SuperSecretPassword123@db.internal:5432/nearvia",
        500,
        "DATABASE_ERROR",
      );

      const req: any = { id: "req-test-123" };
      let statusCode = 200;
      let jsonBody: any = null;

      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              jsonBody = body;
            },
          };
        },
      };

      errorHandler(rawError, req, res, () => {});

      expect(statusCode).toBe(500);
      expect(jsonBody.error.message).not.toContain("SuperSecretPassword123");
      expect(jsonBody.error.message).toContain("***");
    });
  });

  // ============================================================================
  // 6. RATE LIMITING & ABUSE DEFENSE
  // ============================================================================
  describe("6. Rate Limiting Protection", () => {
    it("triggers 429 when abuse threshold is exceeded", () => {
      const limiter = createRateLimiter({
        windowMs: 60 * 1000,
        maxRequests: 3,
        message: "Action limit exceeded. Slow down.",
      });

      const mockReq: any = { ip: "10.0.0.1", header: () => undefined };
      let statusCode = 200;
      let jsonBody: any = null;

      const mockRes: any = {
        setHeader: vi.fn(),
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              jsonBody = body;
            },
          };
        },
      };

      const next = vi.fn();

      // Requests 1 to 3 should pass
      limiter(mockReq, mockRes, next);
      limiter(mockReq, mockRes, next);
      limiter(mockReq, mockRes, next);
      expect(next).toHaveBeenCalledTimes(3);

      // Request 4 must be rate-limited
      limiter(mockReq, mockRes, next);
      expect(next).toHaveBeenCalledTimes(3);
      expect(statusCode).toBe(429);
      expect(jsonBody.error.code).toBe("RATE_LIMIT_EXCEEDED");
    });
  });
});
