/**
 * Provider Domain Service
 * Handles Provider Profile, Business Classification, Spatial Location, and Profile Completion.
 */

import {
  ProviderProfileDetail,
  ProviderType,
  ProfileCompletionStatus,
} from "@nearvia/types";
import {
  UpdateProviderProfileInput,
  UpdateProviderLocationInput,
} from "@nearvia/validation";
import { ErrorCode } from "@nearvia/config";
import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";

interface DbProviderRow {
  id: string;
  user_id: string;
  provider_type: ProviderType;
  business_name: string | null;
  description: string | null;
  contact_phone: string | null;
  latitude: number;
  longitude: number;
  address_approximate: string | null;
  verified_business: boolean;
  average_rating: string | number;
  total_ratings_count: number;
  posted_jobs_count: number;
  created_at: string;
  updated_at: string;
  full_name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
}

export class ProvidersService {
  /**
   * Computes server-side provider profile completion status.
   */
  public calculateProfileCompletion(
    providerType: ProviderType,
    fullName: string,
    phone: string,
    hasLocation: boolean,
    businessName?: string | null,
    description?: string | null,
    contactPhone?: string | null,
    addressApproximate?: string | null,
  ): ProfileCompletionStatus {
    const requiredChecks = [
      {
        name: "Provider Name",
        key: "fullName",
        completed: Boolean(fullName && fullName.trim().length >= 2),
        weight: 25,
      },
      {
        name: "Primary Phone",
        key: "phone",
        completed: Boolean(phone && phone.trim().length >= 10),
        weight: 25,
      },
      {
        name: "Location Coordinates",
        key: "location",
        completed: hasLocation,
        weight: 30,
      },
    ];

    if (providerType === ProviderType.BUSINESS) {
      requiredChecks.push({
        name: "Business Name",
        key: "businessName",
        completed: Boolean(businessName && businessName.trim().length >= 2),
        weight: 20,
      });
    }

    const optionalChecks = [
      {
        name: "Business / Service Description",
        key: "description",
        completed: Boolean(description && description.trim().length >= 10),
        weight: 10,
      },
      {
        name: "Contact Phone Number",
        key: "contactPhone",
        completed: Boolean(contactPhone && contactPhone.trim().length >= 10),
        weight: 5,
      },
      {
        name: "Approximate Locality",
        key: "addressApproximate",
        completed: Boolean(
          addressApproximate && addressApproximate.trim().length > 0,
        ),
        weight: 5,
      },
    ];

    const completedFields: string[] = [];
    const missingRequired: string[] = [];
    const missingOptional: string[] = [];

    let totalScore = 0;

    for (const check of requiredChecks) {
      if (check.completed) {
        completedFields.push(check.key);
        totalScore += check.weight;
      } else {
        missingRequired.push(check.name);
      }
    }

    for (const check of optionalChecks) {
      if (check.completed) {
        completedFields.push(check.key);
        totalScore += check.weight;
      } else {
        missingOptional.push(check.name);
      }
    }

    const isComplete = missingRequired.length === 0;

    return {
      isComplete,
      completionPercentage: Math.min(100, Math.round(totalScore)),
      completedFields,
      missingRequired,
      missingOptional,
    };
  }

