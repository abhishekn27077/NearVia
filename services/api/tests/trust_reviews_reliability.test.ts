import { describe, it, expect, vi, beforeEach } from "vitest";
import { reviewsService } from "../src/modules/reviews/service";
import * as db from "../src/db";
import { AppError } from "../src/middleware/errorHandler";
import { reviewSchema } from "@nearvia/validation";

vi.mock("../src/db", () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

describe("Prompt 8: Trust, Reviews & Reliability Hardening Test Suite", () => {
  const workerUserId = "worker-user-111";
  const providerUserId = "provider-user-222";
  const thirdPartyUserId = "unrelated-user-333";
  const assignmentId = "assignment-uuid-444";
  const workerProfileId = "worker-prof-111";
  const providerProfileId = "provider-prof-222";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Review Authorization & Completion Gate", () => {
    it("should reject review submission if assignment is not COMPLETED (400)", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM assignments a")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: assignmentId,
                status: "IN_PROGRESS",
                worker_user_id: workerUserId,
                provider_user_id: providerUserId,
                worker_profile_id: workerProfileId,
                provider_profile_id: providerProfileId,
              },
            ],
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      await expect(
        reviewsService.submitReview(assignmentId, workerUserId, {
          rating: 5,
          comments: "Great job completed early",
        })
      ).rejects.toThrow("Can only review COMPLETED assignments");
    });

    it("should reject review submission if reviewer is an unrelated third party (403 FORBIDDEN)", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM assignments a")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: assignmentId,
                status: "COMPLETED",
                worker_user_id: workerUserId,
                provider_user_id: providerUserId,
                worker_profile_id: workerProfileId,
                provider_profile_id: providerProfileId,
              },
            ],
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      await expect(
        reviewsService.submitReview(assignmentId, thirdPartyUserId, {
          rating: 4,
          comments: "Intruder attempting to review",
        })
      ).rejects.toThrow("You are not authorized to review this assignment");
    });

    it("should reject review submission if assignment does not exist (404 NOT_FOUND)", async () => {
      vi.mocked(db.query).mockImplementation(async () => {
        return { rowCount: 0, rows: [] } as any;
      });

      await expect(
        reviewsService.submitReview("non-existent-asg", workerUserId, { rating: 5 })
      ).rejects.toThrow("Assignment not found");
    });
  });

  describe("2. Anti-Abuse, Self-Review & Duplicate Prevention", () => {
    it("should reject review when reviewer is also the reviewee (Self-Review 400)", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM assignments a")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: assignmentId,
                status: "COMPLETED",
                worker_user_id: workerUserId,
                provider_user_id: workerUserId, // Same user as both!
                worker_profile_id: workerProfileId,
                provider_profile_id: providerProfileId,
              },
            ],
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      await expect(
        reviewsService.submitReview(assignmentId, workerUserId, {
          rating: 5,
          comments: "Self review praise",
        })
      ).rejects.toThrow("You cannot review yourself");
    });

    it("should reject duplicate reviews on the same assignment by the same reviewer (409 CONFLICT)", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM assignments a")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: assignmentId,
                status: "COMPLETED",
                worker_user_id: workerUserId,
                provider_user_id: providerUserId,
                worker_profile_id: workerProfileId,
                provider_profile_id: providerProfileId,
              },
            ],
          } as any;
        }
        if (sql.includes("SELECT id FROM reviews WHERE assignment_id")) {
          return {
            rowCount: 1,
            rows: [{ id: "existing-review-uuid" }],
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      await expect(
        reviewsService.submitReview(assignmentId, workerUserId, {
          rating: 5,
          comments: "Duplicate review attempt",
        })
      ).rejects.toThrow("You have already reviewed this assignment");
    });
  });

  describe("3. Input Validation via Zod Schema", () => {
    it("should validate that rating must be between 1 and 5", () => {
      expect(() => reviewSchema.parse({ rating: 0 })).toThrow();
      expect(() => reviewSchema.parse({ rating: 6 })).toThrow();
      expect(() => reviewSchema.parse({ rating: 3.5 })).toThrow(); // Must be integer
      expect(() => reviewSchema.parse({ rating: 5 })).not.toThrow();
      expect(() => reviewSchema.parse({ rating: 1 })).not.toThrow();
    });

    it("should reject comments exceeding 1000 characters", () => {
      const longComment = "a".repeat(1001);
      expect(() => reviewSchema.parse({ rating: 5, comments: longComment })).toThrow();
      const validComment = "a".repeat(1000);
      expect(() => reviewSchema.parse({ rating: 5, comments: validComment })).not.toThrow();
    });
  });

  describe("4. Authoritative DB Rating Aggregate Calculation", () => {
    it("should compute exact new average rating and count on review submission", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM assignments a")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: assignmentId,
                status: "COMPLETED",
                worker_user_id: workerUserId,
                provider_user_id: providerUserId,
                worker_profile_id: workerProfileId,
                provider_profile_id: providerProfileId,
              },
            ],
          } as any;
        }
        if (sql.includes("SELECT id FROM reviews WHERE assignment_id")) {
          return { rowCount: 0, rows: [] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      let updatedRating: number | null = null;
      let updatedCount: number | null = null;

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        const fakeClient = {
          query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
            if (sql.includes("INSERT INTO reviews")) {
              return {
                rows: [
                  {
                    id: "new-review-id",
                    assignment_id: assignmentId,
                    reviewer_id: workerUserId,
                    reviewee_id: providerUserId,
                    rating: 4,
                    comments: "Solid work and prompt settlement",
                    created_at: new Date().toISOString(),
                  },
                ],
              };
            }
            if (sql.includes("SELECT \n           COALESCE(ROUND(AVG(rating)::numeric, 2), 0) AS avg_rating")) {
              // Simulating DB aggregate calculation of 2 reviews: 5 and 4 -> 4.5
              return {
                rows: [{ avg_rating: "4.50", total_count: 2 }],
              };
            }
            if (sql.includes("UPDATE provider_profiles")) {
              updatedRating = params[0];
              updatedCount = params[1];
              return { rows: [] };
            }
            return { rows: [] };
          }),
        };
        return cb(fakeClient as any);
      });

      const res = await reviewsService.submitReview(assignmentId, workerUserId, {
        rating: 4,
        comments: "Solid work and prompt settlement",
      });

      expect(res.id).toBe("new-review-id");
      expect(res.rating).toBe(4);
      expect(updatedRating).toBe(4.5);
      expect(updatedCount).toBe(2);
    });
  });

  describe("5. Trust Profile Signals & Zero Fake Defaults", () => {
    it("should return hasRatingHistory: false and averageRating: null for new user with 0 reviews (NO fake 5.0)", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM users u WHERE u.id = $1")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: workerUserId,
                role: "WORKER",
                full_name: "Fresh Worker",
                avatar_url: null,
                created_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        if (sql.includes("SELECT \n         COALESCE(ROUND(AVG(rating)::numeric, 2), 0) AS avg_rating")) {
          // Zero reviews in DB
          return {
            rowCount: 1,
            rows: [{ avg_rating: "0", total_count: 0 }],
          } as any;
        }
        if (sql.includes("FROM verifications")) {
          return { rowCount: 0, rows: [] } as any; // Not verified
        }
        if (sql.includes("FROM worker_profiles wp")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: workerProfileId,
                completed_tasks_count: 0,
                total_concluded: 0,
                completed_count: 0,
                cancelled_count: 0,
                no_shows_count: 0,
                checked_in_count: 0,
                on_time_check_ins: 0,
              },
            ],
          } as any;
        }
        if (sql.includes("FROM worker_skills")) {
          return { rowCount: 0, rows: [] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const profile = await reviewsService.getTrustProfile(workerUserId);

      // Verifying strict absence of fake 5.0 and fake verified badges
      expect(profile.averageRating).toBeNull();
      expect(profile.totalRatingsCount).toBe(0);
      expect(profile.hasRatingHistory).toBe(false);
      expect(profile.verified).toBe(false);
      expect(profile.completedJobs).toBe(0);
      expect(profile.completionRate).toBeNull();
      expect(profile.reputationStatus).toBe("NEW");
    });

    it("should calculate real completion rate, reliability, and veteran status for experienced worker", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM users u WHERE u.id = $1")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: workerUserId,
                role: "WORKER",
                full_name: "Veteran Worker",
                avatar_url: "https://nearvia.in/avatar.jpg",
                created_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        if (sql.includes("SELECT \n         COALESCE(ROUND(AVG(rating)::numeric, 2), 0) AS avg_rating")) {
          return {
            rowCount: 1,
            rows: [{ avg_rating: "4.85", total_count: 12 }],
          } as any;
        }
        if (sql.includes("FROM verifications")) {
          return {
            rowCount: 1,
            rows: [{ status: "VERIFIED", expires_at: null }],
          } as any;
        }
        if (sql.includes("FROM worker_profiles wp")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: workerProfileId,
                completed_tasks_count: 12,
                total_concluded: 13, // 12 completed, 1 cancelled, 0 no-show
                completed_count: 12,
                cancelled_count: 1,
                no_shows_count: 0,
                checked_in_count: 12,
                on_time_check_ins: 11,
              },
            ],
          } as any;
        }
        if (sql.includes("FROM worker_skills")) {
          return {
            rowCount: 2,
            rows: [{ name: "Carpentry" }, { name: "Plumbing" }],
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const profile = await reviewsService.getTrustProfile(workerUserId);

      expect(profile.averageRating).toBe(4.85);
      expect(profile.totalRatingsCount).toBe(12);
      expect(profile.hasRatingHistory).toBe(true);
      expect(profile.verified).toBe(true);
      expect(profile.completedJobs).toBe(12);
      // 12 / 13 = 92%
      expect(profile.completionRate).toBe(92);
      expect(profile.reliabilityScore).toBe(92);
      expect(profile.onTimeCheckInRate).toBe(92); // 11/12
      expect(profile.reputationStatus).toBe("VETERAN"); // >= 10
      expect(profile.skills).toEqual(["Carpentry", "Plumbing"]);
    });

    it("should never expose private addresses, phone numbers, or internal moderation logs", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM users u WHERE u.id = $1")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: workerUserId,
                role: "WORKER",
                full_name: "Private User",
                avatar_url: null,
                created_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const profile = await reviewsService.getTrustProfile(workerUserId);

      expect((profile as any).phone).toBeUndefined();
      expect((profile as any).address).toBeUndefined();
      expect((profile as any).location).toBeUndefined();
      expect((profile as any).reports).toBeUndefined();
      expect((profile as any).disputes).toBeUndefined();
    });
  });
});
