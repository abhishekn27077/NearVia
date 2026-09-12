/**
 * Deterministic Explainable Matching Domain Service
 * Scores and ranks nearby published work opportunities for authenticated workers
 * based on skills, schedule, PostGIS distance, duration, category, and urgency.
 */

import {
  DiscoveryQueryParams,
  DiscoveryQueryResult,
  MatchExplanation,
  MatchedWorkOpportunity,
  GeoCoordinates,
} from "@nearvia/types";
import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode, NEARVIA_CONFIG } from "@nearvia/config";
import { discoveryService } from "../jobs/discovery.service";
import { workOpportunitiesService } from "../jobs/service";
import {
  computeMatchExplanation,
  WorkerSkillContext,
  WorkerAvailabilitySlotContext,
  MatchingContextInput,
} from "./matching.rules";
import { calculateHaversineDistanceKm } from "@nearvia/shared";

export class MatchingService {
  /**
   * Loads full worker profile context required for deterministic matching.
   */
  async getWorkerMatchingContext(workerUserId: string): Promise<{
    location: GeoCoordinates;
    serviceRadiusKm: number;
    isAvailableNow: boolean;
    availableUntil?: string;
    skills: WorkerSkillContext[];
    availabilitySlots: WorkerAvailabilitySlotContext[];
  }> {
    // 1. Fetch worker profile
    const profileRes = await query<{
      latitude: number | null;
      longitude: number | null;
      service_radius_km: number | null;
      is_available_now: boolean | null;
      available_until: string | null;
    }>(
      `SELECT 
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude,
        service_radius_km,
        is_available_now,
        available_until
       FROM worker_profiles
       WHERE user_id = $1`,
      [workerUserId],
    );

    const profileRow = profileRes.rows[0];
    if (
      !profileRow ||
      profileRow.latitude === null ||
      profileRow.longitude === null
    ) {
      throw new AppError(
        "Worker location has not been configured. Please update your profile location to receive matches.",
        400,
        ErrorCode.LOCATION_REQUIRED,
      );
    }

    const workerLocation: GeoCoordinates = {
      latitude: Number(profileRow.latitude),
      longitude: Number(profileRow.longitude),
    };

    // 2. Fetch worker trade skills
    const skillsRes = await query<{
      skill_id: string;
      name: string;
      category_id: string;
      category_name: string;
      years_experience: number;
    }>(
      `SELECT 
        ws.skill_id,
        s.name,
        s.category_id,
        c.name AS category_name,
        ws.years_experience
       FROM worker_skills ws
       JOIN worker_profiles wp ON ws.worker_id = wp.id
       JOIN skills s ON ws.skill_id = s.id
       JOIN categories c ON s.category_id = c.id
       WHERE wp.user_id = $1`,
      [workerUserId],
    );

    const skills: WorkerSkillContext[] = skillsRes.rows.map((s) => ({
      skillId: s.skill_id,
      skillName: s.name,
      categoryId: s.category_id,
      categoryName: s.category_name,
      yearsExperience: Number(s.years_experience || 0),
    }));

    // 3. Fetch worker upcoming availability slots
    const availRes = await query<{
      availability_date: string;
      start_time: string;
      end_time: string;
    }>(
      `SELECT 
        wa.availability_date,
        wa.start_time,
        wa.end_time
       FROM worker_availability wa
       JOIN worker_profiles wp ON wa.worker_id = wp.id
       WHERE wp.user_id = $1
         AND wa.availability_date >= CURRENT_DATE
         AND wa.status IN ('AVAILABLE_NOW', 'AVAILABLE_LATER')`,
      [workerUserId],
    );

    const availabilitySlots: WorkerAvailabilitySlotContext[] =
      availRes.rows.map((a) => ({
        availabilityDate: a.availability_date,
        startTime: a.start_time,
        endTime: a.end_time,
      }));

    return {
      location: workerLocation,
      serviceRadiusKm: Number(
        profileRow.service_radius_km ||
          NEARVIA_CONFIG.HYPERLOCAL.DEFAULT_RADIUS_KM,
      ),
      isAvailableNow: Boolean(profileRow.is_available_now),
      availableUntil: profileRow.available_until || undefined,
      skills,
      availabilitySlots,
    };
  }

