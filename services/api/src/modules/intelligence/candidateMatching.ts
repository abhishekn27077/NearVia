/**
 * Provider-Side Candidate Recommendation Engine
 * Deterministically ranks and explains top available nearby workers for a given work opportunity.
 * Computes multi-factor explainable compatibility (Skills 35%, Availability 25%, Proximity 20%, Reliability 10%, Rating 5%, Verification 5%).
 */

import {
  CandidateRecommendation,
  CandidateMatchExplanation,
  WorkOpportunitySkillDetail,
  AvailabilityStatus,
} from "@nearvia/types";
import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";
import { formatDistance } from "@nearvia/shared";

export class CandidateMatchingEngine {
  /**
   * Ranks candidates for a specific work opportunity
   */
  async getRecommendedCandidates(
    workOpportunityId: string,
    limit = 10
  ): Promise<CandidateRecommendation[]> {
    // 1. Fetch Opportunity Details
    const oppRes = await query<{
      id: string;
      title: string;
      category_id: string;
      latitude: number;
      longitude: number;
      work_date: string;
      start_time: string;
      end_time: string;
      duration_hours: number;
      payment_amount: number;
    }>(
      `SELECT 
        id, title, category_id,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude,
        work_date, start_time, end_time, duration_hours,
        payment_amount
       FROM work_opportunities
       WHERE id = $1`,
      [workOpportunityId]
    );

    const opp = oppRes.rows[0];
    if (!opp) {
      throw new AppError("Work opportunity not found", 404, ErrorCode.NOT_FOUND);
    }

    // 2. Fetch Required Skills for Opportunity
    const oppSkillsRes = await query<{
      skill_id: string;
      name: string;
      category_id: string;
      category_name: string;
      min_experience_years: number;
      is_required: boolean;
    }>(
      `SELECT wos.skill_id, s.name, s.category_id, c.name AS category_name, wos.min_experience_years, wos.is_required
       FROM work_opportunity_skills wos
       JOIN skills s ON wos.skill_id = s.id
       JOIN categories c ON s.category_id = c.id
       WHERE wos.work_opportunity_id = $1`,
      [workOpportunityId]
    );

    const requiredSkills: WorkOpportunitySkillDetail[] = oppSkillsRes.rows.map((s) => ({
      skillId: s.skill_id,
      skillName: s.name,
      categoryId: s.category_id,
      categoryName: s.category_name,
      minExperienceYears: Number(s.min_experience_years || 0),
      isRequired: Boolean(s.is_required),
    }));

    // 3. Query Nearby Active Workers (within 15km)
    const candidatesRes = await query<{
      worker_id: string;
      user_id: string;
      full_name: string;
      avatar_url: string | null;
      phone: string;
      bio: string | null;
      experience_years: number;
      service_radius_km: number;
      availability_status: string;
      is_available_now: boolean;
      available_until: string | null;
      average_rating: number;
      total_ratings_count: number;
      completed_tasks_count: number;
      reliability_score: number;
      verified_badge: boolean;
      on_time_arrival_rate: number;
      hourly_rate_estimate: number | null;
      daily_rate_estimate: number | null;
      distance_meters: number;
    }>(
      `SELECT 
        wp.id AS worker_id,
        wp.user_id,
        u.full_name,
        u.avatar_url,
        u.phone,
        wp.bio,
        wp.experience_years,
        wp.service_radius_km,
        wp.availability_status,
        wp.is_available_now,
        wp.available_until,
        wp.average_rating,
        wp.total_ratings_count,
        wp.completed_tasks_count,
        COALESCE(wp.reliability_score, 100.0) AS reliability_score,
        COALESCE(wp.verified_badge, FALSE) AS verified_badge,
        COALESCE(wp.on_time_arrival_rate, 100.0) AS on_time_arrival_rate,
        wp.hourly_rate_estimate,
        wp.daily_rate_estimate,
        ST_Distance(wp.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
       FROM worker_profiles wp
       JOIN users u ON wp.user_id = u.id
       WHERE u.is_active = TRUE
         AND ST_DWithin(wp.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 15000)
       LIMIT 50`,
      [opp.longitude, opp.latitude]
    );

    if (candidatesRes.rows.length === 0) {
      return [];
    }

    const workerIds = candidatesRes.rows.map((c) => c.worker_id);

    // 4. Batch fetch skills for these candidates
    const workerSkillsRes = await query<{
      worker_id: string;
      skill_id: string;
      name: string;
      years_experience: number;
    }>(
      `SELECT ws.worker_id, ws.skill_id, s.name, ws.years_experience
       FROM worker_skills ws
       JOIN skills s ON ws.skill_id = s.id
       WHERE ws.worker_id = ANY($1::uuid[])`,
      [workerIds]
    );

    const workerSkillsMap = new Map<string, Array<{ skillId: string; skillName: string; yearsExperience: number }>>();
    for (const r of workerSkillsRes.rows) {
      const list = workerSkillsMap.get(r.worker_id) || [];
      list.push({
        skillId: r.skill_id,
        skillName: r.name,
        yearsExperience: Number(r.years_experience || 0),
      });
      workerSkillsMap.set(r.worker_id, list);
    }

    // 5. Batch fetch worker availability slots for target work date
    const availRes = await query<{
      worker_id: string;
      start_time: string;
      end_time: string;
      status: string;
    }>(
      `SELECT worker_id, start_time, end_time, status
       FROM worker_availability
       WHERE worker_id = ANY($1::uuid[])
         AND availability_date = $2
         AND status IN ('AVAILABLE_NOW', 'AVAILABLE_LATER')`,
      [workerIds, opp.work_date]
    );

    const availMap = new Map<string, Array<{ start_time: string; end_time: string }>>();
    for (const a of availRes.rows) {
      const list = availMap.get(a.worker_id) || [];
      list.push({ start_time: a.start_time, end_time: a.end_time });
      availMap.set(a.worker_id, list);
    }

    // 6. Score and explain each candidate
    const scoredCandidates: CandidateRecommendation[] = [];

    for (const c of candidatesRes.rows) {
      const skills = workerSkillsMap.get(c.worker_id) || [];
      const slots = availMap.get(c.worker_id) || [];
      const distanceKm = Number((c.distance_meters / 1000).toFixed(2));

      const match = this.evaluateCandidateMatch(
        c,
        skills,
        slots,
        distanceKm,
        opp,
        requiredSkills
      );

      // Mask phone for initial recommendation privacy (revealed on confirmation)
      const rawPhone = c.phone || "";
      const maskedPhone = rawPhone.length >= 10
        ? `${rawPhone.slice(0, 3)}••••${rawPhone.slice(-3)}`
        : "••••••••";

      scoredCandidates.push({
        workerId: c.worker_id,
        userId: c.user_id,
        fullName: c.full_name,
        avatarUrl: c.avatar_url || undefined,
        contactPhoneMasked: maskedPhone,
        bio: c.bio || undefined,
        distanceKm,
        distanceFormatted: formatDistance(distanceKm),
        averageRating: Number(c.average_rating || 5.0),
        totalRatingsCount: Number(c.total_ratings_count || 0),
        completedTasksCount: Number(c.completed_tasks_count || 0),
        reliabilityScore: Number(c.reliability_score || 100),
        verifiedBadge: Boolean(c.verified_badge),
        onTimeArrivalRate: Number(c.on_time_arrival_rate || 100),
        skills,
        hourlyRateEstimate: c.hourly_rate_estimate ? Number(c.hourly_rate_estimate) : undefined,
        dailyRateEstimate: c.daily_rate_estimate ? Number(c.daily_rate_estimate) : undefined,
        match,
        isAvailableNow: Boolean(c.is_available_now),
        availabilityStatus: c.availability_status as AvailabilityStatus,
      });
    }

    // Sort descending by composite match score
    scoredCandidates.sort((a, b) => b.match.score - a.match.score);

    return scoredCandidates.slice(0, limit);
  }

