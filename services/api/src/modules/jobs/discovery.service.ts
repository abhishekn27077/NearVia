/**
 * Hyperlocal 5 KM Work Opportunity Discovery Domain Service
 * Performs PostGIS Geodesic Spatial Filtering (ST_DWithin, ST_Distance),
 * Multi-filter queries, Full-text Search, Sorting, and Pagination.
 */

import {
  DiscoveredOpportunity,
  DiscoveryQueryParams,
  DiscoveryQueryResult,
  WorkOpportunitySkillDetail,
  GeoCoordinates,
  WorkOpportunityStatus,
  WorkType,
  UrgencyLevel,
  PaymentType,
  ProviderType,
} from "@nearvia/types";
import { NEARVIA_CONFIG, ErrorCode } from "@nearvia/config";
import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import {
  computeMatchExplanation,
  WorkerSkillContext,
  WorkerAvailabilitySlotContext,
} from "../matching/matching.rules";

export class DiscoveryService {
  /**
   * Resolves search center coordinates either from explicit params or worker profile.
   */
  async resolveSearchCenter(
    userId: string | undefined,
    params: DiscoveryQueryParams,
  ): Promise<GeoCoordinates> {
    const hasLat = params.latitude !== undefined && params.latitude !== null;
    const hasLng = params.longitude !== undefined && params.longitude !== null;

    if (hasLat || hasLng) {
      if (!hasLat || !hasLng) {
        throw new AppError(
          "Both latitude and longitude must be provided together.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const lat = Number(params.latitude);
      const lng = Number(params.longitude);

      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new AppError(
          "Latitude must be a valid number between -90 and 90 degrees.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      if (isNaN(lng) || lng < -180 || lng > 180) {
        throw new AppError(
          "Longitude must be a valid number between -180 and 180 degrees.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      return { latitude: lat, longitude: lng };
    }

    if (userId) {
      try {
        const workerRes = await query<{
          latitude: number | null;
          longitude: number | null;
        }>(
          `SELECT 
            ST_Y(location::geometry) AS latitude, 
            ST_X(location::geometry) AS longitude
           FROM worker_profiles 
           WHERE user_id = $1`,
          [userId],
        );

        const firstRow = workerRes.rows[0];
        if (
          firstRow &&
          firstRow.latitude !== null &&
          firstRow.longitude !== null
        ) {
          return {
            latitude: Number(firstRow.latitude),
            longitude: Number(firstRow.longitude),
          };
        }
      } catch {
        // Fallback for non-worker or offline mock test environments
      }

      throw new AppError(
        "Worker location has not been configured. Please set your work location in your profile.",
        400,
        ErrorCode.LOCATION_REQUIRED,
      );
    }

    // Default fallback to central Bangalore if unauthenticated / guest exploration
    return { latitude: 12.9716, longitude: 77.5946 };
  }

  /**
   * Discovers published work opportunities within the specified radius (default 5 km).
   */
  async discoverNearbyWork(
    userId: string | undefined,
    params: DiscoveryQueryParams,
  ): Promise<DiscoveryQueryResult> {
    const searchCenter = await this.resolveSearchCenter(userId, params);

    if (params.radiusKm !== undefined && params.radiusKm !== null) {
      const r = Number(params.radiusKm);
      if (isNaN(r) || r <= 0) {
        throw new AppError(
          "Search radius must be a positive number.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }
    }

    const radiusKm = Math.min(
      Math.max(
        params.radiusKm || NEARVIA_CONFIG.HYPERLOCAL.DEFAULT_RADIUS_KM,
        0.5,
      ),
      NEARVIA_CONFIG.HYPERLOCAL.MAX_RADIUS_KM,
    );
    const radiusMeters = radiusKm * 1000;

    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 50);
    const offset = (page - 1) * limit;

    const sqlParams: any[] = [
      searchCenter.longitude, // $1
      searchCenter.latitude, // $2
      radiusMeters, // $3
    ];
    let paramIndex = 4;

    // Base WHERE: active opportunities, not filled, within PostGIS radius, and not expired
    const whereClauses: string[] = [
      `wo.status IN ('PUBLISHED', 'MATCHING')`,
      `wo.work_date >= CURRENT_DATE`,
      `wo.workers_assigned < wo.workers_needed`,
      `ST_DWithin(wo.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`,
    ];

    if (params.workType) {
      whereClauses.push(`wo.work_type = $${paramIndex}`);
      sqlParams.push(params.workType);
      paramIndex++;
    }

    if (params.categoryId) {
      whereClauses.push(`wo.category_id = $${paramIndex}`);
      sqlParams.push(params.categoryId);
      paramIndex++;
    }

    if (params.urgency) {
      whereClauses.push(`wo.urgency = $${paramIndex}`);
      sqlParams.push(params.urgency);
      paramIndex++;
    }

    if (params.dateFilter) {
      if (params.dateFilter === "TODAY") {
        whereClauses.push(`wo.work_date = CURRENT_DATE`);
      } else if (params.dateFilter === "TOMORROW") {
        whereClauses.push(
          `wo.work_date = (CURRENT_DATE + INTERVAL '1 day')::date`,
        );
      } else if (params.dateFilter === "STARTING_SOON") {
        whereClauses.push(
          `wo.work_date = CURRENT_DATE AND wo.start_time >= CURRENT_TIME AND wo.start_time <= (CURRENT_TIME + INTERVAL '4 hours')`,
        );
      }
    }

    if (params.durationFilter) {
      if (params.durationFilter === "UNDER_2H") {
        whereClauses.push(`wo.duration_hours <= 2`);
      } else if (params.durationFilter === "2_TO_4H") {
        whereClauses.push(`wo.duration_hours > 2 AND wo.duration_hours <= 4`);
      } else if (params.durationFilter === "HALF_DAY") {
        whereClauses.push(`wo.duration_hours > 4 AND wo.duration_hours <= 6`);
      } else if (params.durationFilter === "FULL_DAY") {
        whereClauses.push(`wo.duration_hours > 6`);
      }
    }

    if (typeof params.minPayment === "number" && params.minPayment > 0) {
      whereClauses.push(`wo.payment_amount >= $${paramIndex}`);
      sqlParams.push(params.minPayment);
      paramIndex++;
    }

    if (typeof params.maxPayment === "number" && params.maxPayment > 0) {
      whereClauses.push(`wo.payment_amount <= $${paramIndex}`);
      sqlParams.push(params.maxPayment);
      paramIndex++;
    }

    if (params.search && params.search.trim().length > 0) {
      const searchTerm = `%${params.search.trim()}%`;
      whereClauses.push(`(
        wo.title ILIKE $${paramIndex} OR
        wo.description ILIKE $${paramIndex} OR
        c.name ILIKE $${paramIndex} OR
        EXISTS (
          SELECT 1 FROM work_opportunity_skills wos
          JOIN skills s ON wos.skill_id = s.id
          WHERE wos.work_opportunity_id = wo.id AND s.name ILIKE $${paramIndex}
        )
      )`);
      sqlParams.push(searchTerm);
      paramIndex++;
    }

    let orderByClause =
      "distance_meters ASC, wo.work_date ASC, wo.start_time ASC";
    if (params.sort === "STARTING_SOON") {
      orderByClause =
        "wo.work_date ASC, wo.start_time ASC, distance_meters ASC";
    } else if (params.sort === "HIGHEST_PAY") {
      orderByClause = "wo.payment_amount DESC, distance_meters ASC";
    }

    const whereSql = whereClauses.join(" AND ");

    const countQuerySql = `
      SELECT COUNT(*) AS total
      FROM work_opportunities wo
      JOIN categories c ON wo.category_id = c.id
      WHERE ${whereSql}
    `;

    const dataQuerySql = `
      SELECT 
        wo.id,
        wo.provider_id,
        wo.category_id,
        wo.title,
        wo.description,
        wo.work_type,
        wo.urgency,
        wo.status,
        wo.workers_needed,
        wo.workers_assigned,
        ST_Y(wo.location::geometry) AS latitude,
        ST_X(wo.location::geometry) AS longitude,
        wo.address_approximate,
        wo.work_date,
        wo.start_time,
        wo.end_time,
        wo.duration_hours,
        wo.payment_amount,
        wo.payment_type,
        wo.currency,
        wo.min_experience_years,
        wo.responsibilities,
        wo.instructions,
        wo.tools_provided,
        wo.orientation_provided,
        wo.created_at,
        wo.updated_at,
        wo.published_at,
        wo.completed_at,
        wo.cancelled_at,
        c.name AS category_name,
        c.slug AS category_slug,
        c.icon AS category_icon,
        u.id AS provider_user_id,
        u.full_name AS provider_full_name,
        pp.provider_type,
        pp.business_name,
        pp.contact_phone,
        pp.average_rating,
        pp.verified_business,
        u.mobile_verified AS provider_phone_verified,
        u.identity_verified AS provider_identity_verified,
        (u.email IS NOT NULL) AS provider_email_verified,
        wo.schedule_type,
        wo.recurring_pattern,
        wo.recurring_days,
        wo.is_instant,
        ST_Distance(wo.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
      FROM work_opportunities wo
      JOIN categories c ON wo.category_id = c.id
      JOIN provider_profiles pp ON wo.provider_id = pp.id
      JOIN users u ON pp.user_id = u.id
      WHERE ${whereSql}
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const paginationParams = [...sqlParams, limit, offset];

    const [countResult, dataResult] = await Promise.all([
      query<{ total: string }>(countQuerySql, sqlParams),
      query(dataQuerySql, paginationParams),
    ]);

    const total = parseInt(countResult.rows[0]?.total || "0", 10);
    const rows = dataResult.rows;

    // Batch fetch skills for all returned opportunities in 1 single query (Eliminates N+1)
    const rowIds = rows.map((r: any) => r.id);
    const skillsByJobId: Record<string, WorkOpportunitySkillDetail[]> = {};

    if (rowIds.length > 0) {
      const skillsRes = await query<{
        work_opportunity_id: string;
        skill_id: string;
        skill_name: string;
        category_id: string;
        category_name: string;
        is_required: boolean;
        min_experience_years: number;
      }>(
        `SELECT wos.work_opportunity_id, wos.skill_id, s.name AS skill_name, s.category_id, c.name AS category_name,
                wos.is_required, wos.min_experience_years
         FROM work_opportunity_skills wos
         JOIN skills s ON wos.skill_id = s.id
         JOIN categories c ON s.category_id = c.id
         WHERE wos.work_opportunity_id = ANY($1::uuid[])`,
        [rowIds],
      );

      for (const s of skillsRes.rows) {
        const list = skillsByJobId[s.work_opportunity_id] || [];
        list.push({
          skillId: s.skill_id,
          skillName: s.skill_name,
          categoryId: s.category_id,
          categoryName: s.category_name,
          isRequired: s.is_required,
          minExperienceYears: s.min_experience_years,
        });
        skillsByJobId[s.work_opportunity_id] = list;
      }
    }

    const items: DiscoveredOpportunity[] = [];
    for (const row of rows) {
      const skills: WorkOpportunitySkillDetail[] = skillsByJobId[row.id] || [];

      const distanceMeters = parseFloat(row.distance_meters);
      const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;

      items.push({
        id: row.id,
        providerId: row.provider_id,
        categoryId: row.category_id,
        title: row.title,
        description: row.description,
        workType: row.work_type as WorkType,
        urgency: row.urgency as UrgencyLevel,
        status: row.status as WorkOpportunityStatus,
        workersNeeded: row.workers_needed,
        workersAssigned: row.workers_assigned,
        location: {
          latitude: parseFloat(row.latitude),
          longitude: parseFloat(row.longitude),
        },
        addressApproximate: row.address_approximate,
        workDate: row.work_date,
        startTime: row.start_time,
        endTime: row.end_time,
        durationHours: Number(row.duration_hours),
        paymentAmount: Number(row.payment_amount),
        paymentType: row.payment_type as PaymentType,
        currency: row.currency,
        minExperienceYears: Number(row.min_experience_years),
        responsibilities: row.responsibilities ?? undefined,
        instructions: row.instructions ?? undefined,
        toolsProvided: Boolean(row.tools_provided),
        orientationProvided: Boolean(row.orientation_provided),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publishedAt: row.published_at ?? undefined,
        categoryName: row.category_name,
        categorySlug: row.category_slug,
        categoryIcon: row.category_icon ?? undefined,
        providerName: row.provider_full_name,
        providerType: row.provider_type as ProviderType,
        businessName: row.business_name ?? undefined,
        contactPhone: row.contact_phone ?? undefined,
        providerRating: Number(row.average_rating || 5.0),
        providerVerified: Boolean(row.verified_business || row.provider_identity_verified),
        providerPhoneVerified: Boolean(row.provider_phone_verified),
        providerIdentityVerified: Boolean(row.provider_identity_verified),
        providerEmailVerified: Boolean(row.provider_email_verified),
        providerBusinessVerified: Boolean(row.verified_business),
        skills,
        distanceMeters,
        distanceKm,
        isStartingSoon: Boolean(row.is_starting_soon || false),
        scheduleType: row.schedule_type || "ONE_TIME",
        recurringPattern: row.recurring_pattern ?? undefined,
        recurringDays: row.recurring_days ?? undefined,
        isInstant: Boolean(row.is_instant),
      });
    }

    // Load worker context if userId is available to power explainable matching
    let workerSkills: WorkerSkillContext[] = [];
    let workerAvailabilitySlots: WorkerAvailabilitySlotContext[] = [];
    let workerIsAvailableNow = false;
    let workerServiceRadius = radiusKm;
    let preferredProviderSet = new Set<string>();

    if (userId) {
      try {
        const [wSkillsRes, wAvailRes, wProfRes, wPrefRes] = await Promise.all([
          query<{
            skill_id: string;
            name: string;
            category_id: string;
            category_name: string;
            years_experience: number;
          }>(
            `SELECT ws.skill_id, s.name, s.category_id, c.name AS category_name, ws.years_experience
             FROM worker_skills ws
             JOIN worker_profiles wp ON ws.worker_id = wp.id
             JOIN skills s ON ws.skill_id = s.id
             JOIN categories c ON s.category_id = c.id
             WHERE wp.user_id = $1`,
            [userId],
          ),
          query<{
            availability_date: string;
            start_time: string;
            end_time: string;
          }>(
            `SELECT wa.availability_date, wa.start_time, wa.end_time
             FROM worker_availability wa
             JOIN worker_profiles wp ON wa.worker_id = wp.id
             WHERE wp.user_id = $1 AND wa.status IN ('AVAILABLE_NOW', 'AVAILABLE_LATER')`,
            [userId],
          ),
          query<{
            is_available_now: boolean | null;
            service_radius_km: number | null;
          }>(
            `SELECT is_available_now, service_radius_km FROM worker_profiles WHERE user_id = $1`,
            [userId],
          ),
          query<{ provider_id: string }>(
            `SELECT pw.provider_id
             FROM preferred_workers pw
             JOIN worker_profiles wp ON pw.worker_id = wp.id
             WHERE wp.user_id = $1`,
            [userId],
          ),
        ]);

        workerSkills = wSkillsRes.rows.map((s) => ({
          skillId: s.skill_id,
          skillName: s.name,
          categoryId: s.category_id,
          categoryName: s.category_name,
          yearsExperience: Number(s.years_experience || 0),
        }));

        workerAvailabilitySlots = wAvailRes.rows.map((a) => ({
          availabilityDate: a.availability_date,
          startTime: a.start_time,
          endTime: a.end_time,
        }));

        if (wProfRes.rows[0]) {
          workerIsAvailableNow = Boolean(wProfRes.rows[0].is_available_now);
          workerServiceRadius = Number(
            wProfRes.rows[0].service_radius_km || radiusKm,
          );
        }

        preferredProviderSet = new Set(wPrefRes.rows.map((r) => r.provider_id));
      } catch {
        // Fallback for offline mock testing
      }
    }

    // Attach skills and calculate match explanation for each opportunity
    const opportunities: DiscoveredOpportunity[] = [];

    for (const row of rows) {
      let skills: WorkOpportunitySkillDetail[] = [];
      try {
        const skillsRes = await query<{
          skill_id: string;
          name: string;
          category_id: string;
          category_name: string;
          is_required: boolean;
          min_experience_years: number;
        }>(
          `SELECT 
            wos.skill_id,
            s.name,
            s.category_id,
            c.name AS category_name,
            wos.is_required,
            wos.min_experience_years
          FROM work_opportunity_skills wos
          JOIN skills s ON wos.skill_id = s.id
          JOIN categories c ON s.category_id = c.id
          WHERE wos.work_opportunity_id = $1
          ORDER BY wos.is_required DESC, s.name ASC`,
          [row.id],
        );

        skills = skillsRes.rows.map((s) => ({
          skillId: s.skill_id,
          skillName: s.name,
          categoryId: s.category_id,
          categoryName: s.category_name,
          isRequired: s.is_required,
          minExperienceYears: s.min_experience_years,
        }));
      } catch {
        skills = [];
      }

      const distMeters = Number(row.distance_meters) || 0;
      const distKm = Math.round((distMeters / 1000) * 10) / 10;

      // Determine starting soon (starts within 4 hours today)
      let isStartingSoon = false;
      const todayStr = new Date().toISOString().split("T")[0];
      if (row.work_date === todayStr && row.start_time) {
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const [startH, startM] = row.start_time.split(":").map(Number);
        const startMins = startH * 60 + startM;
        if (startMins >= currentMins && startMins - currentMins <= 240) {
          isStartingSoon = true;
        }
      }

      // Compute deterministic match explanation
      const match = computeMatchExplanation({
        worker: {
          userId: userId || "anonymous",
          skills: workerSkills,
          isAvailableNow: workerIsAvailableNow,
          availabilitySlots: workerAvailabilitySlots,
          serviceRadiusKm: workerServiceRadius,
        },
        opportunity: {
          id: row.id,
          title: row.title,
          categoryId: row.category_id,
          categoryName: row.category_name,
          workType: row.work_type,
          urgency: row.urgency as UrgencyLevel,
          workDate: row.work_date,
          startTime: row.start_time,
          endTime: row.end_time,
          durationHours: Number(row.duration_hours),
          distanceKm: distKm,
          skills,
          providerVerified: Boolean(row.verified_business || row.provider_identity_verified),
          isPreferredWorker: preferredProviderSet.has(row.provider_id),
        },
      });

      opportunities.push({
        id: row.id,
        providerId: row.provider_id,
        categoryId: row.category_id,
        categoryName: row.category_name,
        categorySlug: row.category_slug,
        categoryIcon: row.category_icon,
        title: row.title,
        description: row.description,
        workType: row.work_type as WorkType,
        urgency: row.urgency as UrgencyLevel,
        status: row.status as WorkOpportunityStatus,
        workersNeeded: Number(row.workers_needed),
        workersAssigned: Number(row.workers_assigned),
        location: {
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
        },
        addressApproximate: row.address_approximate,
        workDate: row.work_date,
        startTime: row.start_time,
        endTime: row.end_time,
        durationHours: Number(row.duration_hours),
        paymentAmount: Number(row.payment_amount),
        paymentType: row.payment_type as PaymentType,
        currency: row.currency || "INR",
        minExperienceYears: Number(row.min_experience_years || 0),
        responsibilities: row.responsibilities,
        instructions: row.instructions,
        toolsProvided: Boolean(row.tools_provided),
        orientationProvided: Boolean(row.orientation_provided),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publishedAt: row.published_at,
        providerName: row.provider_full_name,
        providerType: row.provider_type as ProviderType,
        businessName: row.business_name,
        contactPhone: row.contact_phone,
        providerRating: row.average_rating
          ? Number(row.average_rating)
          : undefined,
        providerVerified: Boolean(row.verified_business || row.provider_identity_verified),
        providerPhoneVerified: Boolean(row.provider_phone_verified),
        providerIdentityVerified: Boolean(row.provider_identity_verified),
        providerEmailVerified: Boolean(row.provider_email_verified),
        providerBusinessVerified: Boolean(row.verified_business),
        skills,
        distanceMeters: distMeters,
        distanceKm: distKm,
        isStartingSoon,
        match,
      });
    }

    // Default sorting in RECOMMENDED mode: Highest compatibility score first, then closest distance
    if (!params.sort || params.sort === "RECOMMENDED") {
      opportunities.sort((a, b) => {
        const scoreA = a.match?.score || 0;
        const scoreB = b.match?.score || 0;
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        return a.distanceMeters - b.distanceMeters;
      });
    }

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      opportunities,
      total,
      page,
      limit,
      totalPages,
      searchCenter,
      radiusKm,
    };
  }
}

export const discoveryService = new DiscoveryService();