  /**
   * Retrieves or initializes provider_profiles record for the authenticated user.
   */
  public async getOrCreateProviderProfile(userId: string): Promise<string> {
    try {
      const existing = await query<{ id: string }>(
        "SELECT id FROM provider_profiles WHERE user_id = $1",
        [userId],
      );

      if (existing.rows.length > 0 && existing.rows[0]) {
        return existing.rows[0].id;
      }

      // Default seed location in Central Bangalore (12.9716, 77.5946)
      const result = await query<{ id: string }>(
        `INSERT INTO provider_profiles (user_id, provider_type, location, verified_business)
         VALUES ($1, 'INDIVIDUAL', ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, FALSE)
         RETURNING id`,
        [userId],
      );

      if (!result.rows[0]) {
        throw new AppError(
          "Failed to initialize provider profile.",
          500,
          ErrorCode.INTERNAL_SERVER_ERROR,
        );
      }

      return result.rows[0].id;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Failed to initialize provider profile: ${err.message}`,
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }
  }

  /**
   * Get comprehensive Provider Profile Detail for current authenticated user.
   */
  public async getProviderProfileDetail(
    userId: string,
  ): Promise<ProviderProfileDetail> {
    try {
      await this.getOrCreateProviderProfile(userId);

      const sql = `
        SELECT 
          pp.id,
          pp.user_id,
          pp.provider_type,
          pp.business_name,
          pp.description,
          pp.contact_phone,
          ST_Y(pp.location::geometry) AS latitude,
          ST_X(pp.location::geometry) AS longitude,
          pp.address_approximate,
          pp.verified_business,
          pp.average_rating,
          pp.total_ratings_count,
          pp.posted_jobs_count,
          pp.created_at,
          pp.updated_at,
          u.full_name,
          u.phone,
          u.email,
          u.avatar_url
        FROM provider_profiles pp
        JOIN users u ON pp.user_id = u.id
        WHERE pp.user_id = $1
      `;

      const result = await query<DbProviderRow>(sql, [userId]);
      const row = result.rows[0];

      if (!row) {
        throw new AppError(
          "Provider profile not found.",
          404,
          ErrorCode.NOT_FOUND,
        );
      }

      const profileCompletion = this.calculateProfileCompletion(
        row.provider_type,
        row.full_name,
        row.phone,
        Boolean(row.latitude && row.longitude),
        row.business_name,
        row.description,
        row.contact_phone,
        row.address_approximate,
      );

      const detail: ProviderProfileDetail = {
        id: row.id,
        userId: row.user_id,
        providerType: row.provider_type,
        businessName: row.business_name ?? undefined,
        description: row.description ?? undefined,
        contactPhone: row.contact_phone ?? undefined,
        location: {
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
        },
        addressApproximate: row.address_approximate ?? undefined,
        verifiedBusiness: row.verified_business,
        averageRating: Number(row.average_rating) || 5.0,
        totalRatingsCount: row.total_ratings_count || 0,
        postedJobsCount: row.posted_jobs_count || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        fullName: row.full_name,
        phone: row.phone,
        email: row.email ?? undefined,
        avatarUrl: row.avatar_url ?? undefined,
        profileCompletion,
      };

      return detail;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Failed to fetch provider profile: ${err.message}`,
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }
  }

  /**
   * Update basic Provider Profile attributes.
   */
  public async updateProviderProfile(
    userId: string,
    input: UpdateProviderProfileInput,
  ): Promise<ProviderProfileDetail> {
    try {
      const providerId = await this.getOrCreateProviderProfile(userId);

      const updateFields: string[] = ["updated_at = NOW()"];
      const params: unknown[] = [providerId];

      if (input.providerType !== undefined) {
        params.push(input.providerType);
        updateFields.push(`provider_type = $${params.length}`);
      }

      if (input.businessName !== undefined) {
        params.push(input.businessName);
        updateFields.push(`business_name = $${params.length}`);
      }

      if (input.description !== undefined) {
        params.push(input.description);
        updateFields.push(`description = $${params.length}`);
      }

      if (input.contactPhone !== undefined) {
        params.push(input.contactPhone);
        updateFields.push(`contact_phone = $${params.length}`);
      }

      if (input.addressApproximate !== undefined) {
        params.push(input.addressApproximate);
        updateFields.push(`address_approximate = $${params.length}`);
      }

      if (input.location !== undefined) {
        params.push(input.location.longitude);
        const lngIndex = params.length;
        params.push(input.location.latitude);
        const latIndex = params.length;
        updateFields.push(
          `location = ST_SetSRID(ST_MakePoint($${lngIndex}, $${latIndex}), 4326)::geography`,
        );
      }

      const sql = `
        UPDATE provider_profiles
        SET ${updateFields.join(", ")}
        WHERE id = $1
      `;

      await query(sql, params);
      return this.getProviderProfileDetail(userId);
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Failed to update provider profile: ${err.message}`,
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }
  }

  /**
   * Update Provider PostGIS spatial coordinates.
   */
  public async updateProviderLocation(
    userId: string,
    input: UpdateProviderLocationInput,
  ): Promise<ProviderProfileDetail> {
    try {
      const providerId = await this.getOrCreateProviderProfile(userId);

      const updateFields: string[] = [
        "location = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography",
        "updated_at = NOW()",
      ];
      const params: unknown[] = [providerId, input.longitude, input.latitude];

      if (input.addressApproximate !== undefined) {
        params.push(input.addressApproximate);
        updateFields.push(`address_approximate = $${params.length}`);
      }

      const sql = `
        UPDATE provider_profiles
        SET ${updateFields.join(", ")}
        WHERE id = $1
      `;

      await query(sql, params);
      return this.getProviderProfileDetail(userId);
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Failed to update provider location: ${err.message}`,
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }
  }

