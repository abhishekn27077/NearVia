import { query, withTransaction } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ReviewInput, ReviewResponse, TrustProfile } from "./types";

export class ReviewsService {
  /**
   * Submit a two-sided review for a completed assignment.
   * Reviewer must be either the worker or the provider of the assignment.
   * reviewerId is `users.id`.
   */
  public async submitReview(
    assignmentId: string,
    reviewerId: string,
    data: ReviewInput
  ): Promise<ReviewResponse> {
    // 1. Validate Assignment and get related user IDs
    const assignmentRes = await query(
      `SELECT 
         a.id, 
         a.status,
         w.user_id AS worker_user_id,
         p.user_id AS provider_user_id,
         a.worker_id AS worker_profile_id,
         a.provider_id AS provider_profile_id
       FROM assignments a
       JOIN worker_profiles w ON a.worker_id = w.id
       JOIN provider_profiles p ON a.provider_id = p.id
       WHERE a.id = $1`,
      [assignmentId]
    );
    
    if (assignmentRes.rowCount === 0) {
      throw new AppError("Assignment not found", 404);
    }
    const assignment = assignmentRes.rows[0];
    if (!assignment) throw new AppError("Assignment not found", 404);

    if (assignment.status !== "COMPLETED") {
      throw new AppError("Can only review COMPLETED assignments", 400);
    }

    // 2. Validate Reviewer & Determine Reviewee
    let revieweeUserId: string;
    let revieweeRole: "WORKER" | "PROVIDER";
    let revieweeProfileId: string;

    if (assignment.worker_user_id === reviewerId) {
      // Worker is reviewing Provider
      revieweeUserId = assignment.provider_user_id;
      revieweeRole = "PROVIDER";
      revieweeProfileId = assignment.provider_profile_id;
    } else if (assignment.provider_user_id === reviewerId) {
      // Provider is reviewing Worker
      revieweeUserId = assignment.worker_user_id;
      revieweeRole = "WORKER";
      revieweeProfileId = assignment.worker_profile_id;
    } else {
      throw new AppError("You are not authorized to review this assignment", 403);
    }

    // 3. Prevent Duplicate Reviews
    const existingReview = await query(
      `SELECT id FROM reviews WHERE assignment_id = $1 AND reviewer_id = $2`,
      [assignmentId, reviewerId]
    );
    if (existingReview.rowCount && existingReview.rowCount > 0) {
      throw new AppError("You have already reviewed this assignment", 400);
    }

    // 4. Transaction: Insert Review and Update Aggregates
    return await withTransaction(async (client) => {
      // Insert Review
      const insertRes = await client.query(
        `INSERT INTO reviews (assignment_id, reviewer_id, reviewee_id, rating, comments)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [assignmentId, reviewerId, revieweeUserId, data.rating, data.comments]
      );
      const newReview = insertRes.rows[0];
      if (!newReview) throw new AppError("Failed to create review", 500);

      // Update aggregates based on role. We use profile ID.
      if (revieweeRole === "WORKER") {
        await client.query(
          `UPDATE worker_profiles 
           SET 
             average_rating = ((average_rating * total_ratings_count) + $1) / (total_ratings_count + 1),
             total_ratings_count = total_ratings_count + 1
           WHERE id = $2`,
          [data.rating, revieweeProfileId]
        );
      } else {
        await client.query(
          `UPDATE provider_profiles 
           SET 
             average_rating = ((average_rating * total_ratings_count) + $1) / (total_ratings_count + 1),
             total_ratings_count = total_ratings_count + 1
           WHERE id = $2`,
          [data.rating, revieweeProfileId]
        );
      }

      return {
        id: newReview.id,
        assignmentId: newReview.assignment_id,
        reviewerId: newReview.reviewer_id,
        revieweeId: newReview.reviewee_id,
        rating: newReview.rating,
        comments: newReview.comments,
        createdAt: newReview.created_at,
      };
    });
  }

  /**
   * Get public trust profile for a user
   * userId is `users.id`
   */
  public async getTrustProfile(userId: string): Promise<TrustProfile> {
    const userRes = await query(
      `SELECT u.id, u.role, u.full_name, u.avatar_url 
       FROM users u WHERE u.id = $1`,
      [userId]
    );
    if (userRes.rowCount === 0) {
      throw new AppError("User not found", 404);
    }
    const user = userRes.rows[0];
    if (!user) throw new AppError("User not found", 404);

    const isWorker = user.role === "WORKER" || user.role === "BOTH";
    const isProvider = user.role === "PROVIDER" || user.role === "BOTH";

    const profile = {
        id: user.id,
        role: user.role,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
        averageRating: 5.0,
        totalRatingsCount: 0,
        completedTasksCount: 0,
        verified: false
    };

    const verifRes = await query(
      `SELECT status FROM verifications WHERE target_id = $1 AND status = 'VERIFIED' LIMIT 1`,
      [userId]
    );
    profile.verified = verifRes.rowCount ? verifRes.rowCount > 0 : false;

    if (isWorker) {
      const workerRes = await query(
        `SELECT id, average_rating, total_ratings_count, completed_tasks_count FROM worker_profiles WHERE user_id = $1`,
        [userId]
      );
      const wp = workerRes.rows[0];
      if (wp) {
        profile.averageRating = parseFloat(wp.average_rating) || 0;
        profile.totalRatingsCount = parseInt(wp.total_ratings_count, 10) || 0;
        profile.completedTasksCount = parseInt(wp.completed_tasks_count, 10) || 0;
      }
    } else if (isProvider) {
      const providerRes = await query(
        `SELECT id, average_rating, total_ratings_count FROM provider_profiles WHERE user_id = $1`,
        [userId]
      );
      const pp = providerRes.rows[0];
      if (pp) {
        profile.averageRating = parseFloat(pp.average_rating) || 0;
        profile.totalRatingsCount = parseInt(pp.total_ratings_count, 10) || 0;
      }
    }

    return profile;
  }

  public async getUserReviews(userId: string, page = 1, limit = 10): Promise<ReviewResponse[]> {
    const offset = (page - 1) * limit;
    const res = await query(
      `SELECT r.id, r.assignment_id, r.reviewer_id, r.reviewee_id, r.rating, r.comments, r.created_at,
              u.full_name as reviewer_name, u.role as reviewer_role, u.avatar_url as reviewer_avatar
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.reviewee_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.rows.map(row => ({
      id: row.id,
      assignmentId: row.assignment_id,
      reviewerId: row.reviewer_id,
      revieweeId: row.reviewee_id,
      rating: row.rating,
      comments: row.comments,
      createdAt: row.created_at,
      reviewer: {
        id: row.reviewer_id,
        fullName: row.reviewer_name,
        role: row.reviewer_role,
        avatarUrl: row.reviewer_avatar
      }
    }));
  }

  public async getMyReviews(userId: string): Promise<{ given: ReviewResponse[], received: ReviewResponse[] }> {
    const givenRes = await query(
      `SELECT r.id, r.assignment_id, r.reviewer_id, r.reviewee_id, r.rating, r.comments, r.created_at
       FROM reviews r
       WHERE r.reviewer_id = $1
       ORDER BY r.created_at DESC LIMIT 50`,
      [userId]
    );

    const receivedRes = await query(
      `SELECT r.id, r.assignment_id, r.reviewer_id, r.reviewee_id, r.rating, r.comments, r.created_at
       FROM reviews r
       WHERE r.reviewee_id = $1
       ORDER BY r.created_at DESC LIMIT 50`,
      [userId]
    );

    const mapReview = (row: any) => ({
      id: row.id,
      assignmentId: row.assignment_id,
      reviewerId: row.reviewer_id,
      revieweeId: row.reviewee_id,
      rating: row.rating,
      comments: row.comments,
      createdAt: row.created_at,
    });

    return {
      given: givenRes.rows.map(mapReview),
      received: receivedRes.rows.map(mapReview)
    };
  }
}

export const reviewsService = new ReviewsService();
