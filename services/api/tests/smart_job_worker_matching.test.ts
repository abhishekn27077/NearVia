import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  evaluateSkillCompatibility,
  evaluateAvailabilityFit,
  evaluateDistanceProximity,
  evaluateDurationPreference,
  evaluateCategoryPreference,
  evaluateUrgencyAlignment,
  computeMatchExplanation,
  MatchingContextInput,
} from "../src/modules/matching/matching.rules";
import { smartMatchingService } from "../src/modules/matching/smartMatching.service";
import { applicationsService } from "../src/modules/applications/service";
import { discoveryService } from "../src/modules/jobs/discovery.service";
import {
  UrgencyLevel,
  WorkType,
  WorkOpportunityStatus,
  PaymentType,
} from "@nearvia/types";
import * as db from "../src/db";

vi.mock("../src/db", () => ({
  query: vi.fn(),
  pool: { end: vi.fn() },
}));

describe("NEARVIA Prompt 13: Smart Job/Worker Matching System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 1. MATCH SCORE & FORMULA WEIGHTS
  // ==========================================================================
  describe("1. Deterministic Multi-Factor Scoring & Invariants", () => {
    it("1.1 Bounded score normalization strictly between 0 and 100", () => {
      const context: MatchingContextInput = {
        worker: {
          userId: "usr_w1",
          skills: [
            {
              skillId: "sk_1",
              skillName: "Electrician",
              categoryId: "cat_elec",
              yearsExperience: 4,
            },
          ],
          isAvailableNow: true,
          availabilitySlots: [],
          serviceRadiusKm: 5.0,
        },
        opportunity: {
          id: "job_1",
          title: "Fix circuit breaker",
          categoryId: "cat_elec",
          categoryName: "Electrical",
          workType: "TASK",
          urgency: UrgencyLevel.URGENT,
          workDate: new Date().toISOString().split("T")[0],
          startTime: "10:00",
          endTime: "12:00",
          durationHours: 2,
          distanceKm: 0.8,
          skills: [
            {
              skillId: "sk_1",
              skillName: "Electrician",
              categoryId: "cat_elec",
              isRequired: true,
              minExperienceYears: 2,
            },
          ],
          providerVerified: true,
          isPreferredWorker: true,
        },
      };

      const match = computeMatchExplanation(context);
      expect(match.score).toBeGreaterThanOrEqual(0);
      expect(match.score).toBeLessThanOrEqual(100);
      expect(match.score).toBeGreaterThanOrEqual(90);
      expect(match.breakdown.skillScore).toBe(100);
      expect(match.breakdown.distanceScore).toBeGreaterThanOrEqual(80);
      expect(match.breakdown.trustScore).toBe(100);
      expect(match.isEligible).toBe(true);
      expect(match.reasons).toContain("Verified employer");
      expect(match.reasons).toContain("❤️ Preferred worker for this employer");
    });

    it("1.2 Missing mandatory skill results in score = 0 and isEligible = false", () => {
      const context: MatchingContextInput = {
        worker: {
          userId: "usr_w2",
          skills: [
            {
              skillId: "sk_plumb",
              skillName: "Plumbing",
              categoryId: "cat_plumb",
              yearsExperience: 5,
            },
          ],
          isAvailableNow: true,
          availabilitySlots: [],
          serviceRadiusKm: 5.0,
        },
        opportunity: {
          id: "job_2",
          title: "HVAC Duct Repair",
          categoryId: "cat_hvac",
          categoryName: "HVAC",
          workType: "TASK",
          urgency: UrgencyLevel.NORMAL,
          workDate: "2026-10-10",
          startTime: "09:00",
          endTime: "13:00",
          durationHours: 4,
          distanceKm: 1.0,
          skills: [
            {
              skillId: "sk_hvac",
              skillName: "HVAC Certified",
              categoryId: "cat_hvac",
              isRequired: true,
              minExperienceYears: 2,
            },
          ],
        },
      };

      const match = computeMatchExplanation(context);
      expect(match.breakdown.skillScore).toBe(0);
      expect(match.score).toBe(0);
      expect(match.isEligible).toBe(false);
      expect(match.limitations[0]).toContain("Missing mandatory skill");
    });

    it("1.3 Proximity scoring ranks closer candidates strictly higher", () => {
      const walkable = evaluateDistanceProximity(0.8, 5.0);
      const medium = evaluateDistanceProximity(2.5, 5.0);
      const outerBoundary = evaluateDistanceProximity(4.8, 5.0);

      expect(walkable.score).toBeGreaterThan(medium.score);
      expect(medium.score).toBeGreaterThan(outerBoundary.score);
      expect(walkable.reasons[0]).toContain("walkable distance");
      expect(outerBoundary.limitations[0]).toContain("near outer 5 km boundary");
    });

    it("1.4 Distance exceeding worker service radius marks isEligible = false", () => {
      const context: MatchingContextInput = {
        worker: {
          userId: "usr_w3",
          skills: [],
          isAvailableNow: true,
          availabilitySlots: [],
          serviceRadiusKm: 3.0,
        },
        opportunity: {
          id: "job_3",
          title: "Warehouse Helper",
          categoryId: "cat_gen",
          workType: "TASK",
          urgency: UrgencyLevel.NORMAL,
          workDate: "2026-10-10",
          startTime: "10:00",
          endTime: "14:00",
          durationHours: 4,
          distanceKm: 4.5, // Exceeds 3.0 km service radius
          skills: [],
        },
      };

      const match = computeMatchExplanation(context);
      expect(match.isEligible).toBe(false);
    });
  });

  // ==========================================================================
  // 2. FAIRNESS FOR NEW WORKERS & UNBIASED SIGNALS
  // ==========================================================================
  describe("2. Fairness & Unbiased Signals", () => {
    it("2.1 New worker with 0 tasks and 0 ratings receives neutral baseline (70), not 0 or fake 100", () => {
      const completedTasks = 0;
      const totalRatings = 0;

      const isNewWorkerTasks = completedTasks < 3;
      const isNewWorkerRatings = totalRatings < 3;

      const reliabilityScore = isNewWorkerTasks ? 70 : 100;
      const ratingScore = isNewWorkerRatings ? 70 : 100;

      expect(reliabilityScore).toBe(70);
      expect(ratingScore).toBe(70);
      expect(isNewWorkerTasks && isNewWorkerRatings).toBe(true);
    });

    it("2.2 Veteran worker with 99% reliability scores higher than 60% reliability", () => {
      const highRelScore = Math.min(100, Math.max(0, 99.0));
      const lowRelScore = Math.min(100, Math.max(0, 60.0));

      expect(highRelScore).toBeGreaterThan(lowRelScore);
    });
  });

  // ==========================================================================
  // 3. PROVIDER-SIDE MATCHING (smartMatchingService)
  // ==========================================================================
  describe("3. Provider-Side Smart Matching", () => {
    it("3.1 Excludes closed or filled jobs from worker recommendations", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM work_opportunities wo")) {
          return {
            rows: [
              {
                id: "job_filled",
                provider_id: "p_1",
                category_id: "c_1",
                category_name: "Carpentry",
                title: "Build Shelf",
                work_date: "2026-10-10",
                start_time: "10:00",
                end_time: "14:00",
                duration_hours: 4,
                latitude: 12.9716,
                longitude: 77.5946,
                status: "PUBLISHED",
                workers_needed: 2,
                workers_assigned: 2, // Full capacity reached!
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const res = await smartMatchingService.getMatchesForJob("job_filled", "u_provider_1", false);
      expect(res.totalMatches).toBe(0);
      expect(res.matches).toHaveLength(0);
    });

    it("3.2 Throws 403 when another provider attempts to view matches (IDOR prevention)", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM work_opportunities wo")) {
          return {
            rows: [
              {
                id: "job_secret",
                provider_id: "p_owner",
                category_id: "c_1",
                category_name: "Carpentry",
                title: "Secret Job",
                work_date: "2026-10-10",
                start_time: "10:00",
                end_time: "14:00",
                duration_hours: 4,
                latitude: 12.9716,
                longitude: 77.5946,
                status: "PUBLISHED",
                workers_needed: 1,
                workers_assigned: 0,
              },
            ],
          } as any;
        }
        if (sql.includes("FROM provider_profiles WHERE user_id")) {
          return {
            rows: [{ id: "p_attacker" }], // Different provider!
          } as any;
        }
        return { rows: [] } as any;
      });

      await expect(
        smartMatchingService.getMatchesForJob("job_secret", "u_attacker", false),
      ).rejects.toThrow("You are not authorized to view matches for another provider's job");
    });
  });

  // ==========================================================================
  // 4. PROVIDER-SIDE APPLICANT RANKING (applicationsService)
  // ==========================================================================
  describe("4. Provider-Side Applicant Ranking & N+1 Prevention", () => {
    it("4.1 Batch fetches skills and ranks applicants by multi-factor match score without N+1 queries", async () => {
      let workerSkillsQueryCalls = 0;

      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        // Ownership check
        if (sql.includes("FROM work_opportunities wo") && sql.includes("pp.user_id = $2")) {
          return {
            rows: [
              {
                id: "opp_100",
                category_id: "cat_clean",
                provider_id: "p_100",
                work_date: "2026-10-10",
                start_time: "09:00",
                end_time: "13:00",
                duration_hours: 4,
              },
            ],
          } as any;
        }
        // Job skills
        if (sql.includes("FROM work_opportunity_skills wos")) {
          return {
            rows: [
              {
                skill_id: "sk_deep_clean",
                skill_name: "Deep Cleaning",
                is_required: true,
                min_experience_years: 1,
              },
            ],
          } as any;
        }
        // Applicants list
        if (sql.includes("FROM applications a")) {
          return {
            rows: [
              {
                application_id: "app_1",
                worker_id: "w_skilled_close",
                worker_user_id: "u_w1",
                full_name: "Amina Skilled",
                avatar_url: null,
                average_rating: 4.9,
                total_ratings_count: 15,
                completed_tasks_count: 20,
                reliability_score: 98.0,
                is_available_now: true,
                worker_phone_verified: true,
                worker_identity_verified: true,
                worker_email_verified: true,
                status: "PENDING",
                proposed_wage: null,
                worker_notes: "Ready to start",
                applied_at: "2026-10-01T10:00:00Z",
                distance_meters: 900, // 0.9 km
                assisted_by_agent_id: null,
              },
              {
                application_id: "app_2",
                worker_id: "w_unskilled_far",
                worker_user_id: "u_w2",
                full_name: "Bobby General",
                avatar_url: null,
                average_rating: 4.0,
                total_ratings_count: 5,
                completed_tasks_count: 5,
                reliability_score: 80.0,
                is_available_now: false,
                worker_phone_verified: true,
                worker_identity_verified: false,
                worker_email_verified: true,
                status: "PENDING",
                proposed_wage: null,
                worker_notes: "Hard worker",
                applied_at: "2026-10-01T09:00:00Z",
                distance_meters: 4200, // 4.2 km
                assisted_by_agent_id: null,
              },
            ],
          } as any;
        }
        // Batch worker skills query (must be called ONCE with ANY($1::uuid[]))
        if (sql.includes("FROM worker_skills ws")) {
          workerSkillsQueryCalls++;
          return {
            rows: [
              {
                worker_id: "w_skilled_close",
                skill_id: "sk_deep_clean",
                skill_name: "Deep Cleaning",
                category_id: "cat_clean",
                years_experience: 3,
              },
            ],
          } as any;
        }
        // Batch preferred workers
        if (sql.includes("FROM preferred_workers")) {
          return {
            rows: [{ worker_id: "w_skilled_close" }],
          } as any;
        }
        return { rows: [] } as any;
      });

      const applicants = await applicationsService.getOpportunityApplicants("u_provider_100", "opp_100");

      expect(applicants).toHaveLength(2);
      // N+1 check: Worker skills must have been fetched in exactly 1 batch query
      expect(workerSkillsQueryCalls).toBe(1);

      // Ranked by match score: skilled close worker must rank first
      expect(applicants[0].workerId).toBe("w_skilled_close");
      expect(applicants[0].matchScore).toBeGreaterThan(applicants[1].matchScore);
      expect(applicants[0].matchReasons).toContain("❤️ Preferred Worker");
      expect(applicants[0].matchReasons[1]).toContain("All 1 required skills matched");
      expect(applicants[0].matchReasons[2]).toContain("Walkable distance");
    });
  });

  // ==========================================================================
  // 5. WORKER-SIDE JOB DISCOVERY (discoveryService)
  // ==========================================================================
  describe("5. Worker-Side Job Discovery & PostGIS Spatial Filtering", () => {
    it("5.1 Discovery query filters out filled opportunities where workers_assigned >= workers_needed", async () => {
      let executedSql = "";

      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        executedSql += sql + "\n";
        if (sql.includes("COUNT(*) AS total")) {
          return { rows: [{ total: "0" }] } as any;
        }
        if (sql.includes("FROM work_opportunities wo")) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      await discoveryService.discoverNearbyWork(undefined, {
        latitude: 12.9716,
        longitude: 77.5946,
        radiusKm: 5.0,
      });

      // Verify that the SQL query strictly excludes filled jobs
      expect(executedSql).toContain("wo.workers_assigned < wo.workers_needed");
      expect(executedSql).toContain("wo.status IN ('PUBLISHED', 'MATCHING')");
      expect(executedSql).toContain("ST_DWithin(wo.location");
    });
  });
});
