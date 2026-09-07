import { describe, it, expect, vi, beforeEach } from "vitest";
import { assignmentsService } from "../src/modules/assignments/service";
import { AssignmentStatus, UserRole } from "@nearvia/types";
import * as db from "../src/db";
import { AppError } from "../src/middleware/errorHandler";

vi.mock("../src/db", () => ({
  query: vi.fn(),
  withTransaction: vi.fn(async (cb) => {
    const mockClient = { query: vi.fn() };
    return cb(mockClient);
  }),
  pool: { end: vi.fn() },
}));

describe("Phase 10 — Work Execution, Attendance & Completion Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBaseRow = {
    id: "asn_01",
    work_opportunity_id: "wo_01",
    worker_id: "wp_01",
    provider_id: "pp_01",
    worker_user_id: "usr_worker_01",
    provider_user_id: "usr_provider_01",
    application_id: "app_01",
    status: "ASSIGNED",
    assigned_at: new Date().toISOString(),
    confirmed_at: null,
    checked_in_at: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    no_show_at: null,
    cancelled_by: null,
    cancellation_reason: null,
    completion_notes: null,
    check_in_distance_meters: null,
    agreed_wage: 600,
    final_wage_paid: null,
    payment_status: "PENDING",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    title: "Kitchen Assistant",
    description: "Need helper for 4 hours",
    work_type: "SHIFT",
    urgency: "NORMAL",
    work_date: new Date().toISOString().split("T")[0],
    start_time: "10:00",
    end_time: "14:00",
    duration_hours: 4,
    address_approximate: "Indiranagar 100ft Rd",
    instructions: "Wear clean apron",
    responsibilities: "Chopping vegetables",
    opportunity_latitude: 12.9716,
    opportunity_longitude: 77.5946,
    provider_full_name: "Fresh Bites Cafe",
    provider_business_name: "Fresh Bites Pvt Ltd",
    provider_contact_phone: "+919876543210",
    worker_full_name: "Suresh Kumar",
    worker_avatar_url: null,
    worker_contact_phone: "+919876543211",
  };

  describe("1. Worker Confirmation Workflow (ASSIGNED -> CONFIRMED)", () => {
    it("Test 1: Assigned worker can confirm assignment", async () => {
      let currentStatus = "ASSIGNED";
      const mockClientQuery = vi.fn(async (sql: string) => {
        if (sql.includes("SELECT") && sql.includes("FROM assignments")) {
          return {
            rows: [{ ...mockBaseRow, status: currentStatus }],
          } as any;
        }
        if (sql.includes("UPDATE assignments")) {
          currentStatus = "CONFIRMED";
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        return cb({ query: mockClientQuery } as any);
      });

      const res = await assignmentsService.confirmAssignment(
        "usr_worker_01",
        "asn_01",
      );
      expect(res.id).toBe("asn_01");
      expect(res.status).toBe(AssignmentStatus.CONFIRMED);
    });

    it("Test 2: Unassigned worker cannot confirm assignment (403)", async () => {
      const mockClientQuery = vi.fn(async () => ({
        rows: [{ ...mockBaseRow, status: "ASSIGNED" }],
      }));

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        return cb({ query: mockClientQuery } as any);
      });

      await expect(
        assignmentsService.confirmAssignment("usr_other_worker", "asn_01"),
      ).rejects.toThrowError(AppError);
    });

    it("Test 3: Cannot confirm assignment not in ASSIGNED status", async () => {
      const mockClientQuery = vi.fn(async () => ({
        rows: [{ ...mockBaseRow, status: "IN_PROGRESS" }],
      }));

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        return cb({ query: mockClientQuery } as any);
      });

      await expect(
        assignmentsService.confirmAssignment("usr_worker_01", "asn_01"),
      ).rejects.toThrowError(AppError);
    });
  });

  describe("2. Check-In & Proximity Workflow (CONFIRMED -> CHECKED_IN)", () => {
    it("Test 4: Confirmed assignment can check in within proximity", async () => {
      let currentStatus = "CONFIRMED";
      const mockClientQuery = vi.fn(async (sql: string) => {
        if (sql.includes("SELECT") && sql.includes("FROM assignments")) {
          return {
            rows: [
              {
                ...mockBaseRow,
                status: currentStatus,
                work_date: new Date().toISOString().split("T")[0],
                start_time: "00:00", // open window for test
                duration_hours: 24,
              },
            ],
          } as any;
        }
        if (sql.includes("UPDATE assignments")) {
          currentStatus = "CHECKED_IN";
          return { rows: [] } as any;
        }
        if (sql.includes("INSERT INTO attendance_records")) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        return cb({ query: mockClientQuery } as any);
      });

      const res = await assignmentsService.checkIn("usr_worker_01", "asn_01", {
        latitude: 12.9718, // within ~50 meters of 12.9716, 77.5946
        longitude: 77.5948,
        notes: "Arrived at cafe entrance",
      });

      expect(res.status).toBe(AssignmentStatus.CHECKED_IN);
    });

    it("Test 5: Check-in outside proximity is rejected unless manual fallback requested", async () => {
      const mockClientQuery = vi.fn(async () => ({
        rows: [
          {
            ...mockBaseRow,
            status: "CONFIRMED",
            work_date: new Date().toISOString().split("T")[0],
            start_time: "00:00",
            duration_hours: 24,
          },
        ],
      }));

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        return cb({ query: mockClientQuery } as any);
      });

      // Coordinates ~30 km away in Bangalore
      await expect(
        assignmentsService.checkIn("usr_worker_01", "asn_01", {
          latitude: 13.2,
          longitude: 77.8,
        }),
      ).rejects.toThrowError(AppError);

      // With manualFallback=true, check-in succeeds
      let status = "CONFIRMED";
      mockClientQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT") && sql.includes("FROM assignments")) {
          return {
            rows: [
              {
                ...mockBaseRow,
                status: status,
                work_date: new Date().toISOString().split("T")[0],
                start_time: "00:00",
                duration_hours: 24,
              },
            ],
          } as any;
        }
        if (sql.includes("UPDATE assignments")) {
          status = "CHECKED_IN";
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      const manualRes = await assignmentsService.checkIn(
        "usr_worker_01",
        "asn_01",
        {
          latitude: 13.2,
          longitude: 77.8,
          manualFallback: true,
        },
      );
      expect(manualRes.status).toBe(AssignmentStatus.CHECKED_IN);
    });

    it("Test 6: Check-in cannot happen twice (already checked in)", async () => {
      const mockClientQuery = vi.fn(async () => ({
        rows: [{ ...mockBaseRow, status: "CHECKED_IN" }],
      }));

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        return cb({ query: mockClientQuery } as any);
      });

      await expect(
        assignmentsService.checkIn("usr_worker_01", "asn_01", {
          manualFallback: true,
        }),
      ).rejects.toThrowError(AppError);
    });
  });

  describe("3. Start Work Workflow (CHECKED_IN -> IN_PROGRESS)", () => {
    it("Test 7: Checked-in worker can start work and updates availability to BUSY", async () => {
      let currentStatus = "CHECKED_IN";
      const executedSqls: string[] = [];
      const mockClientQuery = vi.fn(async (sql: string) => {
        executedSqls.push(sql);
        if (sql.includes("SELECT") && sql.includes("FROM assignments")) {
          return {
            rows: [{ ...mockBaseRow, status: currentStatus }],
          } as any;
        }
        if (sql.includes("UPDATE assignments")) {
          currentStatus = "IN_PROGRESS";
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        return cb({ query: mockClientQuery } as any);
      });

      const res = await assignmentsService.startWork(
        "usr_worker_01",
        "asn_01",
        {},
      );
      expect(res.status).toBe(AssignmentStatus.IN_PROGRESS);

      // Verify worker availability updated to BUSY
      const workerBusyUpdate = executedSqls.some(
        (s) =>
          s.includes("UPDATE worker_profiles") &&
          s.includes("availability_status = 'BUSY'"),
      );
      expect(workerBusyUpdate).toBe(true);

      // Verify work opportunity updated to IN_PROGRESS
      const woProgressUpdate = executedSqls.some(
        (s) =>
          s.includes("UPDATE work_opportunities") &&
          s.includes("status = 'IN_PROGRESS'"),
      );
      expect(woProgressUpdate).toBe(true);
    });

    it("Test 8: Cannot start work if not checked in", async () => {
      const mockClientQuery = vi.fn(async () => ({
        rows: [{ ...mockBaseRow, status: "CONFIRMED" }],
      }));

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        return cb({ query: mockClientQuery } as any);
      });

      await expect(
        assignmentsService.startWork("usr_worker_01", "asn_01", {}),
      ).rejects.toThrowError(AppError);
    });
  });

  describe("4. Completion Workflow (IN_PROGRESS -> COMPLETED)", () => {
    it("Test 9: Started assignment can be marked completed by worker", async () => {
      let currentStatus = "IN_PROGRESS";
      const executedSqls: string[] = [];
      const mockClientQuery = vi.fn(async (sql: string) => {
        executedSqls.push(sql);
        if (sql.includes("SELECT COUNT(*) AS uncompleted FROM assignments")) {
          return { rows: [{ uncompleted: 0 }] } as any;
        }
        if (sql.includes("SELECT") && sql.includes("FROM assignments")) {
          return {
            rows: [{ ...mockBaseRow, status: currentStatus }],
          } as any;
        }
        if (sql.includes("UPDATE assignments")) {
          currentStatus = "COMPLETED";
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        return cb({ query: mockClientQuery } as any);
      });

      const res = await assignmentsService.completeWork(
        "usr_worker_01",
        "asn_01",
        {
          completionNotes: "Finished kitchen cleaning and prep.",
        },
      );

      expect(res.status).toBe(AssignmentStatus.COMPLETED);

      // Verify work opportunity was also marked completed
      const woComplete = executedSqls.some(
        (s) =>
          s.includes("UPDATE work_opportunities") &&
          s.includes("status = 'COMPLETED'"),
      );
      expect(woComplete).toBe(true);
    });

    it("Test 10: Provider can confirm completion and set final wage", async () => {
      let currentStatus = "IN_PROGRESS";
      const mockClientQuery = vi.fn(async (sql: string) => {
        if (sql.includes("SELECT COUNT(*) AS uncompleted FROM assignments")) {
          return { rows: [{ uncompleted: 0 }] } as any;
        }
        if (sql.includes("SELECT") && sql.includes("FROM assignments")) {
          return {
            rows: [{ ...mockBaseRow, status: currentStatus }],
          } as any;
        }
        if (sql.includes("UPDATE assignments")) {
          currentStatus = "COMPLETED";
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        return cb({ query: mockClientQuery } as any);
      });

      const res = await assignmentsService.confirmCompletion(
        "usr_provider_01",
        "asn_01",
        {
          finalWagePaid: 650, // +₹50 bonus
          feedback: "Excellent work done quickly!",
        },
      );

      expect(res.status).toBe(AssignmentStatus.COMPLETED);
    });

    it("Test 11: Unauthorized provider cannot confirm completion for another provider (403)", async () => {
      const mockClientQuery = vi.fn(async () => ({
        rows: [{ ...mockBaseRow, status: "IN_PROGRESS" }],
      }));

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        return cb({ query: mockClientQuery } as any);
      });

      await expect(
        assignmentsService.confirmCompletion("usr_evil_provider", "asn_01", {}),
      ).rejects.toThrowError(AppError);
    });

    it("Test 12: Completed assignment cannot be completed again", async () => {
      const mockClientQuery = vi.fn(async () => ({
        rows: [{ ...mockBaseRow, status: "COMPLETED" }],
      }));

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        return cb({ query: mockClientQuery } as any);
      });

      await expect(
        assignmentsService.completeWork("usr_worker_01", "asn_01", {}),
      ).rejects.toThrowError(AppError);
    });
  });

  describe("5. No-Show & Cancellation Lifecycle", () => {
    it("Test 13: Provider can report no-show past grace period and reopens capacity", async () => {
      let currentStatus = "CONFIRMED";
      const executedSqls: string[] = [];
      const mockClientQuery = vi.fn(async (sql: string) => {
        executedSqls.push(sql);
        if (sql.includes("SELECT") && sql.includes("FROM assignments")) {
          return {
            rows: [
              {
                ...mockBaseRow,
                status: currentStatus,
                work_date: "2026-08-01", // Past date
                start_time: "09:00",
              },
            ],
          } as any;
        }
        if (sql.includes("UPDATE assignments")) {
          currentStatus = "NO_SHOW";
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        return cb({ query: mockClientQuery } as any);
      });

      const res = await assignmentsService.reportNoShow(
        "usr_provider_01",
        "asn_01",
        {
          notes: "Worker did not show up after 1 hour",
        },
      );

      expect(res.status).toBe(AssignmentStatus.NO_SHOW);

      // Verify work opportunity workers_assigned was decremented
      const woCapacityUpdate = executedSqls.some(
        (s) =>
          s.includes("UPDATE work_opportunities") &&
          s.includes("workers_assigned = GREATEST(0, workers_assigned - 1)"),
      );
      expect(woCapacityUpdate).toBe(true);
    });

    it("Test 14: Worker or Provider can cancel unstarted assignment", async () => {
      let currentStatus = "ASSIGNED";
      const executedSqls: string[] = [];
      const mockClientQuery = vi.fn(async (sql: string) => {
        executedSqls.push(sql);
        if (sql.includes("SELECT") && sql.includes("FROM assignments")) {
          return {
            rows: [{ ...mockBaseRow, status: currentStatus }],
          } as any;
        }
        if (sql.includes("UPDATE assignments")) {
          currentStatus = "CANCELLED";
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        return cb({ query: mockClientQuery } as any);
      });

      const res = await assignmentsService.cancelAssignment(
        "usr_worker_01",
        UserRole.WORKER,
        "asn_01",
        {
          reason: "Personal emergency, cannot attend shift",
        },
      );

      expect(res.status).toBe(AssignmentStatus.CANCELLED);
    });

    it("Test 15: Cannot cancel an assignment that is already IN_PROGRESS or COMPLETED", async () => {
      const mockClientQuery = vi.fn(async () => ({
        rows: [{ ...mockBaseRow, status: "IN_PROGRESS" }],
      }));

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        return cb({ query: mockClientQuery } as any);
      });

      await expect(
        assignmentsService.cancelAssignment(
          "usr_worker_01",
          UserRole.WORKER,
          "asn_01",
          {
            reason: "Want to cancel mid-work",
          },
        ),
      ).rejects.toThrowError(AppError);
    });
  });
});
