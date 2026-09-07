import { describe, it, expect, vi, beforeEach } from "vitest";
import { reviewsService } from "../src/modules/reviews/service";
import * as db from "../src/db";
import { AppError } from "../src/middleware/errorHandler";

// Mock the db module
vi.mock("../src/db", () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

describe("Reviews Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("submitReview", () => {
    const assignmentId = "assign-123";
    const workerUserId = "worker-user-123";
    const providerUserId = "provider-user-123";
    const workerProfileId = "worker-profile-123";
    const providerProfileId = "provider-profile-123";

    it("should allow worker to review a completed assignment", async () => {
      // Mock assignment fetch
      vi.mocked(db.query).mockImplementation(async (sql: string, params: any) => {
        if (sql.includes("SELECT \n         a.id, \n         a.status")) {
          return {
            rowCount: 1,
            rows: [{
              id: assignmentId,
              status: "COMPLETED",
              worker_user_id: workerUserId,
              provider_user_id: providerUserId,
              worker_profile_id: workerProfileId,
              provider_profile_id: providerProfileId
            }]
          } as any;
        }
        if (sql.includes("SELECT id FROM reviews WHERE assignment_id")) {
          return { rowCount: 0, rows: [] } as any; // No existing review
        }
        return { rowCount: 0, rows: [] } as any;
      });

      // Mock transaction
      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        const fakeClient = {
          query: vi.fn().mockImplementation(async (sql: string, params: any) => {
            if (sql.includes("INSERT INTO reviews")) {
              return {
                rows: [{
                  id: "review-123",
                  assignment_id: assignmentId,
                  reviewer_id: workerUserId,
                  reviewee_id: providerUserId,
                  rating: 5,
                  comments: "Great provider!",
                  created_at: new Date().toISOString()
                }]
              };
            }
            if (sql.includes("UPDATE provider_profiles")) {
              return { rows: [] };
            }
            return { rows: [] };
          })
        };
        return cb(fakeClient as any);
      });

      const res = await reviewsService.submitReview(assignmentId, workerUserId, {
        rating: 5,
        comments: "Great provider!"
      });

      expect(res.id).toBe("review-123");
      expect(res.rating).toBe(5);
      expect(res.revieweeId).toBe(providerUserId);
    });

    it("should reject review if assignment is not completed", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM assignments a")) {
          return {
            rowCount: 1,
            rows: [{ status: "IN_PROGRESS" }]
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      await expect(reviewsService.submitReview(assignmentId, workerUserId, { rating: 4 }))
        .rejects.toThrow("Can only review COMPLETED assignments");
    });
  });
});
