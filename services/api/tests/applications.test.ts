import { describe, it, expect, vi, beforeEach } from "vitest";
import { applicationsService } from "../src/modules/applications/service";
import { assignmentsService } from "../src/modules/assignments/service";
import {
  ApplicationStatus,
  AssignmentStatus,
  WorkOpportunityStatus,
  UserRole,
} from "@nearvia/types";
import * as db from "../src/db";

vi.mock("../src/db", () => ({
  query: vi.fn(),
  withTransaction: vi.fn(async (cb) => {
    const mockClient = { query: vi.fn() };
    return cb(mockClient);
  }),
  pool: { end: vi.fn() },
}));

vi.mock("../src/modules/matching/service", () => ({
  matchingService: {
    explainMatch: vi.fn().mockResolvedValue({
      score: 92,
      reasons: ["2 of 2 skills matched", "Available today", "1.8 km away"],
    }),
  },
}));

describe("Phase 9 — Applications, Selection & Assignment Workflow Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Worker Application Submission & Validation", () => {
    it("Test 1: Worker can apply for published opportunity within 5 km radius", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM worker_profiles")) {
          return {
            rows: [
              {
                id: "wp_01",
                latitude: 12.9716,
                longitude: 77.5946,
                service_radius_km: 5.0,
              },
            ],
          } as any;
        }
        if (sql.includes("FROM work_opportunities wo")) {
          return {
            rows: [
              {
                id: "wo_01",
                provider_id: "pp_01",
                title: "Kitchen Assistant",
                description: "Need helper for 4 hours",
                work_type: "SHIFT",
                urgency: "NORMAL",
                status: "PUBLISHED",
                workers_needed: 2,
                workers_assigned: 0,
                work_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
                start_time: "10:00",
                end_time: "14:00",
                duration_hours: 4,
                payment_amount: 600,
                payment_type: "FIXED",
                address_approximate: "Indiranagar 100ft Rd",
                distance_meters: 1800,
              },
            ],
          } as any;
        }
        if (sql.includes("FROM applications WHERE work_opportunity_id")) {
          return { rows: [] } as any; // No duplicate
        }
        if (sql.includes("INSERT INTO applications")) {
          return {
            rows: [
              {
                id: "app_01",
                created_at: new Date().toISOString(),
                applied_at: new Date().toISOString(),
                status: "PENDING",
                proposed_wage: null,
                worker_notes: "I am ready to start immediately.",
              },
            ],
          } as any;
        }
        if (sql.includes("UPDATE work_opportunities SET status = 'MATCHING'")) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      const application = await applicationsService.applyForWork(
        "usr_worker_01",
        "wo_01",
        {
          workerNotes: "I am ready to start immediately.",
        },
      );

      expect(application).toBeDefined();
      expect(application.id).toBe("app_01");
      expect(application.status).toBe(ApplicationStatus.PENDING);
      expect(application.opportunityTitle).toBe("Kitchen Assistant");
      expect(application.matchScore).toBe(92);
    });

    it("Test 2: Rejects duplicate application with APPLICATION_DUPLICATE (409)", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM worker_profiles")) {
          return {
            rows: [
              {
                id: "wp_01",
                latitude: 12.97,
                longitude: 77.59,
                service_radius_km: 5.0,
              },
            ],
          } as any;
        }
        if (sql.includes("FROM work_opportunities wo")) {
          return {
            rows: [
              {
                id: "wo_01",
                status: "PUBLISHED",
                workers_needed: 1,
                workers_assigned: 0,
                work_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
                distance_meters: 1000,
              },
            ],
          } as any;
        }
        if (sql.includes("FROM applications WHERE work_opportunity_id")) {
          return { rows: [{ id: "app_existing" }] } as any; // Duplicate exists!
        }
        return { rows: [] } as any;
      });

      await expect(
        applicationsService.applyForWork("usr_worker_01", "wo_01", {}),
      ).rejects.toThrow("You have already submitted an application");
    });

    it("Test 3: Rejects application for expired work opportunity", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM worker_profiles")) {
          return {
            rows: [
              {
                id: "wp_01",
                latitude: 12.97,
                longitude: 77.59,
                service_radius_km: 5.0,
              },
            ],
          } as any;
        }
        if (sql.includes("FROM work_opportunities wo")) {
          return {
            rows: [
              {
                id: "wo_expired",
                status: "PUBLISHED",
                workers_needed: 1,
                workers_assigned: 0,
                work_date: "2020-01-01", // Expired in the past!
                distance_meters: 1000,
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      await expect(
        applicationsService.applyForWork("usr_worker_01", "wo_expired", {}),
      ).rejects.toThrow("This work opportunity has expired");
    });

    it("Test 4: Worker can withdraw own pending application", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (
          sql.includes("FROM applications a") &&
          sql.includes("WHERE a.id = $1")
        ) {
          return {
            rows: [
              {
                id: "app_01",
                worker_user_id: "usr_worker_01",
                provider_user_id: "usr_provider_01",
                status: "PENDING",
                title: "Delivery Helper",
              },
            ],
          } as any;
        }
        if (sql.includes("UPDATE applications SET status = 'WITHDRAWN'")) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      const withdrawn = await applicationsService.withdrawApplication(
        "usr_worker_01",
        "app_01",
        "Schedule conflict",
      );
      expect(withdrawn).toBeDefined();
    });
  });

  describe("2. Provider Applicant Review & Access Isolation", () => {
    it("Test 5: Provider can view applicants for own work opportunity", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (
          sql.includes("FROM work_opportunities wo") &&
          sql.includes("JOIN provider_profiles pp")
        ) {
          return { rows: [{ id: "wo_01", location: {} }] } as any; // Owner verified
        }
        if (
          sql.includes("FROM applications a") &&
          sql.includes("JOIN worker_profiles wp")
        ) {
          return {
            rows: [
              {
                application_id: "app_01",
                worker_id: "wp_01",
                worker_user_id: "usr_w1",
                full_name: "Anand Kumar",
                average_rating: 4.9,
                completed_tasks_count: 14,
                is_available_now: true,
                status: "PENDING",
                applied_at: new Date().toISOString(),
                distance_meters: 1500,
              },
            ],
          } as any;
        }
        if (sql.includes("FROM worker_skills ws")) {
          return { rows: [{ name: "Cooking" }, { name: "Food Prep" }] } as any;
        }
        return { rows: [] } as any;
      });

      const applicants = await applicationsService.getOpportunityApplicants(
        "usr_provider_01",
        "wo_01",
      );

      expect(applicants).toHaveLength(1);
      expect(applicants[0].workerFullName).toBe("Anand Kumar");
      expect(applicants[0].workerTradeSkills).toContain("Cooking");
      expect(applicants[0].matchScore).toBe(92);
    });

    it("Test 6: Provider cannot view applicants for another provider's job (403)", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (
          sql.includes("FROM work_opportunities wo") &&
          sql.includes("JOIN provider_profiles pp")
        ) {
          return { rows: [] } as any; // Not the owner!
        }
        return { rows: [] } as any;
      });

      await expect(
        applicationsService.getOpportunityApplicants(
          "usr_unauthorized_provider",
          "wo_01",
        ),
      ).rejects.toThrow("You are not authorized to view applicants");
    });

    it("Test 7: Provider can shortlist a pending applicant", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM applications a")) {
          return {
            rows: [
              {
                id: "app_01",
                worker_user_id: "usr_w1",
                provider_user_id: "usr_provider_01",
                status: "PENDING",
                title: "Helper",
              },
            ],
          } as any;
        }
        if (sql.includes("UPDATE applications SET status = 'SHORTLISTED'")) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      const shortlisted = await applicationsService.shortlistApplication(
        "usr_provider_01",
        "app_01",
        "Strong cooking credentials",
      );
      expect(shortlisted).toBeDefined();
    });

    it("Test 8: Provider can reject an applicant", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM applications a")) {
          return {
            rows: [
              {
                id: "app_01",
                worker_user_id: "usr_w1",
                provider_user_id: "usr_provider_01",
                status: "PENDING",
                title: "Helper",
              },
            ],
          } as any;
        }
        if (sql.includes("UPDATE applications SET status = 'REJECTED'")) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      const rejected = await applicationsService.rejectApplication(
        "usr_provider_01",
        "app_01",
        "Looking for more experience",
      );
      expect(rejected).toBeDefined();
    });
  });

  describe("3. Concurrency-Safe Selection & Transactional Assignment Creation", () => {
    it("Test 9: Accepting applicant creates assignment and updates capacity inside transaction", async () => {
      vi.mocked(db.withTransaction).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes("FROM applications a")) {
              return {
                rows: [
                  {
                    id: "app_01",
                    work_opportunity_id: "wo_01",
                    worker_id: "wp_01",
                    status: "PENDING",
                    proposed_wage: null,
                    provider_user_id: "usr_provider_01",
                    provider_id: "pp_01",
                  },
                ],
              };
            }
            if (
              sql.includes("FROM work_opportunities") &&
              sql.includes("FOR UPDATE")
            ) {
              return {
                rows: [
                  {
                    id: "wo_01",
                    workers_needed: 2,
                    workers_assigned: 1, // 1 of 2 assigned -> room for 1 more
                    payment_amount: 500,
                    status: "MATCHING",
                  },
                ],
              };
            }
            if (sql.includes("INSERT INTO assignments")) {
              return {
                rows: [{ id: "asn_new_01" }],
              };
            }
            return { rows: [] };
          }),
        };
        return callback(mockClient as any);
      });

      // Mock getApplicationById return after accept
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM applications a")) {
          return {
            rows: [
              {
                id: "app_01",
                worker_user_id: "usr_w1",
                provider_user_id: "usr_provider_01",
                status: "ACCEPTED",
                title: "Helper",
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const result = await applicationsService.acceptApplication(
        "usr_provider_01",
        "app_01",
        "Hired for shift",
      );

      expect(result.assignmentId).toBe("asn_new_01");
      expect(result.application).toBeDefined();
    });

    it("Test 10: Prevents over-hiring when workers_assigned >= workers_needed (409 WORK_ALREADY_FILLED)", async () => {
      vi.mocked(db.withTransaction).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes("FROM applications a")) {
              return {
                rows: [
                  {
                    id: "app_02",
                    work_opportunity_id: "wo_01",
                    worker_id: "wp_02",
                    status: "PENDING",
                    provider_user_id: "usr_provider_01",
                    provider_id: "pp_01",
                  },
                ],
              };
            }
            if (
              sql.includes("FROM work_opportunities") &&
              sql.includes("FOR UPDATE")
            ) {
              return {
                rows: [
                  {
                    id: "wo_01",
                    workers_needed: 1,
                    workers_assigned: 1, // Already full (1/1)!
                    payment_amount: 500,
                    status: "FILLED",
                  },
                ],
              };
            }
            return { rows: [] };
          }),
        };
        return callback(mockClient as any);
      });

      await expect(
        applicationsService.acceptApplication("usr_provider_01", "app_02"),
      ).rejects.toThrow("Capacity reached (1/1)");
    });
  });

  describe("4. Active Assignment Retrieval & Contact Reveal Security", () => {
    it("Test 11: Worker retrieves active assignments with unlocked provider phone", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM assignments asn")) {
          return {
            rows: [
              {
                id: "asn_01",
                work_opportunity_id: "wo_01",
                worker_id: "wp_01",
                provider_id: "pp_01",
                status: "ASSIGNED",
                assigned_at: new Date().toISOString(),
                agreed_wage: 600,
                payment_status: "PENDING",
                title: "Shift 20 boxes",
                description: "Unload boxes from truck",
                work_type: "TASK",
                urgency: "NORMAL",
                work_date: "2026-08-27",
                start_time: "10:00",
                end_time: "12:00",
                duration_hours: 2,
                address_approximate: "MG Road Metro",
                instructions: "Ask for supervisor Ramesh",
                provider_full_name: "Priya Logistics",
                provider_business_name: "Priya Retail Ltd",
                provider_contact_phone: "+919876543210",
                worker_full_name: "Anand Kumar",
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const assignments = await assignmentsService.getMyAssignments(
        "usr_worker_01",
        UserRole.WORKER,
      );

      expect(assignments).toHaveLength(1);
      expect(assignments[0].id).toBe("asn_01");
      expect(assignments[0].status).toBe(AssignmentStatus.ASSIGNED);
      expect(assignments[0].providerContactPhone).toBe("+919876543210");
      expect(assignments[0].instructions).toBe("Ask for supervisor Ramesh");
    });

    it("Test 12: Unauthorized user cannot view assignment details (403)", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM assignments asn")) {
          return {
            rows: [
              {
                id: "asn_01",
                worker_user_id: "usr_w1",
                provider_user_id: "usr_p1",
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      await expect(
        assignmentsService.getAssignmentById("usr_stranger", "asn_01"),
      ).rejects.toThrow("You are not authorized to view this assignment");
    });
  });
});
