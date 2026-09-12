/**
 * Workforce Radar & Demand Intelligence Service
 * Server-authoritative, privacy-preserving, role-tailored spatial intelligence engine.
 * Operating at ₹0 cost (zero paid AI/maps APIs).
 */

import {
  UserRole,
  GeoCoordinates,
  WorkerRadarData,
  ProviderRadarData,
  AgentRadarData,
  AdminRadarData,
  WorkforceRadarHotspot,
  RadarResponse,
} from "@nearvia/types";
import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";

export class RadarService {
  /**
   * Unified entry point: routes radar query according to the authenticated user's role.
   */
  public async getRadar(
    user: { id: string; role: UserRole },
    latitude?: number,
    longitude?: number,
    radiusKm = 5.0,
    categoryId?: string
  ): Promise<RadarResponse> {
    const coords = await this.resolveSearchCenter(user, latitude, longitude);
    const boundedRadius = Math.min(15.0, Math.max(0.5, isNaN(radiusKm) ? 5.0 : radiusKm));

    switch (user.role) {
      case UserRole.WORKER:
        return this.getWorkerRadar(user.id, coords.latitude, coords.longitude, boundedRadius, categoryId);

      case UserRole.PROVIDER:
        return this.getProviderRadar(user.id, coords.latitude, coords.longitude, boundedRadius, categoryId);

      case UserRole.AGENT:
        return this.getAgentRadar(user.id, coords.latitude, coords.longitude, boundedRadius);

      case UserRole.ADMIN:
        return this.getAdminRadar(coords.latitude, coords.longitude, boundedRadius);

      default:
        // Default safe public/worker view
        return this.getWorkerRadar(user.id, coords.latitude, coords.longitude, boundedRadius, categoryId);
    }
  }

