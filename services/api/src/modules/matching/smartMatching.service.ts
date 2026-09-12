/**
 * NearVia Phase 9: Smart Matching Service
 * 
 * Provides deterministic, explainable, privacy-preserving worker matching
 * for provider work opportunities.
 * 
 * Rules:
 * - 100% server-side deterministic scoring (zero external paid AI/LLMs).
 * - Real PostgreSQL / PostGIS data only.
 * - Strict provider authorization (only job owner or Admin can view matches).
 * - Hard eligibility exclusions (deactivated, offline, stale, out-of-radius, missing location).
 * - Fair new worker handling (neutral baseline without fake scores).
 * - Zero private data leakage (no exact coordinates, phone, email, or KYC documents).
 */

import {
  SmartMatchCandidate,
  JobMatchesResponse,
  DistanceBucket,
  AvailabilityStatus,
} from "@nearvia/types";
import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode, NEARVIA_CONFIG } from "@nearvia/config";
import { formatDistance } from "@nearvia/shared";

interface RawCandidateRow {
  worker_id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  experience_years: number | null;
  service_radius_km: number | null;
  availability_status: string;
  is_available_now: boolean;
  available_until: string | null;
  availability_updated_at: string | null;
  last_seen_at: string | null;
  average_rating: number | null;
  total_ratings_count: number | null;
  completed_tasks_count: number | null;
  reliability_score: number | null;
  verified_badge: boolean | null;
  on_time_arrival_rate: number | null;
  distance_meters: number;
  is_preferred_worker: boolean;
}

interface RequiredSkillRow {
  skill_id: string;
  skill_name: string;
  category_id: string;
  min_experience_years: number;
  is_required: boolean;
}

interface WorkerSkillRow {
  worker_id: string;
  skill_id: string;
  skill_name: string;
  category_id: string;
  years_experience: number;
}

interface WorkerSlotRow {
  worker_id: string;
  start_time: string;
  end_time: string;
  status: string;
}

