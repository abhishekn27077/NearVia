/**
 * Pure Deterministic Matching Rules & Explainability Generator
 * Implements transparent multi-factor scoring (Skill 35%, Availability 25%, Distance 20%, Duration 10%, Category 5%, Urgency 5%).
 * Zero black-box AI / LLM dependencies. Guaranteed [0, 100] bounded output.
 */

import {
  MatchScoreBreakdown,
  MatchExplanation,
  WorkOpportunitySkillDetail,
  UrgencyLevel,
} from "@nearvia/types";
import { NEARVIA_CONFIG } from "@nearvia/config";
import { formatDistance } from "@nearvia/shared";

export interface WorkerSkillContext {
  skillId: string;
  skillName: string;
  categoryId: string;
  categoryName?: string;
  yearsExperience: number;
}

export interface WorkerAvailabilitySlotContext {
  availabilityDate: string;
  startTime: string;
  endTime: string;
}

export interface MatchingContextInput {
  worker: {
    userId: string;
    skills: WorkerSkillContext[];
    isAvailableNow: boolean;
    availableUntil?: string;
    availabilitySlots: WorkerAvailabilitySlotContext[];
    serviceRadiusKm: number;
    preferredDurationHours?: number;
  };
  opportunity: {
    id: string;
    title: string;
    categoryId: string;
    categoryName?: string;
    workType: string;
    urgency: UrgencyLevel;
    workDate: string;
    startTime: string;
    endTime: string;
    durationHours: number;
    distanceKm: number;
    skills: WorkOpportunitySkillDetail[];
    providerVerified?: boolean;
    isPreferredWorker?: boolean;
  };
}

/**
 * 1. Skill Compatibility (35% weight)
 * Compares worker's skills & experience against required opportunity skills.
 */
export function evaluateSkillCompatibility(
  workerSkills: WorkerSkillContext[],
  jobSkills: WorkOpportunitySkillDetail[],
): {
  score: number;
  reasons: string[];
  limitations: string[];
  isHardEligible: boolean;
} {
  // If no skills are required, open to general assistance
  if (!jobSkills || jobSkills.length === 0) {
    return {
      score: 100,
      reasons: [
        "No specialized trade skills required (open to general assistance)",
      ],
      limitations: [],
      isHardEligible: true,
    };
  }

  const requiredSkills = jobSkills.filter((s) => s.isRequired);
  const optionalSkills = jobSkills.filter((s) => !s.isRequired);

  const matchedRequired: string[] = [];
  const missingRequired: string[] = [];
  let experienceBonus = 0;

  for (const req of requiredSkills) {
    const workerSkill = workerSkills.find((ws) => ws.skillId === req.skillId);
    if (workerSkill) {
      matchedRequired.push(req.skillName);
      if (workerSkill.yearsExperience >= req.minExperienceYears) {
        experienceBonus += 10;
      }
    } else {
      missingRequired.push(req.skillName);
    }
  }

  const matchedOptional: string[] = [];
  for (const opt of optionalSkills) {
    const workerSkill = workerSkills.find((ws) => ws.skillId === opt.skillId);
    if (workerSkill) {
      matchedOptional.push(opt.skillName);
    }
  }

  const reasons: string[] = [];
  const limitations: string[] = [];

  // If required skills exist but none matched
  if (requiredSkills.length > 0 && matchedRequired.length === 0) {
    limitations.push(`Missing mandatory skill: ${missingRequired.join(", ")}`);
    return {
      score: 0,
      reasons,
      limitations,
      isHardEligible: false,
    };
  }

  // Partial or full required match
  const requiredRatio =
    requiredSkills.length > 0
      ? matchedRequired.length / requiredSkills.length
      : 1.0;

  const meetsAllExp =
    requiredSkills.length > 0 &&
    requiredSkills.every((req) => {
      const ws = workerSkills.find((w) => w.skillId === req.skillId);
      return ws && ws.yearsExperience >= req.minExperienceYears;
    });

  let baseSkillScore = Math.round(requiredRatio * 80);
  baseSkillScore += meetsAllExp ? 20 : Math.min(experienceBonus, 10);

  if (matchedOptional.length > 0) {
    baseSkillScore = Math.min(baseSkillScore + 10, 100);
    reasons.push(`Bonus trade skill matched: ${matchedOptional.join(", ")}`);
  }

  const finalScore = Math.min(Math.max(baseSkillScore, 0), 100);

  if (requiredRatio === 1.0) {
    reasons.push(
      `All ${matchedRequired.length} required trade skill${matchedRequired.length > 1 ? "s" : ""} matched (${matchedRequired.join(", ")})`,
    );
  } else {
    reasons.push(
      `${matchedRequired.length} of ${requiredSkills.length} required skills matched`,
    );
    limitations.push(`Missing skill: ${missingRequired.join(", ")}`);
  }

  return {
    score: finalScore,
    reasons,
    limitations,
    isHardEligible: missingRequired.length === 0,
  };
}

/**
 * 2. Availability & Time Fit (25% weight)
 * Compares work schedule with worker availability slots and live Available-Now status.
 */
