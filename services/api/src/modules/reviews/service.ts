import { query, withTransaction } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ReviewInput, ReviewResponse, TrustProfile, ReputationStatus } from "./types";
import { notificationsService } from "../notifications/service";

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

    // Completed check: Only completed assignments may be reviewed
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

    // Anti-Abuse: Prevent self-review (edge cases where user is both worker and provider)
    if (reviewerId === revieweeUserId) {
      throw new AppError("You cannot review yourself", 400);
    }

    // 3. Prevent Duplicate Reviews
    const existingReview = await query(
      `SELECT id FROM reviews WHERE assignment_id = $1 AND reviewer_id = $2`,
      [assignmentId, reviewerId]
    );
    if (existingReview.rowCount && existingReview.rowCount > 0) {
      throw new AppError("You have already reviewed this assignment", 409);
    }

    // 4. Transaction: Insert Review and Update Aggregates Authoritatively
    const review = await withTransaction(async (client) => {
      // Insert Review
      const insertRes = await client.query(
        `INSERT INTO reviews (assignment_id, reviewer_id, reviewee_id, rating, comments)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [assignmentId, reviewerId, revieweeUserId, data.rating, data.comments || null]
      );
      const newReview = insertRes.rows[0];
      if (!newReview) throw new AppError("Failed to create review", 500);

      // Authoritatively compute new aggregates from real DB reviews
      const aggRes = await client.query(
        `SELECT 
           COALESCE(ROUND(AVG(rating)::numeric, 2), 0) AS avg_rating,
           COUNT(*)::int AS total_count
         FROM reviews
         WHERE reviewee_id = $1`,
        [revieweeUserId]
      );

      const newAvgRating = parseFloat(aggRes.rows[0]?.avg_rating || "0");
      const newTotalCount = parseInt(aggRes.rows[0]?.total_count || "0", 10);

      // Update profile with authoritative aggregates
      if (revieweeRole === "WORKER") {
        await client.query(
          `UPDATE worker_profiles 
           SET 
             average_rating = $1,
             total_ratings_count = $2,
             updated_at = NOW()
           WHERE id = $3`,
          [newAvgRating, newTotalCount, revieweeProfileId]
        );
      } else {
        await client.query(
          `UPDATE provider_profiles 
           SET 
             average_rating = $1,
             total_ratings_count = $2,
             updated_at = NOW()
           WHERE id = $3`,
          [newAvgRating, newTotalCount, revieweeProfileId]
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

    // Notify reviewee outside transaction
    try {
      await notificationsService.createNotification(
        revieweeUserId,
        "NEW_REVIEW",
        "New Rating & Review Received",
        `You received a ${data.rating}-star review for your recent shift.`,
        { assignmentId, rating: data.rating },
      );
    } catch (e) {
      console.error("Failed to notify reviewee:", e);
    }

    return review;
  }

  /**
   * Get authoritative public trust profile for a user based ONLY on real completed activity.
   * userId is `users.id`
   */
  public async getTrustProfile(userId: string): Promise<TrustProfile> {
    const userRes = await query(
      `SELECT u.id, u.role, u.full_name, u.avatar_url, u.created_at 
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

    // 1. Authoritative Rating Aggregates from DB reviews
    const ratingRes = await query(
      `SELECT 
         COALESCE(ROUND(AVG(rating)::numeric, 2), 0) AS avg_rating,
         COUNT(*)::int AS total_count
       FROM reviews 
       WHERE reviewee_id = $1`,
      [userId]
    );

    const totalRatingsCount = parseInt(ratingRes.rows[0]?.total_count || "0", 10);
    const hasRatingHistory = totalRatingsCount > 0;
    const averageRating = hasRatingHistory ? parseFloat(ratingRes.rows[0]?.avg_rating || "0") : null;

    // 2. Real Verification Status from verifications table
    const verifRes = await query(
      `SELECT status, expires_at 
       FROM verifications 
       WHERE target_id = $1 AND status = 'VERIFIED' 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    const verifRow = verifRes.rows[0];
    const isVerified = Boolean(
      verifRow &&
      verifRow.status === "VERIFIED" &&
      (!verifRow.expires_at || new Date(verifRow.expires_at) > new Date())
    );

    // 3. Authoritative Assignment & Reliability Metrics
    let completedJobs = 0;
    let completedTasksCount = 0;
    let completionRate: number | null = null;
    let reliabilityScore: number | null = null;
    let onTimeCheckInRate: number | null = null;
    let reputationStatus: ReputationStatus = "NEW";
    let skills: string[] = [];

    if (isWorker) {
      const workerRes = await query(
        `SELECT wp.id, wp.completed_tasks_count,
           COUNT(a.id)::int AS total_concluded,
           COUNT(a.id) FILTER (WHERE a.status = 'COMPLETED')::int AS completed_count,
           COUNT(a.id) FILTER (WHERE a.status = 'CANCELLED')::int AS cancelled_count,
           COUNT(a.id) FILTER (WHERE a.status = 'NO_SHOW')::int AS no_shows_count,
           COUNT(a.id) FILTER (WHERE a.check_in_time IS NOT NULL)::int AS checked_in_count,
           COUNT(a.id) FILTER (
             WHERE a.check_in_time IS NOT NULL 
               AND a.scheduled_start_time IS NOT NULL 
               AND a.check_in_time <= a.scheduled_start_time + INTERVAL '15 minutes'
           )::int AS on_time_check_ins
         FROM worker_profiles wp
         LEFT JOIN assignments a ON wp.id = a.worker_id AND a.status IN ('COMPLETED', 'CANCELLED', 'NO_SHOW')
         WHERE wp.user_id = $1
         GROUP BY wp.id, wp.completed_tasks_count`,
        [userId]
      );

      const wp = workerRes.rows[0];
      if (wp) {
        completedTasksCount = parseInt(wp.completed_tasks_count || "0", 10);
        completedJobs = parseInt(wp.completed_count || "0", 10);
        const totalConcluded = parseInt(wp.total_concluded || "0", 10);
        const cancelledCount = parseInt(wp.cancelled_count || "0", 10);
        const noShowsCount = parseInt(wp.no_shows_count || "0", 10);
        const checkedInCount = parseInt(wp.checked_in_count || "0", 10);
        const onTimeCheckIns = parseInt(wp.on_time_check_ins || "0", 10);

        if (totalConcluded > 0) {
          completionRate = Math.round((completedJobs / totalConcluded) * 100);
          // Reliability formula: completed / (completed + cancelled + 2 * no_shows) * 100
          const denominator = completedJobs + cancelledCount + 2 * noShowsCount;
          reliabilityScore = denominator > 0
            ? Math.round(Math.min(100, Math.max(0, (completedJobs / denominator) * 100)))
            : 100;
        }

        if (checkedInCount > 0) {
          onTimeCheckInRate = Math.round((onTimeCheckIns / checkedInCount) * 100);
        }

        // Reputation status based on verified activity
        if (completedJobs >= 10) {
          reputationStatus = "VETERAN";
        } else if (completedJobs >= 3) {
          reputationStatus = "ESTABLISHED";
        } else {
          reputationStatus = "NEW";
        }

        // Fetch skills for worker
        const skillsRes = await query(
          `SELECT s.name 
           FROM worker_skills ws 
           JOIN skills s ON ws.skill_id = s.id 
           WHERE ws.worker_id = $1`,
          [wp.id]
        );
        skills = skillsRes.rows.map((r: any) => r.name);
      }
    } else if (isProvider) {
      const providerRes = await query(
        `SELECT pp.id,
           COUNT(DISTINCT wo.id)::int AS posted_jobs,
           COUNT(DISTINCT wo.id) FILTER (WHERE wo.status = 'COMPLETED')::int AS completed_jobs,
           COUNT(a.id)::int AS total_concluded,
           COUNT(a.id) FILTER (WHERE a.status = 'COMPLETED')::int AS completed_assignments
         FROM provider_profiles pp
         LEFT JOIN work_opportunities wo ON pp.id = wo.provider_id
         LEFT JOIN assignments a ON wo.id = a.work_opportunity_id AND a.status IN ('COMPLETED', 'CANCELLED', 'NO_SHOW')
         WHERE pp.user_id = $1
         GROUP BY pp.id`,
        [userId]
      );

      const pp = providerRes.rows[0];
      if (pp) {
        completedJobs = parseInt(pp.completed_jobs || "0", 10);
        completedTasksCount = completedJobs;
        const totalConcluded = parseInt(pp.total_concluded || "0", 10);
        const completedAssignments = parseInt(pp.completed_assignments || "0", 10);

        if (totalConcluded > 0) {
          completionRate = Math.round((completedAssignments / totalConcluded) * 100);
          reliabilityScore = completionRate;
        }

        if (completedJobs >= 10) {
          reputationStatus = "VETERAN";
        } else if (completedJobs >= 3) {
          reputationStatus = "ESTABLISHED";
        } else {
          reputationStatus = "NEW";
        }
      }
    }

    return {
      id: user.id,
      role: user.role,
      fullName: user.full_name,
      avatarUrl: user.avatar_url,
      averageRating,
      totalRatingsCount,
      hasRatingHistory,
      completedTasksCount,
      completedJobs,
      completionRate,
      reliabilityScore,
      onTimeCheckInRate,
      reputationStatus,
      verified: isVerified,
      skills: skills.length > 0 ? skills : undefined,
      memberSince: user.created_at,
    };
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

    return res.rows.map((row) => ({
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
        avatarUrl: row.reviewer_avatar,
      },
    }));
  }

  public async getMyReviews(userId: string): Promise<{ given: ReviewResponse[]; received: ReviewResponse[] }> {
    const givenRes = await query(
      `SELECT r.id, r.assignment_id, r.reviewer_id, r.reviewee_id, r.rating, r.comments, r.created_at,
              u.full_name as reviewee_name, u.role as reviewee_role, u.avatar_url as reviewee_avatar
       FROM reviews r
       JOIN users u ON r.reviewee_id = u.id
       WHERE r.reviewer_id = $1
       ORDER BY r.created_at DESC LIMIT 50`,
      [userId]
    );

    const receivedRes = await query(
      `SELECT r.id, r.assignment_id, r.reviewer_id, r.reviewee_id, r.rating, r.comments, r.created_at,
              u.full_name as reviewer_name, u.role as reviewer_role, u.avatar_url as reviewer_avatar
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.reviewee_id = $1
       ORDER BY r.created_at DESC LIMIT 50`,
      [userId]
    );

    const mapReview = (row: any, counterparty: "reviewer" | "reviewee") => ({
      id: row.id,
      assignmentId: row.assignment_id,
      reviewerId: row.reviewer_id,
      revieweeId: row.reviewee_id,
      rating: row.rating,
      comments: row.comments,
      createdAt: row.created_at,
      reviewer: counterparty === "reviewer" ? {
        id: row.reviewer_id,
        fullName: row.reviewer_name,
        role: row.reviewer_role,
        avatarUrl: row.reviewer_avatar,
      } : undefined,
    });

    return {
      given: givenRes.rows.map((r) => mapReview(r, "reviewee")),
      received: receivedRes.rows.map((r) => mapReview(r, "reviewer")),
    };
  }
}

export const reviewsService = new ReviewsService();