export class SmartMatchingService {
  /**
   * Retrieves deterministic, ranked smart matches for a given work opportunity.
   */
  public async getMatchesForJob(
    jobId: string,
    providerUserId: string,
    isAdmin: boolean = false,
    options?: { radiusKm?: number; limit?: number }
  ): Promise<JobMatchesResponse> {
    // 1. Fetch Opportunity Details
    const jobRes = await query<{
      id: string;
      provider_id: string;
      category_id: string;
      category_name: string;
      title: string;
      work_date: string;
      start_time: string;
      end_time: string;
      duration_hours: number;
      latitude: number | null;
      longitude: number | null;
      status: string;
      workers_needed: number;
      workers_assigned: number;
    }>(
      `SELECT 
        wo.id,
        wo.provider_id,
        wo.category_id,
        c.name AS category_name,
        wo.title,
        wo.work_date,
        wo.start_time,
        wo.end_time,
        wo.duration_hours,
        ST_Y(wo.location::geometry) AS latitude,
        ST_X(wo.location::geometry) AS longitude,
        wo.status,
        wo.workers_needed,
        wo.workers_assigned
       FROM work_opportunities wo
       JOIN categories c ON wo.category_id = c.id
       WHERE wo.id = $1`,
      [jobId]
    );

    const job = jobRes.rows[0];
    if (!job) {
      throw new AppError("Work opportunity not found", 404, ErrorCode.NOT_FOUND);
    }

    if (job.latitude === null || job.longitude === null) {
      throw new AppError("Work opportunity does not have valid coordinates", 400, ErrorCode.LOCATION_REQUIRED);
    }

    // Eligibility check: If job is already filled or closed/cancelled, return 0 matches
    if (
      job.status === "COMPLETED" ||
      job.status === "CANCELLED" ||
      job.status === "CLOSED" ||
      Number(job.workers_assigned) >= Number(job.workers_needed)
    ) {
      return {
        jobId,
        jobTitle: job.title,
        jobCategoryName: job.category_name,
        totalMatches: 0,
        matches: [],
      };
    }

    // 2. Enforce Provider Ownership / Authorization
    if (!isAdmin) {
      const providerRes = await query<{ id: string }>(
        `SELECT id FROM provider_profiles WHERE user_id = $1`,
        [providerUserId]
      );
      const providerProfile = providerRes.rows[0];
      if (!providerProfile || providerProfile.id !== job.provider_id) {
        throw new AppError(
          "You are not authorized to view matches for another provider's job",
          403,
          ErrorCode.FORBIDDEN
        );
      }
    }

    // 3. Search Radius Setup (Default 5 km, bounded to [1, 15] km)
    const effectiveRadiusKm = Math.min(
      Math.max(Number(options?.radiusKm || NEARVIA_CONFIG.HYPERLOCAL.DEFAULT_RADIUS_KM), 1.0),
      NEARVIA_CONFIG.HYPERLOCAL.MAX_RADIUS_KM
    );
    const radiusMeters = effectiveRadiusKm * 1000;
    const limit = Math.min(Math.max(Number(options?.limit || 20), 1), 50);

    // 4. Fetch Job Skills (Required & Optional)
    const skillsRes = await query<RequiredSkillRow>(
      `SELECT 
        wos.skill_id,
        s.name AS skill_name,
        s.category_id,
        COALESCE(wos.min_experience_years, 0) AS min_experience_years,
        wos.is_required
       FROM work_opportunity_skills wos
       JOIN skills s ON wos.skill_id = s.id
       WHERE wos.work_opportunity_id = $1`,
      [jobId]
    );

    const requiredSkills = skillsRes.rows.filter((s) => s.is_required);
    const optionalSkills = skillsRes.rows.filter((s) => !s.is_required);

    // 5. Query Eligible Nearby Workers via PostGIS
    // Hard exclusions performed in SQL:
    // - User must be active (is_active = TRUE)
    // - Role must be WORKER
    // - Must have valid geography point (location IS NOT NULL)
    // - Must be within effective job radius AND worker's own service_radius_km
    // - Must NOT be OFFLINE
    // - If available_now = TRUE: must NOT be stale (>12h) and must NOT be expired
    // - If not available_now: must have scheduled availability slot on job date
    const candidatesRes = await query<RawCandidateRow>(
      `SELECT 
        wp.id AS worker_id,
        wp.user_id,
        u.full_name,
        u.avatar_url,
        wp.bio,
        wp.experience_years,
        wp.service_radius_km,
        wp.availability_status,
        wp.is_available_now,
        wp.available_until,
        wp.availability_updated_at,
        wp.last_seen_at,
        wp.average_rating,
        wp.total_ratings_count,
        wp.completed_tasks_count,
        COALESCE(wp.reliability_score, 100.0) AS reliability_score,
        COALESCE(wp.verified_badge, FALSE) AS verified_badge,
        COALESCE(wp.on_time_arrival_rate, 100.0) AS on_time_arrival_rate,
        ST_Distance(wp.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters,
        EXISTS(
          SELECT 1 FROM preferred_workers pw 
          WHERE pw.provider_id = $3 AND pw.worker_id = wp.id
        ) AS is_preferred_worker
       FROM worker_profiles wp
       JOIN users u ON wp.user_id = u.id
       WHERE u.is_active = TRUE
         AND u.role = 'WORKER'
         AND wp.location IS NOT NULL
         AND wp.availability_status != 'OFFLINE'
         AND ST_DWithin(wp.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $4)
         AND ST_Distance(wp.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) <= (COALESCE(wp.service_radius_km, 5.0) * 1000)
         AND (
           (
             wp.is_available_now = TRUE 
             AND (wp.available_until IS NULL OR wp.available_until > NOW())
             AND (wp.availability_updated_at IS NULL OR wp.availability_updated_at >= NOW() - INTERVAL '12 hours')
           )
           OR
           EXISTS (
             SELECT 1 FROM worker_availability wa
             WHERE wa.worker_id = wp.id
               AND wa.availability_date = $5
               AND wa.status IN ('AVAILABLE_NOW', 'AVAILABLE_LATER')
           )
         )
       LIMIT 100`,
      [job.longitude, job.latitude, job.provider_id, radiusMeters, job.work_date]
    );

    if (candidatesRes.rows.length === 0) {
      return {
        jobId,
        jobTitle: job.title,
        jobCategoryName: job.category_name,
        totalMatches: 0,
        matches: [],
      };
    }

    const workerIds = candidatesRes.rows.map((c) => c.worker_id);

    // 6. Batch Fetch Worker Trade Skills (Avoids N+1 queries, DISTINCT eliminates duplication)
    const workerSkillsRes = await query<WorkerSkillRow>(
      `SELECT DISTINCT
        ws.worker_id,
        ws.skill_id,
        s.name AS skill_name,
        s.category_id,
        COALESCE(ws.years_experience, 0) AS years_experience
       FROM worker_skills ws
       JOIN skills s ON ws.skill_id = s.id
       WHERE ws.worker_id = ANY($1::uuid[])`,
      [workerIds]
    );

    const workerSkillsMap = new Map<string, WorkerSkillRow[]>();
    for (const row of workerSkillsRes.rows) {
      const list = workerSkillsMap.get(row.worker_id) || [];
      list.push(row);
      workerSkillsMap.set(row.worker_id, list);
    }

    // 7. Batch Fetch Worker Availability Slots for Job Date
    const workerSlotsRes = await query<WorkerSlotRow>(
      `SELECT 
        worker_id,
        start_time,
        end_time,
        status
       FROM worker_availability
       WHERE worker_id = ANY($1::uuid[])
         AND availability_date = $2
         AND status IN ('AVAILABLE_NOW', 'AVAILABLE_LATER')`,
      [workerIds, job.work_date]
    );

    const workerSlotsMap = new Map<string, WorkerSlotRow[]>();
    for (const row of workerSlotsRes.rows) {
      const list = workerSlotsMap.get(row.worker_id) || [];
      list.push(row);
      workerSlotsMap.set(row.worker_id, list);
    }

    // 8. Deterministic Scoring & Privacy-Safe Transformation
    const scoredList: SmartMatchCandidate[] = [];

    for (const c of candidatesRes.rows) {
      const workerSkills = workerSkillsMap.get(c.worker_id) || [];
      const workerSlots = workerSlotsMap.get(c.worker_id) || [];
      const distanceKm = Math.round((c.distance_meters / 1000) * 100) / 100;

      // Distance bucket
      let distanceBucket: DistanceBucket;
      if (distanceKm <= 1.0) distanceBucket = "WALKABLE";
      else if (distanceKm <= 2.0) distanceBucket = "NEARBY";
      else if (distanceKm <= 3.0) distanceBucket = "WITHIN_3KM";
      else if (distanceKm <= 5.0) distanceBucket = "WITHIN_5KM";
      else distanceBucket = "WITHIN_RADIUS";

      // Distance score (20% weight, linear decay)
      const distRatio = Math.min(1, distanceKm / effectiveRadiusKm);
      const distanceScore = Math.max(0, Math.round(100 * (1 - distRatio)));

      // Skill match (35% weight)
      const matchedRequired = requiredSkills.filter((req) =>
        workerSkills.some((ws) => ws.skill_id === req.skill_id)
      );
      const matchedOptional = optionalSkills.filter((opt) =>
        workerSkills.some((ws) => ws.skill_id === opt.skill_id)
      );

      const matchedSkillNames = [
        ...matchedRequired.map((m) => m.skill_name),
        ...matchedOptional.map((o) => o.skill_name),
      ];
      const allWorkerSkillNames = Array.from(
        new Set(workerSkills.map((ws) => ws.skill_name))
      );

      let skillScore = 100;
      let expBonus = 0;
      if (requiredSkills.length > 0) {
        const requiredRatio = matchedRequired.length / requiredSkills.length;
        // Check experience
        for (const req of matchedRequired) {
          const ws = workerSkills.find((w) => w.skill_id === req.skill_id);
          if (ws && ws.years_experience >= req.min_experience_years) {
            expBonus += 10;
          }
        }
        const baseSkill = requiredRatio * 80;
        skillScore = Math.min(100, Math.round(baseSkill + Math.min(expBonus, 15) + matchedOptional.length * 5));
      }

      // Category fit (10% weight)
      const hasCategorySkill = workerSkills.some(
        (ws) => ws.category_id === job.category_id
      );
      const categoryScore = hasCategorySkill ? 100 : 40;

      // Availability & freshness fit (15% weight)
      let availabilityScore = 70;
      let availabilityReason = "Available";
      if (c.is_available_now) {
        const updatedAtMs = c.availability_updated_at
          ? new Date(c.availability_updated_at).getTime()
          : Date.now();
        const diffHours = (Date.now() - updatedAtMs) / (1000 * 60 * 60);
        if (diffHours <= 2) {
          availabilityScore = 100;
          availabilityReason = "Available Now (Live)";
        } else {
          availabilityScore = 90;
          availabilityReason = "Available Now";
        }
      } else if (workerSlots.length > 0) {
        availabilityScore = 85;
        availabilityReason = "Schedule matches shift timing";
      }

      // Reliability & history fit (10% weight)
      // FAIRNESS RULE: New workers (<3 tasks) receive neutral baseline (70), no fake scores
      const completedTasks = Number(c.completed_tasks_count || 0);
      const isNewWorkerTasks = completedTasks < 3;
      let reliabilityScore = 70;
      if (!isNewWorkerTasks) {
        reliabilityScore = Math.min(100, Math.max(0, Number(c.reliability_score || 100)));
      }

      // Ratings & reviews fit (5% weight)
      // FAIRNESS RULE: New workers (<3 ratings) receive neutral baseline (70), no fake ratings
      const totalRatings = Number(c.total_ratings_count || 0);
      const isNewWorkerRatings = totalRatings < 3;
      let ratingScore = 70;
      const avgRating = Number(c.average_rating || 5.0);
      if (!isNewWorkerRatings) {
        ratingScore = Math.min(100, Math.max(0, Math.round(((avgRating - 1) / 4) * 100)));
      }

      // Verification status (5% weight)
      const isVerified = Boolean(c.verified_badge);
      const verificationScore = isVerified ? 100 : 50;

      // Preferred worker affinity boost (+5%)
      const isPreferred = Boolean(c.is_preferred_worker);
      const preferredBonus = isPreferred ? 5 : 0;

      // Composite multi-factor score calculation [0, 100]
      const rawScore =
        skillScore * 0.35 +
        categoryScore * 0.10 +
        distanceScore * 0.20 +
        availabilityScore * 0.15 +
        reliabilityScore * 0.10 +
        ratingScore * 0.05 +
        verificationScore * 0.05 +
        preferredBonus;

      const finalMatchScore = Math.min(100, Math.max(0, Math.round(rawScore)));

      // Generate concise human-friendly "why matched" explanation
      const highlights: string[] = [];
      const reasonPhrases: string[] = [];

      // Skills highlight
      if (requiredSkills.length > 0) {
        if (matchedRequired.length === requiredSkills.length) {
          highlights.push(`✓ All ${requiredSkills.length} required skills`);
          reasonPhrases.push("Strong skill match");
        } else if (matchedRequired.length > 0) {
          highlights.push(`✓ ${matchedRequired.length} of ${requiredSkills.length} required skills`);
          reasonPhrases.push("Partial skill match");
        }
      } else {
        highlights.push("✓ General support capabilities");
        reasonPhrases.push("Skills compatible");
      }

      // Add top matched skill names
      for (const s of matchedSkillNames.slice(0, 2)) {
        highlights.push(`✓ ${s}`);
      }

      // Proximity highlight
      if (distanceKm <= 1.0) {
        highlights.push(`✓ Walkable (${formatDistance(distanceKm)})`);
        reasonPhrases.push("walkable distance");
      } else if (distanceKm <= 2.5) {
        highlights.push(`✓ Nearby (${formatDistance(distanceKm)})`);
        reasonPhrases.push("nearby");
      } else {
        highlights.push(`✓ Within ${effectiveRadiusKm} km (${formatDistance(distanceKm)})`);
        reasonPhrases.push("within reach");
      }

      // Availability highlight
      highlights.push(`✓ ${availabilityReason}`);
      if (c.is_available_now) {
        reasonPhrases.push("currently available");
      }

      // Preferred worker highlight (High Priority for Provider)
      if (isPreferred) {
        highlights.unshift("❤️ Preferred Worker");
        reasonPhrases.unshift("preferred worker");
      }

      // Verification highlight
      if (isVerified) {
        highlights.push("✓ Verified Worker");
      }

      // New worker highlight (High Priority for fairness and transparency)
      const isNewWorker = isNewWorkerTasks && isNewWorkerRatings;
      if (isNewWorker) {
        highlights.unshift("New Worker • Building Track Record");
      }

      // Reliability highlight if veteran
      if (!isNewWorkerTasks && reliabilityScore >= 95) {
        highlights.push(`🛡️ High reliability (${reliabilityScore}%)`);
      }

      // Assemble concise reason sentence
      const whyMatched = reasonPhrases.length > 0
        ? reasonPhrases.slice(0, 3).join(" + ") + "."
        : "Matching neighborhood profile.";

      scoredList.push({
        workerId: c.worker_id,
        rank: 0, // Assigned after sorting
        matchScore: finalMatchScore,
        fullName: c.full_name,
        avatarUrl: c.avatar_url || undefined,
        bio: c.bio || undefined,
        experienceYears: Number(c.experience_years || 0),
        matchedSkills: matchedSkillNames,
        allSkills: allWorkerSkillNames,
        distanceBucket,
        approximateDistanceKm: distanceKm,
        approximateDistanceFormatted: formatDistance(distanceKm),
        isAvailableNow: Boolean(c.is_available_now),
        availabilityStatus: c.availability_status as AvailabilityStatus,
        isPreferredWorker: isPreferred,
        isVerified,
        isNewWorker,
        tasksCompletedCount: isNewWorkerTasks ? undefined : completedTasks,
        averageRating: isNewWorkerRatings ? undefined : Number(avgRating.toFixed(1)),
        whyMatched,
        matchHighlights: Array.from(new Set(highlights)).slice(0, 5),
      });
    }

    // 9. Deterministic Sorting:
    // Highest match score first, then closest distance, then deterministic ID tie-breaker
    scoredList.sort((a, b) => {
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }
      if (a.approximateDistanceKm !== b.approximateDistanceKm) {
        return a.approximateDistanceKm - b.approximateDistanceKm;
      }
      return a.workerId.localeCompare(b.workerId);
    });

    // 10. Assign 1-indexed Ranks & Slice by Limit
    const rankedMatches = scoredList.slice(0, limit).map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

    return {
      jobId,
      jobTitle: job.title,
      jobCategoryName: job.category_name,
      totalMatches: rankedMatches.length,
      matches: rankedMatches,
    };
  }
}

export const smartMatchingService = new SmartMatchingService();