  /**
   * Matches, scores, and ranks opportunities for an authenticated worker.
   */
  async matchWorkOpportunitiesForWorker(
    workerUserId: string,
    params: DiscoveryQueryParams,
  ): Promise<DiscoveryQueryResult> {
    const workerContext = await this.getWorkerMatchingContext(workerUserId);

    // Discover candidates within worker radius using PostGIS spatial engine
    const discoveryResult = await discoveryService.discoverNearbyWork(
      workerUserId,
      {
        ...params,
        latitude: params.latitude || workerContext.location.latitude,
        longitude: params.longitude || workerContext.location.longitude,
        radiusKm: params.radiusKm || workerContext.serviceRadiusKm,
      },
    );

    // Score and generate explainable reasons for each discovered candidate
    const scoredOpportunities: MatchedWorkOpportunity[] =
      discoveryResult.opportunities.map((opp) => {
        const matchInput: MatchingContextInput = {
          worker: {
            userId: workerUserId,
            skills: workerContext.skills,
            isAvailableNow: workerContext.isAvailableNow,
            availableUntil: workerContext.availableUntil,
            availabilitySlots: workerContext.availabilitySlots,
            serviceRadiusKm: workerContext.serviceRadiusKm,
          },
          opportunity: {
            id: opp.id,
            title: opp.title,
            categoryId: opp.categoryId,
            categoryName: opp.categoryName,
            workType: opp.workType,
            urgency: opp.urgency,
            workDate: opp.workDate,
            startTime: opp.startTime,
            endTime: opp.endTime,
            durationHours: opp.durationHours,
            distanceKm: opp.distanceKm,
            skills: opp.skills,
          },
        };

        const match = computeMatchExplanation(matchInput);
        return {
          ...opp,
          match,
        };
      });

    // Default sorting in matching mode: High compatibility score first, then closer distance
    if (!params.sort || params.sort === "RECOMMENDED") {
      scoredOpportunities.sort((a, b) => {
        if (b.match.score !== a.match.score) {
          return b.match.score - a.match.score;
        }
        return a.distanceMeters - b.distanceMeters;
      });
    }

    return {
      ...discoveryResult,
      opportunities: scoredOpportunities,
    };
  }

  /**
   * Returns detailed explainability breakdown for a specific opportunity & worker pair.
   */
  async explainMatch(
    workerUserId: string,
    workOpportunityId: string,
  ): Promise<MatchExplanation> {
    const workerContext = await this.getWorkerMatchingContext(workerUserId);
    const opportunity =
      await workOpportunitiesService.getWorkOpportunityById(workOpportunityId);

    const distanceKm = calculateHaversineDistanceKm(
      workerContext.location,
      opportunity.location,
    );

    const prefRes = await query<{ provider_id: string }>(
      `SELECT provider_id FROM preferred_workers WHERE provider_id = $1 AND worker_id = (SELECT id FROM worker_profiles WHERE user_id = $2)`,
      [opportunity.providerId, workerUserId],
    );
    const isPreferredWorker = prefRes.rows.length > 0;

    const matchInput: MatchingContextInput = {
      worker: {
        userId: workerUserId,
        skills: workerContext.skills,
        isAvailableNow: workerContext.isAvailableNow,
        availableUntil: workerContext.availableUntil,
        availabilitySlots: workerContext.availabilitySlots,
        serviceRadiusKm: workerContext.serviceRadiusKm,
      },
      opportunity: {
        id: opportunity.id,
        title: opportunity.title,
        categoryId: opportunity.categoryId,
        categoryName: opportunity.categoryName,
        workType: opportunity.workType,
        urgency: opportunity.urgency,
        workDate: opportunity.workDate,
        startTime: opportunity.startTime,
        endTime: opportunity.endTime,
        durationHours: opportunity.durationHours,
        distanceKm,
        skills: opportunity.skills,
        providerVerified: Boolean(
          opportunity.providerVerified ||
            opportunity.providerBusinessVerified ||
            opportunity.providerIdentityVerified,
        ),
        isPreferredWorker,
      },
    };

    return computeMatchExplanation(matchInput);
  }
}

export const matchingService = new MatchingService();