  /**
   * Phase 5: Workforce Radar (Aggregated Hyperlocal Talent Availability)
   * Adheres to strict privacy rules: NO exact live worker GPS coordinates exposed.
   */
  public async getWorkforceRadar(
    providerUserId: string,
    latitude?: number,
    longitude?: number,
    radiusKm = 5.0,
    categoryId?: string,
  ): Promise<any> {
    try {
      // 1. Resolve search center
      let centerLat = latitude;
      let centerLng = longitude;

      if (!centerLat || !centerLng) {
        const provRes = await query<{ latitude: number; longitude: number }>(
          `SELECT ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude
           FROM provider_profiles
           WHERE user_id = $1`,
          [providerUserId],
        );
        const pFirst = provRes.rows[0];
        if (pFirst) {
          centerLat = Number(pFirst.latitude);
          centerLng = Number(pFirst.longitude);
        } else {
          centerLat = 12.9716; // MG Road default
          centerLng = 77.5946;
        }
      }

      const boundedRadius = Math.min(20, Math.max(1, radiusKm));

      // 2. Query available workers within radius (PostGIS ST_DWithin)
      // Category Aggregates
      const categoryFilterClause = categoryId && categoryId !== "ALL" ? "AND c.id = $4" : "";
      const categoryParams: any[] = [centerLng, centerLat, boundedRadius * 1000];
      if (categoryId && categoryId !== "ALL") {
        categoryParams.push(categoryId);
      }

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
        WHERE wp.is_available_now = TRUE
          AND (wp.available_until IS NULL OR wp.available_until > NOW())
          AND ST_DWithin(
            wp.location,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            $3
          )
          ${categoryFilterClause}
        GROUP BY c.id, c.name, c.slug
        ORDER BY available_count DESC
      `;

      const categoryRes = await query<any>(categorySql, categoryParams);

      // 3. Approximate Privacy Clusters (Aggregated by locality area / approximate neighborhood)
      const clusterSql = `
        SELECT 
          COALESCE(wp.address_approximate, 'Bangalore Urban') AS approximate_area_name,
          ROUND(AVG(ST_Y(wp.location::geometry))::numeric, 3) AS center_latitude,
          ROUND(AVG(ST_X(wp.location::geometry))::numeric, 3) AS center_longitude,
          COUNT(DISTINCT wp.id) AS worker_count,
          json_agg(DISTINCT jsonb_build_object(
            'categoryId', c.id,
            'categoryName', c.name
          )) AS available_categories
        FROM worker_profiles wp
        LEFT JOIN worker_skills ws ON ws.worker_id = wp.id
        LEFT JOIN skills s ON s.id = ws.skill_id
        LEFT JOIN categories c ON c.id = s.category_id
        WHERE wp.is_available_now = TRUE
          AND (wp.available_until IS NULL OR wp.available_until > NOW())
          AND ST_DWithin(
            wp.location,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            $3
          )
        GROUP BY COALESCE(wp.address_approximate, 'Bangalore Urban')
        ORDER BY worker_count DESC
        LIMIT 10
      `;

      const clusterRes = await query<any>(clusterSql, [centerLng, centerLat, boundedRadius * 1000]);

      // 4. Privacy-Safe Anonymized Talent Cards within Radius
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
          ROUND((ST_Distance(
            wp.location,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          ) / 1000)::numeric, 1) AS distance_km,
          COALESCE(NULLIF(regexp_replace(wp.address_approximate, 'GPS \\(.*?\\)', 'Nearby Zone'), ''), 'Bangalore') AS area_name,
          wp.is_available_now
        FROM worker_profiles wp
        JOIN users u ON u.id = wp.user_id
        WHERE wp.is_available_now = TRUE
          AND (wp.available_until IS NULL OR wp.available_until > NOW())
          AND ST_DWithin(
            wp.location,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            $3
          )
        ORDER BY distance_km ASC
        LIMIT 8
      `;
      const talentRes = await query<any>(talentSql, [centerLng, centerLat, boundedRadius * 1000]);

      // Total available online workers count
      const totalWorkersRes = await query<{ total_count: string }>(
        `SELECT COUNT(DISTINCT wp.id) AS total_count
         FROM worker_profiles wp
         WHERE wp.is_available_now = TRUE
           AND (wp.available_until IS NULL OR wp.available_until > NOW())
           AND ST_DWithin(
             wp.location,
             ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
             $3
           )`,
        [centerLng, centerLat, boundedRadius * 1000],
      );

      return {
        totalAvailableWorkers: parseInt(totalWorkersRes.rows[0]?.total_count || "0", 10),
        searchCenter: {
          latitude: centerLat,
          longitude: centerLng,
        },
        radiusKm: boundedRadius,
        categoryCounts: categoryRes.rows.map((r) => ({
          categoryId: r.category_id,
          categoryName: r.category_name,
          categorySlug: r.category_slug,
          availableWorkersCount: parseInt(r.available_count || "0", 10),
        })),
        clusters: clusterRes.rows.map((r, idx) => ({
          id: `cluster_${idx + 1}`,
          approximateAreaName: (r.approximate_area_name || "Bangalore").replace(/GPS\s*\([^)]*\)/gi, "Central Zone"),
          centerCoordinates: {
            latitude: Number(r.center_latitude) || centerLat,
            longitude: Number(r.center_longitude) || centerLng,
          },
          availableWorkersCount: parseInt(r.worker_count || "0", 10),
          categories: Array.isArray(r.available_categories)
            ? r.available_categories.filter((cat: any) => cat && cat.categoryId)
            : [],
        })),
        availableTalent: talentRes.rows.map((r) => ({
          id: r.worker_profile_id,
          primarySkill: r.primary_skill,
          rating: Number(r.rating) || 4.8,
          totalRatings: parseInt(r.total_ratings || "0", 10),
          completedTasks: parseInt(r.completed_tasks || "0", 10),
          verifiedBadge: Boolean(r.verified_badge),
          phoneVerified: Boolean(r.phone_verified),
          distanceKm: Number(r.distance_km) || 1.5,
          areaName: r.area_name || "Nearby",
          isAvailableNow: Boolean(r.is_available_now),
        })),
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Failed to retrieve workforce radar: ${err.message}`,
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }
  }

  /**
   * Phase 5: Preferred Workers Management
   */
  public async getPreferredWorkers(providerUserId: string): Promise<any[]> {
    const providerId = await this.getOrCreateProviderProfile(providerUserId);

    const res = await query<any>(
      `SELECT 
        pw.id,
        pw.provider_id,
        pw.worker_id,
        pw.notes,
        pw.created_at,
        u.full_name AS worker_name,
        u.phone AS worker_phone,
        wp.average_rating,
        wp.total_ratings_count,
        wp.completed_tasks_count,
        COALESCE(
          json_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL),
          '[]'::json
        ) AS skills
       FROM preferred_workers pw
       JOIN worker_profiles wp ON wp.id = pw.worker_id
       JOIN users u ON u.id = wp.user_id
       LEFT JOIN worker_skills ws ON ws.worker_id = wp.id
       LEFT JOIN skills s ON s.id = ws.skill_id
       WHERE pw.provider_id = $1
       GROUP BY pw.id, pw.provider_id, pw.worker_id, pw.notes, pw.created_at, u.full_name, u.phone, wp.average_rating, wp.total_ratings_count, wp.completed_tasks_count
       ORDER BY pw.created_at DESC`,
      [providerId],
    );

    return res.rows.map((r) => ({
      id: r.id,
      providerId: r.provider_id,
      workerId: r.worker_id,
      workerName: r.worker_name,
      workerPhoneMasked: r.worker_phone ? r.worker_phone.slice(0, 6) + "****" : "+919876****",
      workerRating: Number(r.average_rating) || 5.0,
      totalRatingsCount: Number(r.total_ratings_count) || 0,
      completedTasksCount: Number(r.completed_tasks_count) || 0,
      skills: Array.isArray(r.skills) ? r.skills : [],
      notes: r.notes,
      createdAt: r.created_at,
    }));
  }

  public async addPreferredWorker(
    providerUserId: string,
    workerId: string,
    notes?: string,
  ): Promise<{ success: boolean; preferredId: string }> {
    const providerId = await this.getOrCreateProviderProfile(providerUserId);

    // Verify worker exists
    const wCheck = await query("SELECT id FROM worker_profiles WHERE id = $1", [workerId]);
    if (wCheck.rows.length === 0) {
      throw new AppError("Worker not found.", 404, ErrorCode.NOT_FOUND);
    }

    const res = await query<{ id: string }>(
      `INSERT INTO preferred_workers (provider_id, worker_id, notes)
       VALUES ($1, $2, $3)
       ON CONFLICT (provider_id, worker_id) DO UPDATE SET notes = EXCLUDED.notes
       RETURNING id`,
      [providerId, workerId, notes || null],
    );

    return { success: true, preferredId: res.rows[0]?.id || "pref_created" };
  }

  public async removePreferredWorker(
    providerUserId: string,
    workerId: string,
  ): Promise<{ success: boolean }> {
    const providerId = await this.getOrCreateProviderProfile(providerUserId);

    await query(
      `DELETE FROM preferred_workers
       WHERE provider_id = $1 AND worker_id = $2`,
      [providerId, workerId],
    );

    return { success: true };
  }

  /**
   * Phase 5: Provider Reliability & Reputation Metrics
   */
  public async getProviderReputation(providerIdOrUserId: string): Promise<any> {
    const res = await query<any>(
      `SELECT 
        pp.id AS provider_id,
        pp.business_name,
        pp.provider_type,
        pp.average_rating,
        pp.total_ratings_count,
        pp.posted_jobs_count,
        pp.verified_business,
        u.id AS user_id,
        u.full_name,
        u.email,
        u.phone,
        u.mobile_verified,
        u.identity_verified,
        (
          SELECT COUNT(*) FROM assignments a
          WHERE a.provider_id = pp.id AND a.status = 'COMPLETED'
        ) AS completed_jobs_count
       FROM provider_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.id::text = $1 OR pp.user_id::text = $1`,
      [providerIdOrUserId],
    );

    if (res.rows.length === 0) {
      throw new AppError("Provider profile not found.", 404, ErrorCode.NOT_FOUND);
    }

    const row = res.rows[0];
    const postedCount = Number(row.posted_jobs_count) || 0;
    const completedCount = Number(row.completed_jobs_count) || 0;
    const completionRate = postedCount > 0 ? Math.min(100, Math.round((completedCount / postedCount) * 100)) : 100;

    return {
      providerId: row.provider_id,
      userId: row.user_id,
      businessName: row.business_name || row.full_name,
      providerType: row.provider_type,
      averageRating: Number(row.average_rating) || 5.0,
      totalRatingsCount: Number(row.total_ratings_count) || 0,
      postedJobsCount: postedCount,
      completedJobsCount: completedCount,
      completionRatePercentage: completionRate,
      verification: {
        emailVerified: Boolean(row.email),
        phoneVerified: Boolean(row.mobile_verified),
        businessVerified: Boolean(row.verified_business),
        identityVerified: Boolean(row.identity_verified),
      },
    };
  }
}

export const providersService = new ProvidersService();

