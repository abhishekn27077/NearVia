import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportsService } from "../src/modules/reports/service";
import { disputesService } from "../src/modules/disputes/service";
import * as db from "../src/db";
import { AppError } from "../src/middleware/errorHandler";

vi.mock("../src/db", () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

describe("Phase 15: Reviews, Disputes & Safety Subsystem", () => {
  const workerUserId = "worker-user-111";
  const providerUserId = "provider-user-222";
  const thirdPartyUserId = "intruder-user-333";
  const adminUserId = "admin-user-999";
  const assignmentId = "assign-uuid-555";
  const reportId = "report-uuid-777";
  const disputeId = "dispute-uuid-888";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Reports Subsystem (Safety & Incident Reporting)", () => {
    it("should allow worker to submit a report against a provider", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string, params: any) => {
        if (sql.includes("SELECT id FROM users WHERE id = $1")) {
          return { rowCount: 1, rows: [{ id: providerUserId }] } as any;
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
                target_type: "USER",
                target_id: providerUserId,
                category: "UNSAFE_WORK",
                reason: "Unsafe environment",
                description: "Lack of safety gear at jobsite",
                evidence_urls: ["https://example.com/proof.jpg"],
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

      const report = await reportsService.submitReport(workerUserId, {
        targetType: "USER",
        targetId: providerUserId,
        category: "UNSAFE_WORK",
        reason: "Unsafe environment",
        description: "Lack of safety gear at jobsite",
        evidenceUrls: ["https://example.com/proof.jpg"],
      });

      expect(report.id).toBe(reportId);
      expect(report.reporterId).toBe(workerUserId);
      expect(report.targetType).toBe("USER");
      expect(report.category).toBe("UNSAFE_WORK");
      expect(report.status).toBe("OPEN");
    });

    it("should allow provider to report a worker for a no-show", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT id FROM users WHERE id = $1")) {
          return { rowCount: 1, rows: [{ id: workerUserId }] } as any;
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
                target_type: "USER",
                target_id: workerUserId,
                category: "NO_SHOW",
                reason: "Worker did not show up",
                status: "OPEN",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const report = await reportsService.submitReport(providerUserId, {
        targetType: "USER",
        targetId: workerUserId,
        category: "NO_SHOW",
        reason: "Worker did not show up",
      });

      expect(report.category).toBe("NO_SHOW");
      expect(report.status).toBe("OPEN");
    });

    it("should reject self-reporting", async () => {
      await expect(
        reportsService.submitReport(workerUserId, {
          targetType: "USER",
          targetId: workerUserId, // Self!
          category: "HARASSMENT",
          reason: "Self test",
        })
      ).rejects.toThrow(/cannot report yourself/);
    });

    it("should reject report if target entity does not exist", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      } as any);

      await expect(
        reportsService.submitReport(workerUserId, {
          targetType: "WORK_OPPORTUNITY",
          targetId: "00000000-0000-0000-0000-000000000000",
          category: "FRAUD",
          reason: "Scam posting",
        })
      ).rejects.toThrow(/not found/);
    });

    it("should prevent duplicate active reports on the same target by same reporter", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT id FROM users")) {
          return { rowCount: 1, rows: [{ id: providerUserId }] } as any;
        }
        if (sql.includes("SELECT id FROM reports")) {
          return { rowCount: 1, rows: [{ id: "existing-report" }] } as any; // Active duplicate!
        }
        return { rowCount: 0, rows: [] } as any;
      });

      await expect(
        reportsService.submitReport(workerUserId, {
          targetType: "USER",
          targetId: providerUserId,
          category: "FRAUD",
          reason: "Repeated spam report",
        })
      ).rejects.toThrow(/already have an active report/);
    });

    it("should prevent unauthorized user from viewing someone else's report", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: reportId,
            reporter_id: workerUserId,
            target_type: "USER",
            target_id: providerUserId,
            status: "OPEN",
          },
        ],
      } as any);

      await expect(
        reportsService.getReportById(thirdPartyUserId, "WORKER", reportId)
      ).rejects.toThrow(/not authorized/);
    });

    it("should allow ADMIN to view and update report status with resolution", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT * FROM reports WHERE id = $1")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: reportId,
                reporter_id: workerUserId,
                target_type: "USER",
                target_id: providerUserId,
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
                target_type: "USER",
                target_id: providerUserId,
                status: "RESOLVED",
                resolution: "Investigated and employer warned.",
                reviewed_by: adminUserId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        return { rowCount: 1, rows: [] } as any;
      });

      const updated = await reportsService.updateReportStatus(adminUserId, reportId, {
        status: "RESOLVED",
        resolution: "Investigated and employer warned.",
      });

      expect(updated.status).toBe("RESOLVED");
      expect(updated.resolution).toBe("Investigated and employer warned.");
    });
  });

  describe("2. Disputes Subsystem (Transaction & Work Disputes)", () => {
    it("should allow worker participant to open dispute against an assignment", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM assignments a")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: assignmentId,
                assignment_status: "COMPLETED",
                agreed_wage: 800,
                payment_status: "PENDING",
                work_opportunity_id: "wo-1",
                opportunity_title: "Event Steward",
                work_type: "SHIFT",
                worker_user_id: workerUserId,
                provider_user_id: providerUserId,
              },
            ],
          } as any;
        }
        if (sql.includes("SELECT id FROM disputes")) {
          return { rowCount: 0, rows: [] } as any;
        }
        if (sql.includes("INSERT INTO disputes")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: disputeId,
                assignment_id: assignmentId,
                initiator_id: workerUserId,
                respondent_id: providerUserId,
                reason: "PAYMENT_DISAGREEMENT",
                description: "Shift was completed 2 days ago but wage was not paid",
                evidence_urls: ["https://example.com/timesheet.png"],
                status: "OPEN",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        return { rowCount: 1, rows: [] } as any;
      });

      const dispute = await disputesService.createDispute(workerUserId, {
        assignmentId,
        reason: "PAYMENT_DISAGREEMENT",
        description: "Shift was completed 2 days ago but wage was not paid",
        evidenceUrls: ["https://example.com/timesheet.png"],
      });

      expect(dispute.id).toBe(disputeId);
      expect(dispute.initiatorId).toBe(workerUserId);
      expect(dispute.respondentId).toBe(providerUserId);
      expect(dispute.reason).toBe("PAYMENT_DISAGREEMENT");
      expect(dispute.status).toBe("OPEN");
    });

    it("should reject non-participant from opening dispute", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: assignmentId,
            worker_user_id: workerUserId,
            provider_user_id: providerUserId,
          },
        ],
      } as any);

      await expect(
        disputesService.createDispute(thirdPartyUserId, {
          assignmentId,
          reason: "WORK_NOT_COMPLETED",
          description: "Intruder attempting to disrupt",
        })
      ).rejects.toThrow(/not a participant/);
    });

    it("should prevent duplicate active dispute on same assignment by same user", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM assignments a")) {
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
        if (sql.includes("SELECT id FROM disputes")) {
          return { rowCount: 1, rows: [{ id: "existing-dispute" }] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      await expect(
        disputesService.createDispute(workerUserId, {
          assignmentId,
          reason: "WORK_NOT_COMPLETED",
          description: "Second duplicate dispute attempt",
        })
      ).rejects.toThrow(/already open/);
    });

    it("should allow both initiator and respondent to view dispute details", async () => {
      vi.mocked(db.query).mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            id: disputeId,
            assignment_id: assignmentId,
            initiator_id: workerUserId,
            respondent_id: providerUserId,
            reason: "PAYMENT_DISAGREEMENT",
            description: "Wage delayed",
            status: "OPEN",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            opportunity_title: "Event Steward",
            work_type: "SHIFT",
            agreed_wage: 800,
          },
        ],
      } as any);

      // Initiator can view
      const dispWorker = await disputesService.getDisputeById(workerUserId, "WORKER", disputeId);
      expect(dispWorker.id).toBe(disputeId);

      // Respondent can view
      const dispProv = await disputesService.getDisputeById(providerUserId, "PROVIDER", disputeId);
      expect(dispProv.id).toBe(disputeId);
    });

    it("should reject third party from viewing dispute details", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: disputeId,
            initiator_id: workerUserId,
            respondent_id: providerUserId,
          },
        ],
      } as any);

      await expect(
        disputesService.getDisputeById(thirdPartyUserId, "WORKER", disputeId)
      ).rejects.toThrow(/not authorized/);
    });

    it("should allow ADMIN to resolve dispute and record resolution notes", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT * FROM disputes WHERE id = $1")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: disputeId,
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
                initiator_id: workerUserId,
                respondent_id: providerUserId,
                status: "RESOLVED",
                resolution_notes: "Reviewed GPS check-in logs. Provider instructed to settle.",
                resolved_by: adminUserId,
                resolved_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        return { rowCount: 1, rows: [] } as any;
      });

      const resolved = await disputesService.updateDisputeStatus(adminUserId, disputeId, {
        status: "RESOLVED",
        resolutionNotes: "Reviewed GPS check-in logs. Provider instructed to settle.",
      });

      expect(resolved.status).toBe("RESOLVED");
      expect(resolved.resolutionNotes).toBe("Reviewed GPS check-in logs. Provider instructed to settle.");
    });
  });
});