  /**
   * Resolves search center coordinates from parameters or user profile location.
   */
  private async resolveSearchCenter(
    user: { id: string; role: UserRole },
    latitude?: number,
    longitude?: number
  ): Promise<GeoCoordinates> {
    if (latitude !== undefined && longitude !== undefined) {
      if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        throw new AppError("Latitude must be between -90 and 90 degrees.", 400, ErrorCode.VALIDATION_ERROR);
      }
      if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        throw new AppError("Longitude must be between -180 and 180 degrees.", 400, ErrorCode.VALIDATION_ERROR);
      }
      return { latitude, longitude };
    }

    // Attempt lookup from role profile
    if (user.role === UserRole.WORKER) {
      const wRes = await query<{ lat: number; lng: number }>(
        `SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
         FROM worker_profiles WHERE user_id = $1`,
        [user.id]
      );
      if (wRes.rows[0]?.lat && wRes.rows[0]?.lng) {
        return { latitude: Number(wRes.rows[0].lat), longitude: Number(wRes.rows[0].lng) };
      }
    } else if (user.role === UserRole.PROVIDER) {
      const pRes = await query<{ lat: number; lng: number }>(
        `SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
         FROM provider_profiles WHERE user_id = $1`,
        [user.id]
      );
      if (pRes.rows[0]?.lat && pRes.rows[0]?.lng) {
        return { latitude: Number(pRes.rows[0].lat), longitude: Number(pRes.rows[0].lng) };
      }
    }

    // Default to Bangalore central urban coordinates (MG Road)
    return { latitude: 12.9716, longitude: 77.5946 };
  }

  /**
   * 1. WORKER RADAR:
   * Aggregates nearby job demand, category breakdown, skill demand, and market activity.
   * STRICT PRIVACY: NEVER reveals individual worker coordinates or competitor worker data.
   */
  public async getWorkerRadar(
    workerUserId: string,
    centerLat: number,
    centerLng: number,
    radiusKm: number,
    categoryId?: string
  ): Promise<WorkerRadarData> {
    const radiusMeters = radiusKm * 1000;

    // A. Fetch worker's verified skills
    const skillsRes = await query<{ skill_id: string; skill_name: string }>(
      `SELECT ws.skill_id, s.name AS skill_name
       FROM worker_profiles wp
       JOIN worker_skills ws ON ws.worker_id = wp.id
       JOIN skills s ON s.id = ws.skill_id
       WHERE wp.user_id = $1`,
      [workerUserId]
    );
    const workerSkillIds = new Set(skillsRes.rows.map((r) => r.skill_id));

    // B. Query active, open work opportunities within radius
    const categoryFilter = categoryId && categoryId !== "ALL" ? `AND wo.category_id = $4` : "";
    const queryParams: any[] = [centerLng, centerLat, radiusMeters];
    if (categoryId && categoryId !== "ALL") queryParams.push(categoryId);

    const activeJobsSql = `
      SELECT 
        wo.id,
        wo.category_id,
        c.name AS category_name,
        wo.payment_amount,
        (wo.urgency IN ('URGENT', 'IMMEDIATE')) AS is_urgent,
        COALESCE(NULLIF(regexp_replace(wo.address_approximate, 'GPS\\s*\\([^)]*\\)', 'Area'), ''), 'Nearby Area') AS area_name,
        ROUND(ST_Y(wo.location::geometry)::numeric, 2) AS grid_lat,
        ROUND(ST_X(wo.location::geometry)::numeric, 2) AS grid_lng,
        ARRAY_AGG(wos.skill_id) FILTER (WHERE wos.skill_id IS NOT NULL) AS required_skills
      FROM work_opportunities wo
      JOIN categories c ON c.id = wo.category_id
      LEFT JOIN work_opportunity_skills wos ON wos.work_opportunity_id = wo.id
      WHERE wo.status IN ('PUBLISHED', 'MATCHING')
        AND wo.workers_assigned < wo.workers_needed
        AND wo.work_date >= CURRENT_DATE
        AND ST_DWithin(wo.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
        ${categoryFilter}
      GROUP BY wo.id, wo.category_id, c.name, wo.payment_amount, wo.urgency, wo.address_approximate, wo.location
    `;
    const jobsRes = await query<any>(activeJobsSql, queryParams);

    // C. Compute Aggregated Metrics
    let matchedJobDemandCount = 0;
    const categoryMap = new Map<string, { categoryId: string; categoryName: string; count: number; totalWage: number; urgentCount: number }>();
    const hotspotMap = new Map<string, { name: string; lat: number; lng: number; count: number; totalWage: number; categories: Set<string> }>();

    for (const job of jobsRes.rows) {
      const skills: string[] = job.required_skills || [];
      const isMatched = skills.some((sId) => workerSkillIds.has(sId));
      if (isMatched) matchedJobDemandCount++;

      // Category aggregation
      const catKey = job.category_id;
      const currentCat = categoryMap.get(catKey) || {
        categoryId: job.category_id,
        categoryName: job.category_name,
        count: 0,
        totalWage: 0,
        urgentCount: 0,
      };
      currentCat.count += 1;
      currentCat.totalWage += Number(job.payment_amount) || 0;
      if (job.is_urgent) currentCat.urgentCount += 1;
      categoryMap.set(catKey, currentCat);

      // Hotspot clustering by ~1.1 km grid cell
      const gridKey = `${job.grid_lat}_${job.grid_lng}`;
      const currentHotspot = hotspotMap.get(gridKey) || {
        name: job.area_name,
        lat: Number(job.grid_lat),
        lng: Number(job.grid_lng),
        count: 0,
        totalWage: 0,
        categories: new Set<string>(),
      };
      currentHotspot.count += 1;
      currentHotspot.totalWage += Number(job.payment_amount) || 0;
      currentHotspot.categories.add(job.category_name);
      hotspotMap.set(gridKey, currentHotspot);
    }

    // D. Fetch skill-level demand across active jobs
    const skillDemandRes = await query<{ skill_id: string; skill_name: string; jobs_demanding: string }>(
      `SELECT 
        s.id AS skill_id,
        s.name AS skill_name,
        COUNT(DISTINCT wo.id) AS jobs_demanding
       FROM skills s
       JOIN work_opportunity_skills wos ON wos.skill_id = s.id
       JOIN work_opportunities wo ON wo.id = wos.work_opportunity_id
       WHERE wo.status IN ('PUBLISHED', 'MATCHING')
         AND wo.workers_assigned < wo.workers_needed
         AND wo.work_date >= CURRENT_DATE
         AND ST_DWithin(wo.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       GROUP BY s.id, s.name
       ORDER BY jobs_demanding DESC
       LIMIT 8`,
      [centerLng, centerLat, radiusMeters]
    );

    // E. Fetch recent completed jobs in past 30 days (market vitality)
    const recentRes = await query<{ completed_count: string }>(
      `SELECT COUNT(id) AS completed_count
       FROM work_opportunities
       WHERE status = 'COMPLETED'
         AND updated_at >= NOW() - INTERVAL '30 days'
         AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`,
      [centerLng, centerLat, radiusMeters]
    );

    // Formulate hotspots
    const hotspots: WorkforceRadarHotspot[] = Array.from(hotspotMap.entries()).map(([, val], idx) => {
      const avgWage = val.count > 0 ? Math.round(val.totalWage / val.count) : 0;
      return {
        id: `hotspot_job_${idx + 1}`,
        locationName: val.name,
        latitude: val.lat,
        longitude: val.lng,
        activeOpportunitiesCount: val.count,
        activeWorkersCount: 0, // Privacy: worker counts hidden from workers
        supplyDemandRatio: 1.0,
        topCategories: Array.from(val.categories).slice(0, 3),
        avgWage,
        urgencyTier: val.count >= 5 ? "HIGH_DEMAND" : "BALANCED",
      };
    });

    return {
      role: "WORKER",
      searchCenter: { latitude: centerLat, longitude: centerLng },
      radiusKm,
      activeOpportunitiesCount: jobsRes.rows.length,
      matchedJobDemandCount,
      demandByCategory: Array.from(categoryMap.values()).map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        activeJobsCount: c.count,
        avgWage: c.count > 0 ? Math.round(c.totalWage / c.count) : 0,
        urgentCount: c.urgentCount,
      })),
      demandBySkill: skillDemandRes.rows.map((r) => ({
        skillId: r.skill_id,
        skillName: r.skill_name,
        jobsDemandingCount: parseInt(r.jobs_demanding, 10) || 0,
      })),
      hotspots,
      recentCompletedJobsCount: parseInt(recentRes.rows[0]?.completed_count || "0", 10),
    };
  }

  /**
   * 2. PROVIDER RADAR:
   * Aggregates online workforce availability, k-anonymity neighborhood clusters,
   * anonymized talent cards, and local hiring competition/wage benchmarks.
   */
  public async getProviderRadar(
    _providerUserId: string,
    centerLat: number,
    centerLng: number,
    radiusKm: number,
    categoryId?: string
  ): Promise<ProviderRadarData> {
    const radiusMeters = radiusKm * 1000;

    // Strict availability freshness filter:
    const availabilityFilter = `
      wp.is_available_now = TRUE
      AND wp.availability_status != 'OFFLINE'
      AND (wp.available_until IS NULL OR wp.available_until > NOW())
      AND (
        (wp.availability_updated_at IS NOT NULL AND wp.availability_updated_at >= NOW() - INTERVAL '12 hours')
        OR
        (wp.availability_updated_at IS NULL AND wp.updated_at >= NOW() - INTERVAL '12 hours')
      )
    `;

    // A. Available Workers Category Aggregates
    const categoryFilterClause = categoryId && categoryId !== "ALL" ? "AND c.id = $4" : "";
    const categoryParams: any[] = [centerLng, centerLat, radiusMeters];
    if (categoryId && categoryId !== "ALL") categoryParams.push(categoryId);

    const categorySql = `
      SELECT 
        c.id AS category_id,
        c.name AS category_name,
        c.slug AS category_slug,
        COUNT(DISTINCT wp.id) AS available_count
      FROM worker_profiles wp
      JOIN worker_skills ws ON ws.worker_id = wp.id
      JOIN skills s ON s.id = ws.skill_id
      JOIN categories c ON c.id = s.category_id
      WHERE ${availabilityFilter}
        AND ST_DWithin(wp.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
        ${categoryFilterClause}
      GROUP BY c.id, c.name, c.slug
      ORDER BY available_count DESC
    `;
    const categoryRes = await query<any>(categorySql, categoryParams);

    // B. Total Online Workers Count
    const totalWorkersRes = await query<{ total_count: string }>(
      `SELECT COUNT(DISTINCT wp.id) AS total_count
       FROM worker_profiles wp
       WHERE ${availabilityFilter}
         AND ST_DWithin(wp.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`,
      [centerLng, centerLat, radiusMeters]
    );

    // C. Locality Clusters with k-Anonymity (singletons grouped into Other Nearby Neighborhoods)
    const clusterSql = `
      SELECT 
        COALESCE(wp.address_approximate, 'Bangalore Urban') AS approximate_area_name,
        COUNT(DISTINCT wp.id) AS worker_count,
        json_agg(DISTINCT jsonb_build_object(
          'categoryId', c.id,
          'categoryName', c.name
        )) AS available_categories
      FROM worker_profiles wp
      LEFT JOIN worker_skills ws ON ws.worker_id = wp.id
      LEFT JOIN skills s ON s.id = ws.skill_id
      LEFT JOIN categories c ON c.id = s.category_id
      WHERE ${availabilityFilter}
        AND ST_DWithin(wp.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      GROUP BY COALESCE(wp.address_approximate, 'Bangalore Urban')
      ORDER BY worker_count DESC
      LIMIT 10
    `;
    const clusterRes = await query<any>(clusterSql, [centerLng, centerLat, radiusMeters]);

    const thresholdClusters: any[] = [];
    let smallClustersCount = 0;
    const smallClustersCategories: any[] = [];

    for (const r of clusterRes.rows) {
      const count = parseInt(r.worker_count || "0", 10);
      if (count >= 2) {
        thresholdClusters.push({
          id: `cluster_${thresholdClusters.length + 1}`,
          approximateAreaName: (r.approximate_area_name || "Bangalore").replace(/GPS\s*\([^)]*\)/gi, "Central Zone"),
          centerCoordinates: {
            latitude: centerLat,
            longitude: centerLng,
          },
          availableWorkersCount: count,
          categories: Array.isArray(r.available_categories)
            ? r.available_categories.filter((cat: any) => cat && cat.categoryId)
            : [],
        });
      } else if (count > 0) {
        smallClustersCount += count;
        if (Array.isArray(r.available_categories)) {
          for (const c of r.available_categories) {
            if (c && c.categoryId && !smallClustersCategories.some((sc) => sc.categoryId === c.categoryId)) {
              smallClustersCategories.push(c);
            }
          }
        }
      }
    }

    if (smallClustersCount > 0) {
      thresholdClusters.push({
        id: `cluster_${thresholdClusters.length + 1}`,
        approximateAreaName: "Other Nearby Neighborhoods",
        centerCoordinates: {
          latitude: centerLat,
          longitude: centerLng,
        },
        availableWorkersCount: smallClustersCount,
        categories: smallClustersCategories,
      });
    }

    // D. Privacy-Safe Anonymized Talent Cards within Radius
    const talentSql = `
      SELECT 
        wp.id AS worker_profile_id,
        COALESCE(
          (SELECT c.name FROM worker_skills ws 
           JOIN skills s ON s.id = ws.skill_id 
           JOIN categories c ON c.id = s.category_id 
           WHERE ws.worker_id = wp.id LIMIT 1),
          'General Assistant'
        ) AS primary_skill,
        COALESCE(wp.average_rating, 4.8) AS rating,
        COALESCE(wp.total_ratings_count, 0) AS total_ratings,
        COALESCE(wp.completed_tasks_count, 0) AS completed_tasks,
        COALESCE(wp.verified_badge, false) AS verified_badge,
        (u.phone IS NOT NULL) AS phone_verified,
        ROUND((ST_Distance(wp.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000)::numeric, 1) AS distance_km,
        COALESCE(NULLIF(regexp_replace(wp.address_approximate, 'GPS\\s*\\([^)]*\\)', 'Nearby Zone'), ''), 'Bangalore') AS area_name,
        wp.is_available_now
      FROM worker_profiles wp
      JOIN users u ON u.id = wp.user_id
      WHERE ${availabilityFilter}
        AND ST_DWithin(wp.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      ORDER BY distance_km ASC
      LIMIT 8
    `;
    const talentRes = await query<any>(talentSql, [centerLng, centerLat, radiusMeters]);

    // E. Competing open jobs count & average local wage rates (to benchmark hiring)
    const competingRes = await query<{
      competing_count: string;
      category_id: string;
      category_name: string;
      avg_wage: string;
      median_wage: string;
    }>(
      `SELECT 
        COUNT(wo.id) AS competing_count,
        c.id AS category_id,
        c.name AS category_name,
        COALESCE(AVG(wo.payment_amount), 800) AS avg_wage,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY wo.payment_amount), 800) AS median_wage
       FROM work_opportunities wo
       JOIN categories c ON c.id = wo.category_id
       WHERE wo.status IN ('PUBLISHED', 'MATCHING')
         AND wo.work_date >= CURRENT_DATE
         AND ST_DWithin(wo.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       GROUP BY c.id, c.name
       LIMIT 6`,
      [centerLng, centerLat, radiusMeters]
    );

    const competingOpenJobsCount = competingRes.rows.reduce(
      (acc, r) => acc + parseInt(r.competing_count || "0", 10),
      0
    );

    return {
      role: "PROVIDER",
      searchCenter: { latitude: centerLat, longitude: centerLng },
      radiusKm,
      totalAvailableWorkers: parseInt(totalWorkersRes.rows[0]?.total_count || "0", 10),
      categoryCounts: categoryRes.rows.map((r) => ({
        categoryId: r.category_id,
        categoryName: r.category_name,
        categorySlug: r.category_slug,
        availableWorkersCount: parseInt(r.available_count || "0", 10),
      })),
      clusters: thresholdClusters,
      availableTalent: talentRes.rows.map((r, idx) => ({
        id: `talent_${idx + 1}`,
        primarySkill: r.primary_skill,
        rating: Number(r.rating) || 4.8,
        totalRatings: parseInt(r.total_ratings || "0", 10),
        completedTasks: parseInt(r.completed_tasks || "0", 10),
        verifiedBadge: Boolean(r.verified_badge),
        phoneVerified: Boolean(r.phone_verified),
        // Coarsened distance in 0.5 km steps to protect against triangulation
        distanceKm: Math.round((Number(r.distance_km) || 1.5) * 2) / 2,
        areaName: (r.area_name || "Nearby Zone").replace(/GPS\s*\([^)]*\)/gi, "Nearby Zone"),
        isAvailableNow: Boolean(r.is_available_now),
      })),
      competingOpenJobsCount,
      localWageAverages: competingRes.rows.map((r) => ({
        categoryId: r.category_id,
        categoryName: r.category_name,
        avgWage: Math.round(Number(r.avg_wage)),
        medianWage: Math.round(Number(r.median_wage)),
      })),
    };
  }

  /**
   * 3. AGENT RADAR:
   * Aggregates job demand corresponding to the registered skills of the agent's linked workers.
   */
  public async getAgentRadar(
    agentUserId: string,
    centerLat: number,
    centerLng: number,
    radiusKm: number
  ): Promise<AgentRadarData> {
    const radiusMeters = radiusKm * 1000;

    // A. Fetch active linked workers for agent
    const linkedWorkersRes = await query<{
      worker_id: string;
      is_available_now: boolean;
      availability_status: string;
    }>(
      `SELECT 
        wp.id AS worker_id,
        wp.is_available_now,
        wp.availability_status
       FROM agent_profiles ap
       JOIN agent_worker_relationships awr ON awr.agent_id = ap.id
       JOIN worker_profiles wp ON wp.id = awr.worker_id
       WHERE ap.user_id = $1 AND awr.status = 'ACTIVE'`,
      [agentUserId]
    );

    const totalLinkedWorkers = linkedWorkersRes.rows.length;
    const onlineLinkedWorkers = linkedWorkersRes.rows.filter(
      (w) => w.is_available_now && w.availability_status !== "OFFLINE"
    ).length;

    // B. Collect skills of linked workers
    const skillsRes = await query<{ skill_id: string; skill_name: string }>(
      `SELECT DISTINCT ws.skill_id, s.name AS skill_name
       FROM agent_profiles ap
       JOIN agent_worker_relationships awr ON awr.agent_id = ap.id
       JOIN worker_skills ws ON ws.worker_id = awr.worker_id
       JOIN skills s ON s.id = ws.skill_id
       WHERE ap.user_id = $1 AND awr.status = 'ACTIVE'`,
      [agentUserId]
    );
    const linkedSkillIds = skillsRes.rows.map((s) => s.skill_id);

    // C. If agent has linked skills, query open jobs demanding those skills
    let linkedSkillsDemandCount = 0;
    let topDemandedSkillsForLinked: { skillName: string; jobsCount: number }[] = [];

    if (linkedSkillIds.length > 0) {
      const demandRes = await query<{
        skill_name: string;
        jobs_count: string;
      }>(
        `SELECT 
          s.name AS skill_name,
          COUNT(DISTINCT wo.id) AS jobs_count
         FROM skills s
         JOIN work_opportunity_skills wos ON wos.skill_id = s.id
         JOIN work_opportunities wo ON wo.id = wos.work_opportunity_id
         WHERE s.id = ANY($1)
           AND wo.status IN ('PUBLISHED', 'MATCHING')
           AND wo.workers_assigned < wo.workers_needed
           AND wo.work_date >= CURRENT_DATE
           AND ST_DWithin(wo.location, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)
         GROUP BY s.name
         ORDER BY jobs_count DESC
         LIMIT 6`,
        [linkedSkillIds, centerLng, centerLat, radiusMeters]
      );

      topDemandedSkillsForLinked = demandRes.rows.map((r) => ({
        skillName: r.skill_name,
        jobsCount: parseInt(r.jobs_count, 10) || 0,
      }));

      linkedSkillsDemandCount = topDemandedSkillsForLinked.reduce((acc, r) => acc + r.jobsCount, 0);
    }

    // D. General open jobs category count in area
    const catRes = await query<{ category_id: string; category_name: string; open_jobs: string }>(
      `SELECT 
        c.id AS category_id,
        c.name AS category_name,
        COUNT(wo.id) AS open_jobs
       FROM categories c
       JOIN work_opportunities wo ON wo.category_id = c.id
       WHERE wo.status IN ('PUBLISHED', 'MATCHING')
         AND wo.workers_assigned < wo.workers_needed
         AND wo.work_date >= CURRENT_DATE
         AND ST_DWithin(wo.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       GROUP BY c.id, c.name
       ORDER BY open_jobs DESC`,
      [centerLng, centerLat, radiusMeters]
    );

    // E. Hotspots in area
    const hotspotsRes = await query<{
      location_name: string;
      lat: number;
      lng: number;
      job_count: string;
    }>(
      `SELECT 
        COALESCE(NULLIF(regexp_replace(address_approximate, 'GPS\\s*\\([^)]*\\)', 'Area'), ''), 'Operating Hub') AS location_name,
        ROUND(ST_Y(location::geometry)::numeric, 2) AS lat,
        ROUND(ST_X(location::geometry)::numeric, 2) AS lng,
        COUNT(id) AS job_count
       FROM work_opportunities
       WHERE status IN ('PUBLISHED', 'MATCHING')
         AND work_date >= CURRENT_DATE
         AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       GROUP BY location_name, ROUND(ST_Y(location::geometry)::numeric, 2), ROUND(ST_X(location::geometry)::numeric, 2)
       LIMIT 6`,
      [centerLng, centerLat, radiusMeters]
    );

    const hotspots: WorkforceRadarHotspot[] = hotspotsRes.rows.map((h, idx) => ({
      id: `hotspot_agent_${idx + 1}`,
      locationName: h.location_name,
      latitude: Number(h.lat),
      longitude: Number(h.lng),
      activeOpportunitiesCount: parseInt(h.job_count, 10) || 0,
      activeWorkersCount: 0,
      supplyDemandRatio: 1.0,
      topCategories: ["Assisted Field Services"],
      urgencyTier: "BALANCED",
    }));

    return {
      role: "AGENT",
      searchCenter: { latitude: centerLat, longitude: centerLng },
      radiusKm,
      totalLinkedWorkers,
      onlineLinkedWorkers,
      linkedSkillsDemandCount,
      topDemandedSkillsForLinked,
      hotspots,
      categoryCounts: catRes.rows.map((r) => ({
        categoryId: r.category_id,
        categoryName: r.category_name,
        openJobsCount: parseInt(r.open_jobs, 10) || 0,
      })),
    };
  }

  /**
   * 4. ADMIN RADAR:
   * Aggregates macro platform metrics: total active jobs, total available workers,
   * supply-demand ratio, category health breakdown, and urban hotspots.
   */
  public async getAdminRadar(
    centerLat: number,
    centerLng: number,
    radiusKm: number
  ): Promise<AdminRadarData> {
    const radiusMeters = radiusKm * 1000;

    // Strict availability filter for online workers
    const availabilityFilter = `
      wp.is_available_now = TRUE
      AND wp.availability_status != 'OFFLINE'
      AND (wp.available_until IS NULL OR wp.available_until > NOW())
      AND (
        (wp.availability_updated_at IS NOT NULL AND wp.availability_updated_at >= NOW() - INTERVAL '12 hours')
        OR
        (wp.availability_updated_at IS NULL AND wp.updated_at >= NOW() - INTERVAL '12 hours')
      )
    `;

    // A. Total Active Jobs
    const jobsCountRes = await query<{ active_jobs: string }>(
      `SELECT COUNT(id) AS active_jobs
       FROM work_opportunities
       WHERE status IN ('PUBLISHED', 'MATCHING')
         AND workers_assigned < workers_needed
         AND work_date >= CURRENT_DATE
         AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`,
      [centerLng, centerLat, radiusMeters]
    );
    const totalActiveJobs = parseInt(jobsCountRes.rows[0]?.active_jobs || "0", 10);

    // B. Total Available Workers
    const workersCountRes = await query<{ available_workers: string }>(
      `SELECT COUNT(DISTINCT wp.id) AS available_workers
       FROM worker_profiles wp
       WHERE ${availabilityFilter}
         AND ST_DWithin(wp.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`,
      [centerLng, centerLat, radiusMeters]
    );
    const totalAvailableWorkers = parseInt(workersCountRes.rows[0]?.available_workers || "0", 10);

    const supplyDemandRatio = totalActiveJobs > 0
      ? Number((totalAvailableWorkers / totalActiveJobs).toFixed(2))
      : totalAvailableWorkers > 0 ? 99.0 : 1.0;

    // C. Recent Completed Jobs Volume (past 7 days)
    const completedRes = await query<{ completed_count: string }>(
      `SELECT COUNT(id) AS completed_count
       FROM work_opportunities
       WHERE status = 'COMPLETED'
         AND updated_at >= NOW() - INTERVAL '7 days'
         AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`,
      [centerLng, centerLat, radiusMeters]
    );
    const recentCompletedJobsCount = parseInt(completedRes.rows[0]?.completed_count || "0", 10);

    // D. Category Supply vs Demand Matrix
    const catMatrixRes = await query<{
      category_id: string;
      category_name: string;
      active_jobs: string;
      available_workers: string;
    }>(
      `SELECT 
        c.id AS category_id,
        c.name AS category_name,
        COUNT(DISTINCT wo.id) AS active_jobs,
        COUNT(DISTINCT wp.id) AS available_workers
       FROM categories c
       LEFT JOIN work_opportunities wo ON wo.category_id = c.id
         AND wo.status IN ('PUBLISHED', 'MATCHING')
         AND wo.work_date >= CURRENT_DATE
         AND ST_DWithin(wo.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       LEFT JOIN skills s ON s.category_id = c.id
       LEFT JOIN worker_skills ws ON ws.skill_id = s.id
       LEFT JOIN worker_profiles wp ON wp.id = ws.worker_id
         AND ${availabilityFilter}
         AND ST_DWithin(wp.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       GROUP BY c.id, c.name
       ORDER BY active_jobs DESC, available_workers DESC
       LIMIT 10`,
      [centerLng, centerLat, radiusMeters]
    );

    const categorySupplyDemand = catMatrixRes.rows.map((r) => {
      const j = parseInt(r.active_jobs || "0", 10);
      const w = parseInt(r.available_workers || "0", 10);
      const ratio = j > 0 ? Number((w / j).toFixed(2)) : w > 0 ? 10.0 : 1.0;
      let status: "SHORTAGE" | "BALANCED" | "SURPLUS" = "BALANCED";
      if (ratio < 0.5) status = "SHORTAGE";
      else if (ratio > 2.0) status = "SURPLUS";

      return {
        categoryId: r.category_id,
        categoryName: r.category_name,
        activeJobsCount: j,
        availableWorkersCount: w,
        ratio,
        status,
      };
    });

    // E. Hotspots across area (combining job count and worker count)
    const hotspotsSql = `
      SELECT 
        COALESCE(NULLIF(regexp_replace(wo.address_approximate, 'GPS\\s*\\([^)]*\\)', 'Area'), ''), 'Urban Node') AS location_name,
        ROUND(ST_Y(wo.location::geometry)::numeric, 2) AS lat,
        ROUND(ST_X(wo.location::geometry)::numeric, 2) AS lng,
        COUNT(DISTINCT wo.id) AS active_jobs,
        ARRAY_AGG(DISTINCT c.name) AS top_categories
      FROM work_opportunities wo
      JOIN categories c ON c.id = wo.category_id
      WHERE wo.status IN ('PUBLISHED', 'MATCHING')
        AND wo.work_date >= CURRENT_DATE
        AND ST_DWithin(wo.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      GROUP BY location_name, ROUND(ST_Y(wo.location::geometry)::numeric, 2), ROUND(ST_X(wo.location::geometry)::numeric, 2)
      LIMIT 8
    `;
    const hotspotsRes = await query<any>(hotspotsSql, [centerLng, centerLat, radiusMeters]);

    const hotspots: WorkforceRadarHotspot[] = hotspotsRes.rows.map((h, idx) => {
      const activeJobs = parseInt(h.active_jobs || "0", 10);
      return {
        id: `hotspot_admin_${idx + 1}`,
        locationName: h.location_name,
        latitude: Number(h.lat),
        longitude: Number(h.lng),
        activeOpportunitiesCount: activeJobs,
        activeWorkersCount: 0,
        supplyDemandRatio: 1.0,
        topCategories: (h.top_categories || []).slice(0, 3),
        urgencyTier: activeJobs >= 5 ? "HIGH_DEMAND" : "BALANCED",
      };
    });

    return {
      role: "ADMIN",
      searchCenter: { latitude: centerLat, longitude: centerLng },
      radiusKm,
      totalActiveJobs,
      totalAvailableWorkers,
      supplyDemandRatio,
      recentCompletedJobsCount,
      categorySupplyDemand,
      hotspots,
    };
  }
}

export const radarService = new RadarService();