export function evaluateAvailabilityFit(
  slots: WorkerAvailabilitySlotContext[],
  isAvailableNow: boolean,
  jobDate: string,
  jobStartTime: string,
  jobEndTime: string,
  _urgency?: UrgencyLevel,
): { score: number; reasons: string[]; limitations: string[] } {
  const reasons: string[] = [];
  const limitations: string[] = [];

  const todayStr = new Date().toISOString().split("T")[0];
  const isJobToday = jobDate === todayStr;

  // Case A: Immediate / Urgent work + Worker Available Now today
  if (isJobToday && isAvailableNow) {
    reasons.push("Available now for immediate neighborhood start");
    return {
      score: 100,
      reasons,
      limitations,
    };
  }

  // Case B: Scheduled slots comparison
  const sameDateSlots = slots.filter((s) => s.availabilityDate === jobDate);

  if (sameDateSlots.length > 0) {
    // Check for exact/covering slot
    const coveringSlot = sameDateSlots.find(
      (s) => s.startTime <= jobStartTime && s.endTime >= jobEndTime,
    );

    if (coveringSlot) {
      reasons.push(
        `Scheduled availability fully covers work hours (${jobStartTime}–${jobEndTime})`,
      );
      return {
        score: 100,
        reasons,
        limitations,
      };
    }

    // Check for partial overlap
    const hasOverlap = sameDateSlots.some(
      (s) => s.startTime < jobEndTime && s.endTime > jobStartTime,
    );

    if (hasOverlap) {
      reasons.push(`Partial availability match on ${jobDate}`);
      limitations.push(
        "Work hours slightly extend beyond your scheduled availability",
      );
      return {
        score: 65,
        reasons,
        limitations,
      };
    }
  }

  // Case C: General availability if job is today or tomorrow without explicit conflict
  if (isJobToday) {
    reasons.push("Work is scheduled for today");
    return {
      score: 80,
      reasons,
      limitations,
    };
  }

  reasons.push(`Scheduled for ${jobDate} (${jobStartTime}–${jobEndTime})`);
  return {
    score: 75,
    reasons,
    limitations,
  };
}

/**
 * 3. Distance Proximity (20% weight)
 * PostGIS spatial distance score decaying smoothly over 0–5 km.
 */
export function evaluateDistanceProximity(
  distanceKm: number,
  radiusKm: number = NEARVIA_CONFIG.HYPERLOCAL.DEFAULT_RADIUS_KM,
): { score: number; reasons: string[]; limitations: string[] } {
  const reasons: string[] = [];
  const limitations: string[] = [];

  const effectiveRadius = Math.max(radiusKm, 1.0);
  const ratio = Math.min(Math.max(distanceKm / effectiveRadius, 0), 1);
  const rawScore = Math.round(100 * (1 - ratio));
  const score = Math.min(Math.max(rawScore, 0), 100);

  const formatted = formatDistance(distanceKm);

  if (distanceKm <= 1.0) {
    reasons.push(`Extremely close: ${formatted} away (walkable distance)`);
  } else if (distanceKm <= 3.0) {
    reasons.push(`Close proximity: ${formatted} away (under 3 km)`);
  } else {
    reasons.push(
      `Within reach: ${formatted} away (within ${radiusKm} km radius)`,
    );
    if (distanceKm > 4.0) {
      limitations.push(`${formatted} away (near outer 5 km boundary)`);
    }
  }

  return {
    score,
    reasons,
    limitations,
  };
}

/**
 * 4. Duration Preference (10% weight)
 * Compares opportunity duration against worker duration preferences.
 */
export function evaluateDurationPreference(
  jobDurationHours: number,
  preferredDurationHours?: number,
): { score: number; reasons: string[]; limitations: string[] } {
  const reasons: string[] = [];
  const limitations: string[] = [];

  if (!preferredDurationHours) {
    reasons.push(
      `${jobDurationHours}-hour duration matches standard short-duration shifts`,
    );
    return {
      score: 90,
      reasons,
      limitations,
    };
  }

  const diff = Math.abs(jobDurationHours - preferredDurationHours);

  if (diff <= 0.5) {
    reasons.push(`Exact duration fit (${jobDurationHours} hrs)`);
    return { score: 100, reasons, limitations };
  } else if (diff <= 2) {
    reasons.push(`Comfortable duration (${jobDurationHours} hrs)`);
    return { score: 80, reasons, limitations };
  } else {
    limitations.push(
      `Duration (${jobDurationHours} hrs) differs from preferred (${preferredDurationHours} hrs)`,
    );
    return { score: 50, reasons, limitations };
  }
}

/**
 * 5. Category Preference (5% weight)
 * Boosts jobs matching worker's existing domain skills or background.
 */
export function evaluateCategoryPreference(
  jobCategoryId: string,
  workerSkills: WorkerSkillContext[],
  jobCategoryName?: string,
): { score: number; reasons: string[]; limitations: string[] } {
  const reasons: string[] = [];
  const limitations: string[] = [];

  const hasCategoryExperience = workerSkills.some(
    (ws) => ws.categoryId === jobCategoryId,
  );

  if (hasCategoryExperience) {
    reasons.push(
      `Matches your experience in ${jobCategoryName || "this category"}`,
    );
    return {
      score: 100,
      reasons,
      limitations,
    };
  }

  // Neutral score if no specific category conflict
  return {
    score: 70,
    reasons,
    limitations,
  };
}

