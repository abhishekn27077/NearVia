import { describe, it, expect, vi, beforeEach } from "vitest";
import { assignmentsService } from "../src/modules/assignments/service";
import { AssignmentStatus, UserRole } from "@nearvia/types";
import * as db from "../src/db";
import { AppError } from "../src/middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";

vi.mock("../src/db", () => ({
  query: vi.fn(),
  withTransaction: vi.fn(async (cb) => {
    const mockClient = { query: vi.fn() };
    return cb(mockClient);
  }),
  pool: { end: vi.fn() },
}));

describe("Phase 6 — Work Execution, Job PIN, Evidence & Safety Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBaseRow = {
    id: "asn_phase6_01",
    work_opportunity_id: "wo_phase6_01",
    worker_id: "wp_phase6_01",
    provider_id: "pp_phase6_01",
    worker_user_id: "usr_worker_01",
    provider_user_id: "usr_provider_01",
    application_id: "app_phase6_01",
    status: "CONFIRMED",
    assigned_at: new Date().toISOString(),
    confirmed_at: new Date().toISOString(),
    checked_in_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    started_at: new Date(Date.now() - 7000000).toISOString(),
    checked_out_at: null,
    worked_minutes: null,
    completed_at: null,
    cancelled_at: null,
    no_show_at: null,
    cancelled_by: null,
    cancellation_reason: null,
    completion_notes: null,
    check_in_distance_meters: 15,
    job_pin: "7419",
    job_pin_attempts: 0,
    job_pin_verified_at: null,
    agreed_wage: 1500,
    final_wage_paid: null,
    payment_status: "PENDING",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    title: "Store Setup & Merchandising",
    description: "Retail merchandising task",
    work_type: "TASK",
    urgency: "NORMAL",
    work_date: new Date().toISOString().split("T")[0],
    start_time: "09:00",
    end_time: "17:00",
    duration_hours: 8,
    address_approximate: "Koramangala 4th Block",
    instructions: "Report to front desk",
    responsibilities: "Arranging clothing racks",
    opportunity_latitude: 12.9352,
    opportunity_longitude: 77.6245,
    provider_full_name: "Retail Hub",
    provider_business_name: "Retail Hub Pvt Ltd",
    provider_contact_phone: "+919876543210",
    worker_full_name: "Ramesh Kumar",
    worker_avatar_url: null,
    worker_contact_phone: "+919123456780",
  };

  // ----------------------------------------------------
  // 1. Job PIN Verification Tests
  // ----------------------------------------------------
  describe("Job PIN Verification", () => {
    it("successfully verifies correct 4-digit Job PIN on site", async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const client = {
          query: vi.fn().mockImplementation((text: string) => {
            if (text.includes("SELECT") && text.includes("assignments")) {
              return { rows: [mockBaseRow] };
            }
            if (text.includes("UPDATE assignments")) {
              return { rowCount: 1 };
            }
            if (text.includes("INSERT INTO audit_logs")) {
              return { rowCount: 1 };
            }
            return { rows: [] };
          }),
        };
        return cb(client);
      });

      const result = await assignmentsService.verifyJobPin("usr_worker_01", "asn_phase6_01", {
        jobPin: "7419",
      });

      expect(result).toBeDefined();
      expect(result.id).toBe("asn_phase6_01");
    });

    it("rejects invalid Job PIN and tracks attempts", async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const client = {
          query: vi.fn().mockImplementation((text: string) => {
            if (text.includes("SELECT") && text.includes("assignments")) {
              return { rows: [mockBaseRow] };
            }
            if (text.includes("UPDATE assignments")) {
              return { rowCount: 1 };
            }
            return { rows: [] };
          }),
        };
        return cb(client);
      });

      await expect(
        assignmentsService.verifyJobPin("usr_worker_01", "asn_phase6_01", { jobPin: "0000" })
      ).rejects.toThrow(/Invalid Job PIN/);
    });

    it("locks out verification when max attempts (5) exceeded", async () => {
      const lockedRow = { ...mockBaseRow, job_pin_attempts: 5 };
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const client = {
          query: vi.fn().mockImplementation((text: string) => {
            if (text.includes("SELECT") && text.includes("assignments")) {
              return { rows: [lockedRow] };
            }
            return { rows: [] };
          }),
        };
        return cb(client);
      });

      await expect(
        assignmentsService.verifyJobPin("usr_worker_01", "asn_phase6_01", { jobPin: "7419" })
      ).rejects.toThrow(/Maximum PIN verification attempts exceeded/);
    });

    it("rejects non-assigned user from verifying PIN", async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const client = {
          query: vi.fn().mockImplementation((text: string) => {
            if (text.includes("SELECT") && text.includes("assignments")) {
              return { rows: [mockBaseRow] };
            }
            return { rows: [] };
          }),
        };
        return cb(client);
      });

      await expect(
        assignmentsService.verifyJobPin("usr_random_intruder", "asn_phase6_01", { jobPin: "7419" })
      ).rejects.toThrow(/Only the assigned worker/);
    });
  });

  // ----------------------------------------------------
  // 2. Check-Out & Duration Computation Tests
  // ----------------------------------------------------
  describe("Worker Check-Out", () => {
    it("calculates worked duration and transitions to completed", async () => {
      const inProgressRow = { ...mockBaseRow, status: "IN_PROGRESS" };
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const client = {
          query: vi.fn().mockImplementation((text: string) => {
            if (text.includes("SELECT") && text.includes("assignments")) {
              return { rows: [inProgressRow] };
            }
            if (text.includes("COUNT(*) AS uncompleted")) {
              return { rows: [{ uncompleted: 0 }] };
            }
            return { rows: [], rowCount: 1 };
          }),
        };
        return cb(client);
      });

      const result = await assignmentsService.checkOut("usr_worker_01", "asn_phase6_01", {
        completionNotes: "All clothing racks organized and tagged.",
      });

      expect(result).toBeDefined();
      expect(result.id).toBe("asn_phase6_01");
    });

    it("rejects check-out if assignment is already completed", async () => {
      const completedRow = { ...mockBaseRow, status: "COMPLETED" };
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const client = {
          query: vi.fn().mockImplementation((text: string) => {
            if (text.includes("SELECT") && text.includes("assignments")) {
              return { rows: [completedRow] };
            }
            return { rows: [] };
          }),
        };
        return cb(client);
      });

      await expect(
        assignmentsService.checkOut("usr_worker_01", "asn_phase6_01", {})
      ).rejects.toThrow(/already been completed/);
    });
  });

  // ----------------------------------------------------
  // 3. Photo Evidence Upload & Retrieval Tests
  // ----------------------------------------------------
  describe("Photo Evidence Management", () => {
    it("allows assigned worker to upload before/after photos", async () => {
      vi.mocked(db.query).mockImplementationOnce(async (text: string) => {
        if (text.includes("SELECT") && text.includes("assignments")) {
          return { rows: [mockBaseRow], rowCount: 1, command: "", oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
      });

      vi.mocked(db.query).mockImplementationOnce(async () => {
        return {
          rows: [
            {
              id: "ev_01",
              assignment_id: "asn_phase6_01",
              uploaded_by: "usr_worker_01",
              evidence_type: "BEFORE",
              file_url: "https://storage.nearvia.app/photos/before_01.jpg",
              notes: "Initial inventory setup",
              created_at: new Date().toISOString(),
            },
          ],
          rowCount: 1,
          command: "",
          oid: 0,
          fields: [],
        };
      });

      const evidence = await assignmentsService.uploadJobEvidence("usr_worker_01", "asn_phase6_01", {
        evidenceType: "BEFORE",
        fileUrl: "https://storage.nearvia.app/photos/before_01.jpg",
        notes: "Initial inventory setup",
      });

      expect(evidence.id).toBe("ev_01");
      expect(evidence.evidenceType).toBe("BEFORE");
      expect(evidence.fileUrl).toBe("https://storage.nearvia.app/photos/before_01.jpg");
    });

    it("blocks unauthorized user from accessing job evidence", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockBaseRow],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: [],
      });

      await expect(
        assignmentsService.getJobEvidence("usr_random_intruder", "asn_phase6_01")
      ).rejects.toThrow(/not authorized/);
    });
  });

  // ----------------------------------------------------
  // 4. Privacy-Safe Active Job Snapshot
  // ----------------------------------------------------
  describe("Privacy-Safe Active Job Snapshot", () => {
    it("returns public shift tracking snapshot without private coordinates or phone numbers", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockBaseRow],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: [],
      });

      const shared = await assignmentsService.getSharedActiveJob("asn_phase6_01");

      expect(shared.id).toBe("asn_phase6_01");
      expect(shared.title).toBe("Store Setup & Merchandising");
      expect(shared.providerName).toBe("Retail Hub Pvt Ltd");
      expect(shared.addressApproximate).toBe("Koramangala 4th Block");
      // Verify no sensitive fields leaked
      expect((shared as any).providerContactPhone).toBeUndefined();
      expect((shared as any).workerContactPhone).toBeUndefined();
      expect((shared as any).opportunityLatitude).toBeUndefined();
      expect((shared as any).opportunityLongitude).toBeUndefined();
    });
  });
});
