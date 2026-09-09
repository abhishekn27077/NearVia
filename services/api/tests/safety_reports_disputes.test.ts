import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportsService } from "../src/modules/reports/service";
import { disputesService } from "../src/modules/disputes/service";
import * as db from "../src/db";
import { AppError } from "../src/middleware/errorHandler";
import {
  submitReportSchema,
  updateReportStatusSchema,
  createDisputeSchema,
  updateDisputeStatusSchema,
} from "@nearvia/validation";

vi.mock("../src/db", () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

describe("Phase 13: Safety, Reports & Disputes Full Verification Suite", () => {
  const workerUserId = "worker-user-p13-111";
  const providerUserId = "provider-user-p13-222";
  const thirdPartyUserId = "intruder-user-p13-333";
  const adminUserId = "admin-user-p13-999";
  const assignmentId = "asg-uuid-p13-444";
  const reportId = "rep-uuid-p13-777";
  const disputeId = "disp-uuid-p13-888";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Target Existence & Anti-Abuse in Reports", () => {
    it("should reject report when target USER does not exist (404 NOT_FOUND)", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT id FROM users WHERE id = $1")) {
          return { rowCount: 0, rows: [] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      await expect(
        reportsService.submitReport(workerUserId, {
          targetType: "USER",
          targetId: "non-existent-user",
          category: "FRAUD",
          reason: "Suspicious behavior",
          description: "Fake profile information provided",
        })
      ).rejects.toThrow(AppError);
    });

    it("should reject report when user attempts to report themselves (400 CANNOT_REPORT_SELF)", async () => {
      await expect(
        reportsService.submitReport(workerUserId, {
          targetType: "USER",
          targetId: workerUserId,
          category: "HARASSMENT",
          reason: "Self report",
          description: "Testing self reporting",
        })
      ).rejects.toThrow(AppError);
    });

    it("should reject duplicate active report on the same target (409 CONFLICT)", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT id FROM users WHERE id = $1")) {
          return { rowCount: 1, rows: [{ id: providerUserId }] } as any;
        }
        if (sql.includes("SELECT id FROM reports")) {
          return { rowCount: 1, rows: [{ id: "existing-report-123" }] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      await expect(
        reportsService.submitReport(workerUserId, {
          targetType: "USER",
          targetId: providerUserId,
          category: "HARASSMENT",
          reason: "Harassment at work",
          description: "Verbal abuse during shift",
        })
      ).rejects.toThrow(/active report/);
    });
  });

  describe("2. Assignment IDOR Protection in Reports", () => {
    it("should reject report on assignment if reporter is not worker or provider (403 FORBIDDEN)", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM assignments asn")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: assignmentId,
                worker_user_id: workerUserId,
                provider_user_id: providerUserId,
              },
            ],
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      await expect(
        reportsService.submitReport(thirdPartyUserId, {
          targetType: "ASSIGNMENT",
          targetId: assignmentId,
          category: "UNSAFE_WORK",
          reason: "Unsafe environment",
          description: "Intruder attempting to report another person's job",
        })
      ).rejects.toThrow("You are not a participant in this assignment and cannot file an assignment report");
    });

    it("should allow worker participant to report assignment safety issue", async () => {
      const auditQueries: string[] = [];
      vi.mocked(db.query).mockImplementation(async (sql: string, params: any) => {
        if (sql.includes("FROM assignments asn")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: assignmentId,
                worker_user_id: workerUserId,
                provider_user_id: providerUserId,
              },
            ],
          } as any;
        }
        if (sql.includes("SELECT id FROM reports")) {
          return { rowCount: 0, rows: [] } as any;
        }
        if (sql.includes("INSERT INTO reports")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: reportId,
                reporter_id: workerUserId,
                target_type: "ASSIGNMENT",
                target_id: assignmentId,
                category: "UNSAFE_WORK",
                reason: "Unsafe job site conditions",
                description: "Exposed high-voltage wiring without safety protective gear",
                evidence_urls: ["https://example.com/photo1.jpg"],
                status: "OPEN",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        if (sql.includes("INSERT INTO audit_logs")) {
          auditQueries.push(sql);
          return { rowCount: 1, rows: [] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const report = await reportsService.submitReport(workerUserId, {
        targetType: "ASSIGNMENT",
        targetId: assignmentId,
        category: "UNSAFE_WORK",
        reason: "Unsafe job site conditions",
        description: "Exposed high-voltage wiring without safety protective gear",
        evidenceUrls: ["https://example.com/photo1.jpg"],
      });

      expect(report.id).toBe(reportId);
      expect(report.status).toBe("OPEN");
      expect(report.category).toBe("UNSAFE_WORK");
      expect(report.targetType).toBe("ASSIGNMENT");
      expect(auditQueries.length).toBeGreaterThan(0);
    });

    it("should allow provider participant to report worker no-show", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM assignments asn")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: assignmentId,
                worker_user_id: workerUserId,
                provider_user_id: providerUserId,
              },
            ],
          } as any;
        }
        if (sql.includes("SELECT id FROM reports")) {
          return { rowCount: 0, rows: [] } as any;
        }
        if (sql.includes("INSERT INTO reports")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: reportId,
                reporter_id: providerUserId,
                target_type: "ASSIGNMENT",
                target_id: assignmentId,
                category: "NO_SHOW",
                reason: "Worker did not report for shift",
                description: "Shift scheduled at 9:00 AM, worker was absent without notice",
                evidence_urls: [],
                status: "OPEN",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        if (sql.includes("INSERT INTO audit_logs")) {
          return { rowCount: 1, rows: [] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const report = await reportsService.submitReport(providerUserId, {
        targetType: "ASSIGNMENT",
        targetId: assignmentId,
        category: "NO_SHOW",
        reason: "Worker did not report for shift",
        description: "Shift scheduled at 9:00 AM, worker was absent without notice",
      });

      expect(report.id).toBe(reportId);
      expect(report.reporterId).toBe(providerUserId);
      expect(report.category).toBe("NO_SHOW");
      expect(report.status).toBe("OPEN");
    });
  });

  describe("3. Dispute Creation IDOR, Counterparty & Anti-Abuse", () => {
    it("should reject dispute if initiator is not worker or provider (403 FORBIDDEN)", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM assignments a") && sql.includes("JOIN work_opportunities wo")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: assignmentId,
                worker_user_id: workerUserId,
                provider_user_id: providerUserId,
                assignment_status: "COMPLETED",
                agreed_wage: "500.00",
                payment_status: "PENDING",
                work_opportunity_id: "wo-1",
                opportunity_title: "Test Job",
                work_type: "EVENT_STAFFING",
              },
            ],
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      await expect(
        disputesService.createDispute(thirdPartyUserId, {
          assignmentId,
          reason: "PAYMENT_DISAGREEMENT",
          description: "Intruder attempting to dispute stranger's payment",
        })
      ).rejects.toThrow("You are not a participant in this assignment and cannot open a dispute");
    });

    it("should reject duplicate active dispute on same assignment (409 CONFLICT)", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM assignments a") && sql.includes("JOIN work_opportunities wo")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: assignmentId,
                worker_user_id: workerUserId,
                provider_user_id: providerUserId,
                assignment_status: "SETTLEMENT_PENDING",
                agreed_wage: "500.00",
                payment_status: "PENDING",
                work_opportunity_id: "wo-1",
                opportunity_title: "Test Job",
                work_type: "EVENT_STAFFING",
              },
            ],
          } as any;
        }
        if (sql.includes("FROM disputes") && sql.includes("initiator_id = $2")) {
          return { rowCount: 1, rows: [{ id: "existing-dispute-99" }] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      await expect(
        disputesService.createDispute(workerUserId, {
          assignmentId,
          reason: "PAYMENT_DISAGREEMENT",
          description: "Disputing unpaid overtime hours",
        })
      ).rejects.toThrow("An active dispute is already open for this assignment by you");
    });

    it("should correctly identify respondent and create dispute when worker initiates", async () => {
      let insertedRespondentId = "";
      vi.mocked(db.query).mockImplementation(async (sql: string, params: any) => {
        if (sql.includes("FROM assignments a") && sql.includes("JOIN work_opportunities wo")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: assignmentId,
                worker_user_id: workerUserId,
                provider_user_id: providerUserId,
                assignment_status: "COMPLETED",
                agreed_wage: "500.00",
                payment_status: "PENDING",
                work_opportunity_id: "wo-1",
                opportunity_title: "Test Job",
                work_type: "EVENT_STAFFING",
              },
            ],
          } as any;
        }
        if (sql.includes("FROM disputes") && sql.includes("initiator_id = $2")) {
          return { rowCount: 0, rows: [] } as any;
        }
        if (sql.includes("INSERT INTO disputes")) {
          insertedRespondentId = params[2]; // respondent_id is 3rd param ($3)
          return {
            rowCount: 1,
            rows: [
              {
                id: disputeId,
                assignment_id: assignmentId,
                initiator_id: workerUserId,
                respondent_id: providerUserId,
                reason: "PAYMENT_DISAGREEMENT",
                description: "Employer reduced cash payout after completion without notice",
                evidence_urls: ["https://example.com/receipt.jpg"],
                status: "OPEN",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        if (sql.includes("INSERT INTO audit_logs")) {
          return { rowCount: 1, rows: [] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const dispute = await disputesService.createDispute(workerUserId, {
        assignmentId,
        reason: "PAYMENT_DISAGREEMENT",
        description: "Employer reduced cash payout after completion without notice",
        evidenceUrls: ["https://example.com/receipt.jpg"],
      });

      expect(dispute.id).toBe(disputeId);
      expect(dispute.initiatorId).toBe(workerUserId);
      expect(dispute.respondentId).toBe(providerUserId);
      expect(insertedRespondentId).toBe(providerUserId);
      expect(dispute.status).toBe("OPEN");
    });
  });

  describe("4. Admin Moderation & Resolution Workflows", () => {
    it("should allow admin to update report status to UNDER_REVIEW and then RESOLVED", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string, params: any) => {
        if (sql.includes("SELECT * FROM reports WHERE id = $1")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: reportId,
                reporter_id: workerUserId,
                target_type: "ASSIGNMENT",
                target_id: assignmentId,
                category: "UNSAFE_WORK",
                status: "OPEN",
              },
            ],
          } as any;
        }
        if (sql.includes("UPDATE reports")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: reportId,
                reporter_id: workerUserId,
                target_type: "ASSIGNMENT",
                target_id: assignmentId,
                category: "UNSAFE_WORK",
                reason: "Unsafe environment",
                description: "Site audit required",
                status: params[0],
                reviewed_by: adminUserId,
                resolution: params[1],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        if (sql.includes("INSERT INTO audit_logs")) {
          return { rowCount: 1, rows: [] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      // 1. Mark Under Review
      const underReview = await reportsService.updateReportStatus(reportId, adminUserId, {
        status: "UNDER_REVIEW",
        resolution: "Trust & safety officer reviewing site hazard logs",
      });
      expect(underReview.status).toBe("UNDER_REVIEW");

      // 2. Resolve
      const resolved = await reportsService.updateReportStatus(reportId, adminUserId, {
        status: "RESOLVED",
        resolution: "Provider warned and safety remediation confirmed on-site",
      });
      expect(resolved.status).toBe("RESOLVED");
    });

    it("should allow admin to arbitrate dispute to UNDER_REVIEW and then RESOLVED", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string, params: any) => {
        if (sql.includes("SELECT * FROM disputes WHERE id = $1")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: disputeId,
                assignment_id: assignmentId,
                initiator_id: workerUserId,
                respondent_id: providerUserId,
                status: "OPEN",
              },
            ],
          } as any;
        }
        if (sql.includes("UPDATE disputes")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: disputeId,
                assignment_id: assignmentId,
                initiator_id: workerUserId,
                respondent_id: providerUserId,
                reason: "PAYMENT_DISAGREEMENT",
                description: "Disputed wage deduction",
                status: params[0],
                resolution_notes: params[1],
                resolved_by: adminUserId,
                resolved_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        if (sql.includes("INSERT INTO audit_logs")) {
          return { rowCount: 1, rows: [] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      // 1. Under Review
      const underReview = await disputesService.updateDisputeStatus(disputeId, adminUserId, {
        status: "UNDER_REVIEW",
        resolutionNotes: "Contacted provider to clarify reported work completion hours",
      });
      expect(underReview.status).toBe("UNDER_REVIEW");

      // 2. Resolve
      const resolved = await disputesService.updateDisputeStatus(disputeId, adminUserId, {
        status: "RESOLVED",
        resolutionNotes: "GPS check-in verified worker was present for 8 full hours; full agreed wage awarded.",
      });
      expect(resolved.status).toBe("RESOLVED");
    });
  });

  describe("5. Schema Validation & Input Integrity", () => {
    it("should reject report with invalid category", () => {
      const result = submitReportSchema.safeParse({
        targetType: "USER",
        targetId: "123e4567-e89b-12d3-a456-426614174000",
        category: "INVALID_RANDOM_CATEGORY",
        reason: "Something happened",
        description: "Valid length description for testing validation rules",
      });
      expect(result.success).toBe(false);
    });

    it("should reject report with reason that is too short (< 3 chars)", () => {
      const result = submitReportSchema.safeParse({
        targetType: "USER",
        targetId: "123e4567-e89b-12d3-a456-426614174000",
        category: "HARASSMENT",
        reason: "No",
        description: "Valid description",
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid report payload with evidence URLs", () => {
      const result = submitReportSchema.safeParse({
        targetType: "ASSIGNMENT",
        targetId: "123e4567-e89b-12d3-a456-426614174000",
        category: "UNSAFE_WORK",
        reason: "Lack of safety harness",
        description: "Scaffolding was erected without mandatory fall arrest equipment",
        evidenceUrls: ["https://example.com/site_hazard.png"],
      });
      expect(result.success).toBe(true);
    });

    it("should reject dispute with invalid reason", () => {
      const result = createDisputeSchema.safeParse({
        assignmentId: "123e4567-e89b-12d3-a456-426614174000",
        reason: "JUST_BECAUSE",
        description: "Valid length description for testing validation rules",
      });
      expect(result.success).toBe(false);
    });

    it("should reject dispute with description that is too short (< 10 chars)", () => {
      const result = createDisputeSchema.safeParse({
        assignmentId: "123e4567-e89b-12d3-a456-426614174000",
        reason: "WORK_NOT_COMPLETED",
        description: "Too short",
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid dispute payload with WORK_NOT_COMPLETED reason", () => {
      const result = createDisputeSchema.safeParse({
        assignmentId: "123e4567-e89b-12d3-a456-426614174000",
        reason: "WORK_NOT_COMPLETED",
        description: "Worker left 3 hours early and plumbing fixtures were left unconnected",
      });
      expect(result.success).toBe(true);
    });
  });
});