/**
 * 6. Urgency & Real-Time Alignment (5% weight)
 * Evaluates urgent / immediate micro-work alignment with worker readiness.
 */
export function evaluateUrgencyAlignment(
  urgency: UrgencyLevel,
  isAvailableNow: boolean,
): { score: number; reasons: string[]; limitations: string[] } {
  const reasons: string[] = [];
  const limitations: string[] = [];

  if (urgency === UrgencyLevel.IMMEDIATE) {
    if (isAvailableNow) {
      reasons.push(
        "Immediate urgency aligns with your live Available-Now status",
      );
      return { score: 100, reasons, limitations };
    }
    return { score: 60, reasons, limitations };
  }

  if (urgency === UrgencyLevel.URGENT) {
    if (isAvailableNow) {
      reasons.push("Urgent posting matches your immediate readiness");
      return { score: 95, reasons, limitations };
    }
    return { score: 75, reasons, limitations };
  }

  return {
    score: 80,
    reasons,
    limitations,
  };
}

/**
 * Composite Multi-Factor Match Score Calculator
 * Normalizes and aggregates all weighted scores into an explainable 0–100 rating.
 */
export function computeMatchExplanation(
  context: MatchingContextInput,
): MatchExplanation {
  const { worker, opportunity } = context;

  // 1. Skill evaluation
  const skillEval = evaluateSkillCompatibility(
    worker.skills,
    opportunity.skills,
  );

  // 2. Availability evaluation
  const availEval = evaluateAvailabilityFit(
    worker.availabilitySlots,
    worker.isAvailableNow,
    opportunity.workDate,
    opportunity.startTime,
    opportunity.endTime,
    opportunity.urgency,
  );

  // 3. Distance evaluation
  const distEval = evaluateDistanceProximity(
    opportunity.distanceKm,
    worker.serviceRadiusKm || NEARVIA_CONFIG.HYPERLOCAL.DEFAULT_RADIUS_KM,
  );

  // 4. Duration evaluation
  const durEval = evaluateDurationPreference(
    opportunity.durationHours,
    worker.preferredDurationHours,
  );

  // 5. Category evaluation
  const catEval = evaluateCategoryPreference(
    opportunity.categoryId,
    worker.skills,
    opportunity.categoryName,
  );

  // 6. Urgency evaluation
  const urgEval = evaluateUrgencyAlignment(
    opportunity.urgency,
    worker.isAvailableNow,
  );

  // 7. Employer Trust & Verification
  const trustScore = opportunity.providerVerified ? 100 : 70;

  const breakdown: MatchScoreBreakdown = {
    skillScore: skillEval.score,
    availabilityScore: availEval.score,
    distanceScore: distEval.score,
    durationScore: durEval.score,
    categoryScore: catEval.score,
    urgencyScore: urgEval.score,
    trustScore,
  };

  const weights = NEARVIA_CONFIG.MATCHING_WEIGHTS;

  let rawWeightedScore =
    breakdown.skillScore * weights.SKILL_COMPATIBILITY +
    breakdown.availabilityScore * weights.AVAILABILITY_FIT +
    breakdown.distanceScore * weights.DISTANCE_PROXIMITY +
    breakdown.durationScore * weights.DURATION_PREFERENCE +
    breakdown.categoryScore * weights.CATEGORY_PREFERENCE +
    breakdown.urgencyScore * weights.URGENCY_RELEVANCE;

  // Preferred worker affinity boost (+5%)
  if (opportunity.isPreferredWorker) {
    rawWeightedScore += 5;
  }

  // Hard eligibility rule: If required trade skills are missing, score must be 0
  const finalScore = !skillEval.isHardEligible
    ? 0
    : Math.min(Math.max(Math.round(rawWeightedScore), 0), 100);

  // Aggregate positive reasons and constructive limitations
  const reasons: string[] = [
    ...skillEval.reasons,
    ...availEval.reasons,
    ...distEval.reasons,
    ...durEval.reasons,
    ...catEval.reasons,
    ...urgEval.reasons,
  ];

  if (opportunity.providerVerified) {
    reasons.unshift("Verified employer");
  }

  if (opportunity.isPreferredWorker) {
    reasons.unshift("❤️ Preferred worker for this employer");
  }

  const limitations: string[] = [
    ...skillEval.limitations,
    ...availEval.limitations,
    ...distEval.limitations,
    ...durEval.limitations,
    ...catEval.limitations,
    ...urgEval.limitations,
  ];

  return {
    score: finalScore,
    breakdown,
    reasons: Array.from(new Set(reasons)).slice(0, 5), // Top 5 relevant reasons
    limitations: Array.from(new Set(limitations)).slice(0, 3),
    isEligible:
      skillEval.isHardEligible &&
      opportunity.distanceKm <= (worker.serviceRadiusKm || 5.0),
  };
}
