import { describe, it, expect, vi, beforeEach } from "vitest";
import { matchingService } from "../src/modules/matching/service";
import {
  computeMatchExplanation,
  evaluateSkillCompatibility,
  evaluateAvailabilityFit,
  evaluateDistanceProximity,
  evaluateDurationPreference,
  evaluateCategoryPreference,
  evaluateUrgencyAlignment,
  MatchingContextInput,
} from "../src/modules/matching/matching.rules";
import {
  WorkType,
  UrgencyLevel,
  WorkOpportunityStatus,
  PaymentType,
} from "@nearvia/types";
import * as db from "../src/db";

vi.mock("../src/db", () => ({
  query: vi.fn(),
  pool: { end: vi.fn() },
}));

describe("Phase 8 — Intelligent Matching & Explainable Ranking Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Skill Compatibility Scoring (35% weight)", () => {
    it("Test 1: Exact skill match with sufficient experience scores 100%", () => {
      const workerSkills = [
        {
          skillId: "s_01",
          skillName: "Commercial Cooking",
          categoryId: "c_01",
          yearsExperience: 3,
        },
        {
          skillId: "s_02",
          skillName: "Food Safety & Hygiene",
          categoryId: "c_01",
          yearsExperience: 2,
        },
      ];

      const jobSkills = [
        {
          skillId: "s_01",
          skillName: "Commercial Cooking",
          categoryId: "c_01",
          isRequired: true,
          minExperienceYears: 2,
        },
        {
          skillId: "s_02",
          skillName: "Food Safety & Hygiene",
          categoryId: "c_01",
          isRequired: true,
          minExperienceYears: 1,
        },
      ];

      const evalResult = evaluateSkillCompatibility(workerSkills, jobSkills);
      expect(evalResult.score).toBe(100);
      expect(evalResult.isHardEligible).toBe(true);
      expect(evalResult.reasons.length).toBeGreaterThan(0);
      expect(evalResult.reasons[0]).toContain(
        "All 2 required trade skills matched",
      );
    });

    it("Test 2: Missing mandatory skill results in score = 0 and isHardEligible = false", () => {
      const workerSkills = [
        {
          skillId: "s_03",
          skillName: "Carpentry",
          categoryId: "c_02",
          yearsExperience: 4,
        },
      ];

      const jobSkills = [
        {
          skillId: "s_01",
          skillName: "Commercial Cooking",
          categoryId: "c_01",
          isRequired: true,
          minExperienceYears: 1,
        },
      ];

      const evalResult = evaluateSkillCompatibility(workerSkills, jobSkills);
      expect(evalResult.score).toBe(0);
      expect(evalResult.isHardEligible).toBe(false);
      expect(evalResult.limitations[0]).toContain("Missing mandatory skill");
    });
  });

  describe("2. Availability & Time Fit Scoring (25% weight)", () => {
    it("Test 3: Scheduled availability slot completely covering work hours scores 100%", () => {
      const slots = [
        {
          availabilityDate: "2026-08-27",
          startTime: "08:00",
          endTime: "18:00",
        },
      ];

      const evalResult = evaluateAvailabilityFit(
        slots,
        false,
        "2026-08-27",
        "10:00",
        "14:00",
        UrgencyLevel.NORMAL,
      );

      expect(evalResult.score).toBe(100);
      expect(evalResult.reasons[0]).toContain(
        "Scheduled availability fully covers work hours",
      );
    });

    it("Test 4: Immediate work with Available-Now status active scores 100%", () => {
      const todayStr = new Date().toISOString().split("T")[0];
      const evalResult = evaluateAvailabilityFit(
        [],
        true, // isAvailableNow
        todayStr,
        "12:00",
        "15:00",
        UrgencyLevel.IMMEDIATE,
      );

      expect(evalResult.score).toBe(100);
      expect(evalResult.reasons[0]).toContain(
        "Available now for immediate neighborhood start",
      );
    });
  });

  describe("3. Distance Proximity Scoring (20% weight)", () => {
    it("Test 5: Closer distance yields higher proximity score than farther distance", () => {
      const closeEval = evaluateDistanceProximity(1.0, 5.0); // 1 km
      const farEval = evaluateDistanceProximity(4.5, 5.0); // 4.5 km

      expect(closeEval.score).toBe(80);
      expect(farEval.score).toBe(10);
      expect(closeEval.score).toBeGreaterThan(farEval.score);
      expect(closeEval.reasons[0]).toContain("walkable distance");
    });
  });

  describe("4. Duration, Category & Urgency Alignment", () => {
    it("Test 6: Matching duration preference scores 100%", () => {
      const evalResult = evaluateDurationPreference(2, 2);
      expect(evalResult.score).toBe(100);
    });

    it("Test 7: Matching category background scores 100%", () => {
      const workerSkills = [
        {
          skillId: "s_01",
          skillName: "Plumbing",
          categoryId: "c_repair",
          yearsExperience: 2,
        },
      ];
      const evalResult = evaluateCategoryPreference(
        "c_repair",
        workerSkills,
        "Home Repairs",
      );
      expect(evalResult.score).toBe(100);
      expect(evalResult.reasons[0]).toContain("Home Repairs");
    });

    it("Test 8: Immediate urgency with Available-Now scores 100%", () => {
      const evalResult = evaluateUrgencyAlignment(UrgencyLevel.IMMEDIATE, true);
      expect(evalResult.score).toBe(100);
    });
  });

  describe("5. Composite Multi-Factor Score & Invariants", () => {
    it("Test 9: Composite match score is strictly normalized between 0 and 100", () => {
      const context: MatchingContextInput = {
        worker: {
          userId: "usr_01",
          skills: [
            {
              skillId: "s_01",
              skillName: "Warehouse Loading",
              categoryId: "c_logistics",
              yearsExperience: 2,
            },
          ],
          isAvailableNow: true,
          availabilitySlots: [
            {
              availabilityDate: "2026-08-26",
              startTime: "08:00",
              endTime: "18:00",
            },
          ],
          serviceRadiusKm: 5.0,
        },
        opportunity: {
          id: "opp_01",
          title: "Unload delivery truck cartons",
          categoryId: "c_logistics",
          categoryName: "Warehouse & Logistics",
          workType: "TASK",
          urgency: UrgencyLevel.URGENT,
          workDate: "2026-08-26",
          startTime: "10:00",
          endTime: "12:00",
          durationHours: 2,
          distanceKm: 1.8,
          skills: [
            {
              skillId: "s_01",
              skillName: "Warehouse Loading",
              categoryId: "c_logistics",
              isRequired: true,
              minExperienceYears: 1,
            },
          ],
        },
      };

      const match = computeMatchExplanation(context);
      expect(match.score).toBeGreaterThanOrEqual(0);
      expect(match.score).toBeLessThanOrEqual(100);
      expect(match.score).toBeGreaterThanOrEqual(85); // High score for well-matched candidate
      expect(match.breakdown.skillScore).toBe(100);
      expect(match.reasons.length).toBeGreaterThan(0);
      expect(match.isEligible).toBe(true);
    });

    it("Test 10: Deterministic output verification — exact same inputs yield identical score", () => {
      const context: MatchingContextInput = {
        worker: {
          userId: "usr_01",
          skills: [],
          isAvailableNow: false,
          availabilitySlots: [],
          serviceRadiusKm: 5.0,
        },
        opportunity: {
          id: "opp_02",
          title: "General clean up",
          categoryId: "c_01",
          workType: "TASK",
          urgency: UrgencyLevel.NORMAL,
          workDate: "2026-08-26",
          startTime: "14:00",
          endTime: "16:00",
          durationHours: 2,
          distanceKm: 2.5,
          skills: [],
        },
      };

      const run1 = computeMatchExplanation(context);
      const run2 = computeMatchExplanation(context);

      expect(run1.score).toBe(run2.score);
      expect(run1.breakdown).toEqual(run2.breakdown);
      expect(run1.reasons).toEqual(run2.reasons);
    });

    it("Test 11: High wage cannot override mandatory skill incompatibility", () => {
      const context: MatchingContextInput = {
        worker: {
          userId: "usr_01",
          skills: [
            {
              skillId: "s_other",
              skillName: "Gardening",
              categoryId: "c_other",
              yearsExperience: 1,
            },
          ],
          isAvailableNow: true,
          availabilitySlots: [],
          serviceRadiusKm: 5.0,
        },
        opportunity: {
          id: "opp_03",
          title: "High-paying electric generator wiring repair",
          categoryId: "c_electrical",
          workType: "TASK",
          urgency: UrgencyLevel.IMMEDIATE,
          workDate: "2026-08-26",
          startTime: "10:00",
          endTime: "12:00",
          durationHours: 2,
          distanceKm: 0.5,
          skills: [
            {
              skillId: "s_electrician",
              skillName: "Certified Electrician",
              categoryId: "c_electrical",
              isRequired: true,
              minExperienceYears: 3,
            },
          ],
        },
      };

      const match = computeMatchExplanation(context);
      expect(match.breakdown.skillScore).toBe(0);
      expect(match.isEligible).toBe(false);
      expect(match.limitations[0]).toContain("Missing mandatory skill");
    });
  });

  describe("6. Matching Service Integration & Worker Resolution", () => {
    it("Test 12: Throws LOCATION_REQUIRED when worker has no location configured", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM worker_profiles")) {
          return { rows: [{ latitude: null, longitude: null }] } as any;
        }
        return { rows: [] } as any;
      });

      await expect(
        matchingService.matchWorkOpportunitiesForWorker("usr_unlocated", {}),
      ).rejects.toThrow("Worker location has not been configured");
    });

    it("Test 13: Sorts opportunities by match.score descending in RECOMMENDED mode", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM worker_profiles")) {
          return {
            rows: [
              {
                latitude: 12.9716,
                longitude: 77.5946,
                service_radius_km: 5.0,
                is_available_now: true,
              },
            ],
          } as any;
        }
        if (sql.includes("FROM worker_skills")) {
          return {
            rows: [
              {
                skill_id: "s_cook",
                name: "Kitchen Helper",
                category_id: "c_01",
                category_name: "Restaurant",
                years_experience: 2,
              },
            ],
          } as any;
        }
        if (sql.includes("FROM worker_availability")) {
          return { rows: [] } as any;
        }
        if (sql.includes("COUNT(*) AS total")) {
          return { rows: [{ total: "2" }] } as any;
        }
        if (sql.includes("FROM work_opportunities wo")) {
          return {
            rows: [
              {
                id: "opp_far",
                provider_id: "p_01",
                category_id: "c_other",
                title: "General helper 4 km away",
                work_type: WorkType.TASK,
                urgency: UrgencyLevel.NORMAL,
                status: WorkOpportunityStatus.PUBLISHED,
                workers_needed: 1,
                workers_assigned: 0,
                latitude: 12.94,
                longitude: 77.59,
                address_approximate: "Jayanagar",
                work_date: "2026-08-26",
                start_time: "10:00",
                end_time: "12:00",
                duration_hours: 2,
                payment_amount: 400,
                payment_type: PaymentType.FIXED,
                distance_meters: 4200,
              },
              {
                id: "opp_close_cook",
                provider_id: "p_02",
                category_id: "c_01",
                title: "Kitchen assistant 1 km away",
                work_type: WorkType.TASK,
                urgency: UrgencyLevel.URGENT,
                status: WorkOpportunityStatus.PUBLISHED,
                workers_needed: 1,
                workers_assigned: 0,
                latitude: 12.97,
                longitude: 77.6,
                address_approximate: "MG Road",
                work_date: "2026-08-26",
                start_time: "10:00",
                end_time: "12:00",
                duration_hours: 2,
                payment_amount: 600,
                payment_type: PaymentType.FIXED,
                distance_meters: 1100,
              },
            ],
          } as any;
        }
        if (sql.includes("FROM work_opportunity_skills")) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      const result = await matchingService.matchWorkOpportunitiesForWorker(
        "usr_worker_01",
        {
          sort: "RECOMMENDED",
        },
      );

      expect(result.opportunities).toHaveLength(2);
      // opp_close_cook should rank first because of higher match score
      expect(result.opportunities[0].id).toBe("opp_close_cook");
      expect(result.opportunities[0].match?.score).toBeGreaterThan(
        result.opportunities[1].match?.score || 0,
      );
    });
  });
});