  /**
   * Deterministic Explainable Match Evaluation for Candidates
   */
  private evaluateCandidateMatch(
    candidate: {
      is_available_now: boolean;
      average_rating: number;
      total_ratings_count: number;
      completed_tasks_count: number;
      reliability_score: number;
      verified_badge: boolean;
      service_radius_km: number;
    },
    skills: Array<{ skillId: string; skillName: string; yearsExperience: number }>,
    slots: Array<{ start_time: string; end_time: string }>,
    distanceKm: number,
    _opp: { start_time: string; end_time: string; duration_hours: number },
    requiredSkills: WorkOpportunitySkillDetail[]
  ): CandidateMatchExplanation {
    const reasons: string[] = [];
    const limitations: string[] = [];

    // 1. Skill Score (35%)
    let skillScore = 100;
    if (requiredSkills.length > 0) {
      const mustHave = requiredSkills.filter((s) => s.isRequired);
      const matched = mustHave.filter((req) => skills.some((ws) => ws.skillId === req.skillId));

      if (mustHave.length > 0) {
        skillScore = Math.round((matched.length / mustHave.length) * 100);
        if (matched.length === mustHave.length) {
          reasons.push(`✓ Verified match for ${mustHave.length} of ${mustHave.length} required skills (${matched.map((m) => m.skillName).join(", ")})`);
        } else {
          limitations.push(`Missing ${mustHave.length - matched.length} required skills`);
        }
      } else {
        reasons.push("Open to general trade support");
      }
    } else {
      reasons.push("No specialized trade certification required");
    }

    // 2. Availability Score (25%)
    let availabilityScore = 70;
    if (candidate.is_available_now) {
      availabilityScore = 100;
      reasons.push("⚡ Instant on-demand availability enabled");
    } else if (slots.length > 0) {
      availabilityScore = 95;
      reasons.push("✓ Schedule window matches shift timing");
    } else {
      availabilityScore = 60;
      limitations.push("Has not pre-scheduled an availability slot on this date");
    }

    // 3. Distance / Proximity Score (20%)
    const maxRadius = candidate.service_radius_km || 10;
    let distanceScore = Math.max(0, Math.round(100 - (distanceKm / maxRadius) * 80));
    if (distanceKm <= 2.0) {
      distanceScore = 100;
      reasons.push(`📍 Hyperlocal proximity (${formatDistance(distanceKm)})`);
    } else if (distanceKm <= 5.0) {
      reasons.push(`📍 Within short transit distance (${formatDistance(distanceKm)})`);
    } else {
      limitations.push(`Located ${formatDistance(distanceKm)} away (within ${maxRadius} km service radius)`);
    }

    // 4. Reliability Score (10%)
    const reliability = Number(candidate.reliability_score || 100);
    const reliabilityScore = Math.min(100, Math.max(0, reliability));
    if (reliability >= 95) {
      reasons.push(`🛡️ Exceptional reliability rating (${reliability}%)`);
    } else if (reliability < 80) {
      limitations.push(`Past shift completion reliability score is ${reliability}%`);
    }

    // 5. Rating Score (5%)
    const rating = Number(candidate.average_rating || 5.0);
    const ratingScore = Math.round(((rating - 1) / 4) * 100);
    if (rating >= 4.5 && Number(candidate.total_ratings_count || 0) >= 3) {
      reasons.push(`⭐ Top rated (${rating.toFixed(1)}/5.0 across ${candidate.total_ratings_count} reviews)`);
    }

    // 6. Verification Bonus (5%)
    let verificationBonus = 50;
    if (candidate.verified_badge) {
      verificationBonus = 100;
      reasons.push("✅ Verified worker profile with background verification");
    }

    // Composite Calculation
    const compositeScore = Math.round(
      skillScore * 0.35 +
      availabilityScore * 0.25 +
      distanceScore * 0.20 +
      reliabilityScore * 0.10 +
      ratingScore * 0.05 +
      verificationBonus * 0.05
    );

    const isHardEligible = distanceKm <= maxRadius;

    return {
      score: Math.min(100, Math.max(0, compositeScore)),
      breakdown: {
        skillScore,
        availabilityScore,
        distanceScore,
        reliabilityScore,
        ratingScore,
        verificationBonus,
      },
      reasons,
      limitations,
      isHardEligible,
    };
  }
}

export const candidateMatchingEngine = new CandidateMatchingEngine();
