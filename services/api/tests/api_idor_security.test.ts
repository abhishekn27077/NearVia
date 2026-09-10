/**
 * NEARVIA PROMPT 3: Complete API Security, RBAC & IDOR Adversarial Test Suite
 * 
 * Tests:
 * 1. Input Sanitization & UUID/Pagination Validation
 * 2. Major Role Boundaries & Middleware
 * 3. Cross-Provider IDOR (Jobs, Applications, Hires)
 * 4. Cross-Worker IDOR (Applications, Assignments, Attendance, PINs)
 * 5. Agent-Worker Relationship & Consent Enforcement
 * 6. Payment Authorization, Cash PIN Confidentiality & Refund IDOR
 * 7. Private Data Leakage Minimization
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserRole, WorkOpportunityStatus, AssignmentStatus } from "@nearvia/types";
import { AppError } from "../src/middleware/errorHandler";
import { validateUuid, clampPagination } from "../src/utils/security";
import { requireRole } from "../src/middleware/auth.middleware";

// Mock database
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
import { workOpportunitiesService } from "../src/modules/jobs/service";
import { applicationsService } from "../src/modules/applications/service";
import { assignmentsService } from "../src/modules/assignments/service";
import { agentsService } from "../src/modules/agents/service";
import { paymentsService } from "../src/modules/payments/service";

const VALID_UUID_1 = "a1111111-1111-4111-8111-111111111111";
const VALID_UUID_2 = "b2222222-2222-4222-8222-222222222222";
const VALID_UUID_3 = "c3333333-3333-4333-8333-333333333333";

describe("Prompt 3: Complete API Security & IDOR Verification Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (query as any).mockReset();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. INPUT SANITIZATION & PATH PARAMETER SECURITY
  // ─────────────────────────────────────────────────────────────
  describe("1. Input Security & Path Parameter Sanitization", () => {
    it("accepts canonical RFC 4122 UUIDs without error", () => {
      const valid = validateUuid(VALID_UUID_1, "Test ID");
      expect(valid).toBe(VALID_UUID_1);
    });

    it("rejects non-UUID strings and SQL injection payloads", () => {
      const maliciousInputs = [
        "12345",
        "undefined",
        "null",
        "' OR 1=1 --",
        "../../etc/passwd",
        "; DROP TABLE users; --",
        "<script>alert(1)</script>",
        "not-a-valid-uuid-format-here",
      ];

      for (const input of maliciousInputs) {
        expect(() => validateUuid(input, "Resource ID")).toThrow();
      }
    });

    it("clamps pagination parameters to safe boundaries", () => {
      // Extremely large limit
      const clampedLarge = clampPagination({ page: "1", limit: "999999" }, 20, 50);
      expect(clampedLarge.limit).toBe(50);

      // Negative page / limit
      const clampedNegative = clampPagination({ page: "-5", limit: "-100" }, 20, 50);
      expect(clampedNegative.page).toBe(1);
      expect(clampedNegative.limit).toBe(1);

      // Non-numeric junk
      const clampedJunk = clampPagination({ page: "foo", limit: "bar" }, 20, 50);
      expect(clampedJunk.page).toBe(1);
      expect(clampedJunk.limit).toBe(20);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. MAJOR ROLE BOUNDARIES & AUTHORIZATION
  // ─────────────────────────────────────────────────────────────
  describe("2. Major Role Boundaries", () => {
    it("blocks WORKER from accessing PROVIDER-only endpoints (403)", () => {
      const req: any = { user: { id: VALID_UUID_1, role: UserRole.WORKER } };
      const next = vi.fn();

      const middleware = requireRole(UserRole.PROVIDER);
      middleware(req, {} as any, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain("Access denied");
    });

    it("blocks PROVIDER from accessing WORKER-only endpoints (403)", () => {
      const req: any = { user: { id: VALID_UUID_1, role: UserRole.PROVIDER } };
      const next = vi.fn();

      const middleware = requireRole(UserRole.WORKER);
      middleware(req, {} as any, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });

    it("blocks non-admin from accessing ADMIN-only endpoints (403)", () => {
      for (const role of [UserRole.WORKER, UserRole.PROVIDER, UserRole.AGENT]) {
        const req: any = { user: { id: VALID_UUID_1, role } };
        const next = vi.fn();

        const middleware = requireRole(UserRole.ADMIN);
        middleware(req, {} as any, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        expect(next.mock.calls[0][0].statusCode).toBe(403);
      }
    });

    it("allows authorized roles when multiple roles are permitted", () => {
      const middleware = requireRole([UserRole.PROVIDER, UserRole.ADMIN]);

      const providerReq: any = { user: { id: VALID_UUID_1, role: UserRole.PROVIDER } };
      const providerNext = vi.fn();
      middleware(providerReq, {} as any, providerNext);
      expect(providerNext).toHaveBeenCalledWith();

      const adminReq: any = { user: { id: VALID_UUID_2, role: UserRole.ADMIN } };
      const adminNext = vi.fn();
      middleware(adminReq, {} as any, adminNext);
      expect(adminNext).toHaveBeenCalledWith();

      const workerReq: any = { user: { id: VALID_UUID_3, role: UserRole.WORKER } };
      const workerNext = vi.fn();
      middleware(workerReq, {} as any, workerNext);
      expect(workerNext).toHaveBeenCalledWith(expect.any(AppError));
      expect(workerNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. CROSS-PROVIDER IDOR (JOBS, APPLICATIONS, HIRING)
  // ─────────────────────────────────────────────────────────────
  describe("3. Cross-Provider IDOR Protection", () => {
    it("prevents Provider B from updating Provider A's work opportunity (403)", async () => {
      const providerB_UserId = VALID_UUID_2;
      const opportunityId = VALID_UUID_3;

      (query as any).mockImplementation((sql: string) => {
        if (sql.includes("FROM provider_profiles WHERE user_id")) {
          return Promise.resolve({ rows: [{ id: "provider-profile-b" }] });
        }
        if (sql.includes("FROM work_opportunities wo") || sql.includes("FROM work_opportunities WHERE id")) {
          return Promise.resolve({
            rows: [
              {
                id: opportunityId,
                provider_id: "provider-profile-a", // Owned by Provider A!
                status: WorkOpportunityStatus.DRAFT,
                title: "Provider A Job",
                workers_needed: 1,
                workers_assigned: 0,
                location_name: "Test Location",
                skills: [],
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        workOpportunitiesService.updateWorkOpportunity(opportunityId, providerB_UserId, {
          title: "Malicious Job Hijack",
        })
      ).rejects.toThrow("Unpublished draft opportunities cannot be viewed");
    });

    it("prevents Provider B from publishing Provider A's work opportunity (403)", async () => {
      const providerB_UserId = VALID_UUID_2;
      const opportunityId = VALID_UUID_3;

      (query as any).mockImplementation((sql: string) => {
        if (sql.includes("FROM provider_profiles WHERE user_id")) {
          return Promise.resolve({ rows: [{ id: "provider-profile-b" }] });
        }
        if (sql.includes("FROM work_opportunities wo") || sql.includes("FROM work_opportunities WHERE id")) {
          return Promise.resolve({
            rows: [
              {
                id: opportunityId,
                provider_id: "provider-profile-a",
                status: WorkOpportunityStatus.DRAFT,
                title: "Provider A Job",
                workers_needed: 1,
                workers_assigned: 0,
                location_name: "Test Location",
                skills: [],
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        workOpportunitiesService.publishWorkOpportunity(opportunityId, providerB_UserId)
      ).rejects.toThrow("Unpublished draft opportunities cannot be viewed");
    });

    it("prevents Provider B from accepting/hiring an applicant on Provider A's job (403)", async () => {
      const providerB_UserId = VALID_UUID_2;
      const applicationId = VALID_UUID_3;

      (query as any).mockImplementation((sql: string) => {
        if (sql.includes("FROM applications a")) {
          return Promise.resolve({
            rows: [
              {
                id: applicationId,
                work_opportunity_id: "job-1",
                worker_id: "worker-1",
                provider_user_id: VALID_UUID_1, // Owned by Provider A!
                provider_id: "prov-prof-a",
                status: "APPLIED",
                proposed_wage: 500,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        applicationsService.acceptApplication(providerB_UserId, applicationId, "Notes")
      ).rejects.toThrow("You are not authorized to accept applicants for this work");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. CROSS-WORKER IDOR (APPLICATIONS, ASSIGNMENTS, ATTENDANCE)
  // ─────────────────────────────────────────────────────────────
  describe("4. Cross-Worker IDOR Protection", () => {
    it("prevents Worker B from withdrawing Worker A's application (403)", async () => {
      const workerB_UserId = VALID_UUID_2;
      const applicationId = VALID_UUID_3;

      (query as any).mockImplementation((sql: string) => {
        if (sql.includes("FROM applications a")) {
          return Promise.resolve({
            rows: [
              {
                id: applicationId,
                worker_user_id: VALID_UUID_1, // Belongs to Worker A!
                status: "APPLIED",
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        applicationsService.withdrawApplication(workerB_UserId, applicationId)
      ).rejects.toThrow("You can only withdraw your own applications");
    });

    it("prevents Worker B from checking in for Worker A's assignment (403)", async () => {
      const workerB_UserId = VALID_UUID_2;
      const assignmentId = VALID_UUID_3;

      (query as any).mockImplementation((sql: string) => {
        if (sql.includes("FROM assignments a")) {
          return Promise.resolve({
            rows: [
              {
                id: assignmentId,
                worker_user_id: VALID_UUID_1, // Belongs to Worker A!
                provider_user_id: "prov-1",
                status: AssignmentStatus.CONFIRMED,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        assignmentsService.checkIn(workerB_UserId, assignmentId, {
          latitude: 12.9716,
          longitude: 77.5946,
        })
      ).rejects.toThrow("Only the assigned worker can check in for this assignment");
    });

    it("prevents Worker B from confirming cash payment for Worker A's assignment (403)", async () => {
      const workerB_UserId = VALID_UUID_2;
      const assignmentId = VALID_UUID_3;

      (query as any).mockImplementation((sql: string) => {
        if (sql.includes("FROM assignments a")) {
          return Promise.resolve({
            rows: [
              {
                id: assignmentId,
                worker_user_id: VALID_UUID_1, // Belongs to Worker A!
                status: "COMPLETED",
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        paymentsService.confirmCashPayment(workerB_UserId, assignmentId, {
          paymentPin: "1234",
        })
      ).rejects.toThrow("Only the assigned worker can confirm cash receipt");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. AGENT-WORKER CONSENT & ACCESS CONTROL
  // ─────────────────────────────────────────────────────────────
  describe("5. Agent-Worker Relationship & Consent Enforcement", () => {
    it("blocks Agent from accessing worker profile without ACTIVE relationship consent (403)", async () => {
      const agentUserId = VALID_UUID_1;
      const workerId = VALID_UUID_2;

      (query as any).mockImplementation((sql: string) => {
        if (sql.includes("FROM agent_profiles WHERE user_id")) {
          return Promise.resolve({ rows: [{ id: "agent-prof-1" }] });
        }
        if (sql.includes("FROM agent_worker_relationships")) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        agentsService.getWorkerForAgent(agentUserId, workerId)
      ).rejects.toThrow("You do not have active consent to access this worker's data");
    });

    it("blocks Agent from submitting application for worker without ACTIVE consent (403)", async () => {
      const agentUserId = VALID_UUID_1;
      const workerId = VALID_UUID_2;
      const opportunityId = VALID_UUID_3;

      (query as any).mockImplementation((sql: string) => {
        if (sql.includes("FROM agent_profiles WHERE user_id")) {
          return Promise.resolve({ rows: [{ id: "agent-prof-1" }] });
        }
        if (sql.includes("FROM agent_worker_relationships")) {
          return Promise.resolve({ rows: [{ status: "REVOKED" }] });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        agentsService.submitAssistedApplication(agentUserId, {
          workerId,
          workOpportunityId: opportunityId,
        })
      ).rejects.toThrow("You do not have active consent to access this worker's data");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. PAYMENTS & REFUND IDOR PROTECTION
  // ─────────────────────────────────────────────────────────────
  describe("6. Payments Authorization & Cash PIN Confidentiality", () => {
    it("prevents non-payer user from refunding a payment (403)", async () => {
      const maliciousUserId = VALID_UUID_2;
      const paymentId = VALID_UUID_3;

      (query as any).mockImplementation((sql: string) => {
        if (sql.includes("FROM payment_records")) {
          return Promise.resolve({
            rows: [
              {
                id: paymentId,
                payer_id: VALID_UUID_1, // Legitimate payer!
                status: "CONFIRMED",
                payment_method: "RAZORPAY",
                amount: 500,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        paymentsService.refundPayment(maliciousUserId, paymentId, {
          reason: "Attacking payment refund",
        })
      ).rejects.toThrow("Only the payer can initiate a refund");
    });

    it("does not expose unverified cash PIN in standard payment record responses", () => {
      // Direct inspection of mapRowToResponse mapping logic
      const unverifiedRow = {
        id: VALID_UUID_1,
        assignment_id: VALID_UUID_2,
        payer_id: VALID_UUID_1,
        payee_id: VALID_UUID_2,
        amount: "500.00",
        amount_paise: "50000",
        status: "PENDING",
        payment_method: "CASH",
        payment_pin: "7890", // Secret PIN in DB
        payment_pin_attempts: 0,
        payment_pin_verified_at: null, // NOT verified yet!
      };

      const mapped = (paymentsService as any).mapRowToResponse(unverifiedRow);
      // Secret PIN must NOT be in mapped response
      expect(mapped.paymentPin).toBeUndefined();
    });
  });
});
