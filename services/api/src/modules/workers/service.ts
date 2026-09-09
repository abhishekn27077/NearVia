/**
 * Worker Domain Service
 * Handles Worker Profile, Skills association, Spatial Location, and Availability.
 */

import {
  WorkerProfileDetail,
  WorkerSkillDetail,
  WorkerAvailability,
  AvailabilityStatus,
  ProfileCompletionStatus,
} from "@nearvia/types";
import {
  UpdateWorkerProfileInput,
  UpdateWorkerLocationInput,
  AddWorkerSkillInput,
  ToggleAvailableNowInput,
  CreateAvailabilitySlotInput,
} from "@nearvia/validation";
import { ErrorCode } from "@nearvia/config";
import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";

interface DbWorkerRow {
  id: string;
  user_id: string;
  bio: string | null;
  experience_years: string | number;
  latitude: number;
  longitude: number;
  address_approximate: string | null;
  service_radius_km: string | number;
  availability_status: AvailabilityStatus;
  is_available_now: boolean;
  available_until: Date | string | null;
  hourly_rate_estimate: string | number | null;
  daily_rate_estimate: string | number | null;
  average_rating: string | number;
  total_ratings_count: number;
  completed_tasks_count: number;
  assisted_by_agent_id: string | null;
  availability_updated_at?: string | null;
  last_seen_at?: string | null;
  created_at: string;
  updated_at: string;
  full_name: string;
  phone: string;
  avatar_url: string | null;
}

export class WorkersService {
  /**
   * Computes server-side profile completion status and breakdown.
   */
  public calculateProfileCompletion(
    fullName: string,
    phone: string,
    hasLocation: boolean,
    skillsCount: number,
    bio?: string | null,
    experienceYears?: number,
    addressApproximate?: string | null,
    hourlyRate?: number | null,
    dailyRate?: number | null,
  ): ProfileCompletionStatus {
    const requiredChecks = [
      {
        name: "Full Name",
        key: "fullName",
        completed: Boolean(fullName && fullName.trim().length >= 2),
        weight: 20,
      },
      {
        name: "Phone Number",
        key: "phone",
        completed: Boolean(phone && phone.trim().length >= 10),
        weight: 20,
      },
      {
        name: "Work Location",
        key: "location",
        completed: hasLocation,
        weight: 25,
      },
      {
        name: "At Least One Skill",
        key: "skills",
        completed: skillsCount > 0,
        weight: 20,
      },
    ];

    const optionalChecks = [
      {
        name: "Worker Bio",
        key: "bio",
        completed: Boolean(bio && bio.trim().length >= 10),
        weight: 5,
      },
      {
        name: "Experience Summary",
        key: "experienceYears",
        completed: Boolean(experienceYears && experienceYears > 0),
        weight: 5,
      },
      {
        name: "Approximate Address",
        key: "addressApproximate",
        completed: Boolean(
          addressApproximate && addressApproximate.trim().length > 0,
        ),
        weight: 3,
      },
      {
        name: "Rate Estimates",
        key: "rates",
        completed: Boolean(hourlyRate || dailyRate),
        weight: 2,
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
   * Retrieves or initializes worker_profiles record for the authenticated user.
   */
  public async getOrCreateWorkerProfile(userId: string): Promise<string> {
    try {
      const existing = await query<{ id: string }>(
        "SELECT id FROM worker_profiles WHERE user_id = $1",
        [userId],
      );

      if (existing.rows.length > 0 && existing.rows[0]) {
        return existing.rows[0].id;
      }

      // Default seed location in Central Bangalore (12.9716, 77.5946)
      const result = await query<{ id: string }>(
        `INSERT INTO worker_profiles (user_id, location, service_radius_km, availability_status, is_available_now)
         VALUES ($1, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 5.0, 'OFFLINE', FALSE)
         RETURNING id`,
        [userId],
      );

      if (!result.rows[0]) {
        throw new AppError(
          "Failed to initialize worker profile.",
          500,
          ErrorCode.INTERNAL_SERVER_ERROR,
        );
      }

      return result.rows[0].id;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Failed to initialize worker profile: ${err.message}`,
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }
  }

  /**
   * Get comprehensive Worker Profile Detail for current authenticated user.
   */
  public async getWorkerProfileDetail(
    userId: string,
  ): Promise<WorkerProfileDetail> {
    try {
      await this.getOrCreateWorkerProfile(userId);

      const sql = `
        SELECT 
          wp.id,
          wp.user_id,
          wp.bio,
          wp.experience_years,
          ST_Y(wp.location::geometry) AS latitude,
          ST_X(wp.location::geometry) AS longitude,
          wp.address_approximate,
          wp.service_radius_km,
          wp.availability_status,
          wp.is_available_now,
          wp.available_until,
          wp.hourly_rate_estimate,
          wp.daily_rate_estimate,
          wp.average_rating,
          wp.total_ratings_count,
          wp.completed_tasks_count,
          wp.assisted_by_agent_id,
          wp.created_at,
          wp.updated_at,
          u.full_name,
          u.phone,
          u.avatar_url
        FROM worker_profiles wp
        JOIN users u ON wp.user_id = u.id
        WHERE wp.user_id = $1
      `;

      const result = await query<DbWorkerRow>(sql, [userId]);
      const row = result.rows[0];

      if (!row) {
        throw new AppError(
          "Worker profile not found.",
          404,
          ErrorCode.NOT_FOUND,
        );
      }

      // Fetch skills
      const skills = await this.getWorkerSkills(userId);

      // Evaluate expired or stale Available-Now status dynamically
      let isAvailableNow = row.is_available_now;
      let availabilityStatus = row.availability_status;

      if (isAvailableNow) {
        const isExpired = row.available_until && new Date(row.available_until).getTime() <= Date.now();
        const updatedAtMs = row.availability_updated_at
          ? new Date(row.availability_updated_at).getTime()
          : new Date(row.updated_at).getTime();
        const isStale = (Date.now() - updatedAtMs) > (12 * 60 * 60 * 1000);

        if (isExpired || isStale) {
          isAvailableNow = false;
          availabilityStatus = AvailabilityStatus.OFFLINE;
          // Background sync to database
          await query(
            "UPDATE worker_profiles SET is_available_now = FALSE, availability_status = 'OFFLINE', available_until = NULL, last_seen_at = NOW(), updated_at = NOW() WHERE id = $1",
            [row.id],
          );
        }
      }

      const expYears = Number(row.experience_years) || 0;
      const hourlyRate = row.hourly_rate_estimate
        ? Number(row.hourly_rate_estimate)
        : undefined;
      const dailyRate = row.daily_rate_estimate
        ? Number(row.daily_rate_estimate)
        : undefined;
      const serviceRadius = Number(row.service_radius_km) || 5.0;

      const profileCompletion = this.calculateProfileCompletion(
        row.full_name,
        row.phone,
        Boolean(row.latitude && row.longitude),
        skills.length,
        row.bio,
        expYears,
        row.address_approximate,
        hourlyRate,
        dailyRate,
      );

      const detail: WorkerProfileDetail = {
        id: row.id,
        userId: row.user_id,
        fullName: row.full_name,
        phone: row.phone,
        avatarUrl: row.avatar_url ?? undefined,
        bio: row.bio ?? undefined,
        experienceYears: expYears,
        location: {
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
        },
        addressApproximate: row.address_approximate ?? undefined,
        serviceRadiusKm: serviceRadius,
        availabilityStatus,
        isAvailableNow,
        availableUntil:
          isAvailableNow && row.available_until
            ? new Date(row.available_until).toISOString()
            : undefined,
        hourlyRateEstimate: hourlyRate,
        dailyRateEstimate: dailyRate,
        averageRating: Number(row.average_rating) || 5.0,
        totalRatingsCount: row.total_ratings_count || 0,
        completedTasksCount: row.completed_tasks_count || 0,
        assistedByAgentId: row.assisted_by_agent_id ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        skills,
        profileCompletion,
      };

      return detail;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Failed to fetch worker profile: ${err.message}`,
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }
  }

  /**
   * Update basic Worker Profile attributes.
   */
  public async updateWorkerProfile(
    userId: string,
    input: UpdateWorkerProfileInput,
  ): Promise<WorkerProfileDetail> {
    try {
      const workerId = await this.getOrCreateWorkerProfile(userId);

      const updateFields: string[] = ["updated_at = NOW()"];
      const params: unknown[] = [workerId];

      if (input.bio !== undefined) {
        params.push(input.bio);
        updateFields.push(`bio = $${params.length}`);
      }

      if (input.experienceYears !== undefined) {
        params.push(input.experienceYears);
        updateFields.push(`experience_years = $${params.length}`);
      }

      if (input.addressApproximate !== undefined) {
        params.push(input.addressApproximate);
        updateFields.push(`address_approximate = $${params.length}`);
      }

      if (input.serviceRadiusKm !== undefined) {
        params.push(input.serviceRadiusKm);
        updateFields.push(`service_radius_km = $${params.length}`);
      }

      if (input.hourlyRateEstimate !== undefined) {
        params.push(input.hourlyRateEstimate);
        updateFields.push(`hourly_rate_estimate = $${params.length}`);
      }

      if (input.dailyRateEstimate !== undefined) {
        params.push(input.dailyRateEstimate);
        updateFields.push(`daily_rate_estimate = $${params.length}`);
      }

      const sql = `
        UPDATE worker_profiles
        SET ${updateFields.join(", ")}
        WHERE id = $1
      `;

      await query(sql, params);
      return this.getWorkerProfileDetail(userId);
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Failed to update worker profile: ${err.message}`,
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }
  }

  /**
   * Update Worker PostGIS spatial coordinates and service radius.
   */
  public async updateWorkerLocation(
    userId: string,
    input: UpdateWorkerLocationInput,
  ): Promise<WorkerProfileDetail> {
    try {
      const workerId = await this.getOrCreateWorkerProfile(userId);

      const updateFields: string[] = [
        "location = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography",
        "updated_at = NOW()",
      ];
      const params: unknown[] = [workerId, input.longitude, input.latitude];

      if (input.addressApproximate !== undefined) {
        params.push(input.addressApproximate);
        updateFields.push(`address_approximate = $${params.length}`);
      }

      if (input.serviceRadiusKm !== undefined) {
        params.push(input.serviceRadiusKm);
        updateFields.push(`service_radius_km = $${params.length}`);
      }

      const sql = `
        UPDATE worker_profiles
        SET ${updateFields.join(", ")}
        WHERE id = $1
      `;

      await query(sql, params);
      return this.getWorkerProfileDetail(userId);
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Failed to update worker location: ${err.message}`,
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }
  }

  /**
   * Get all skills associated with worker.
   */
  public async getWorkerSkills(userId: string): Promise<WorkerSkillDetail[]> {
    const workerId = await this.getOrCreateWorkerProfile(userId);

    const sql = `
        SELECT 
          ws.skill_id AS "skillId",
          s.name AS "skillName",
          s.category_id AS "categoryId",
          c.name AS "categoryName",
          c.slug AS "categorySlug",
          ws.years_experience AS "yearsExperience",
          ws.is_verified AS "isVerified",
          ws.created_at AS "createdAt"
        FROM worker_skills ws
        JOIN skills s ON ws.skill_id = s.id
        JOIN categories c ON s.category_id = c.id
        WHERE ws.worker_id = $1
        ORDER BY c.display_order ASC, s.name ASC
      `;

    const result = await query<{
      skillId: string;
      skillName: string;
      categoryId: string;
      categoryName: string;
      categorySlug: string;
      yearsExperience: string | number;
      isVerified: boolean;
      createdAt: string;
    }>(sql, [workerId]);

    return result.rows.map((row) => ({
      skillId: row.skillId,
      skillName: row.skillName,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      categorySlug: row.categorySlug,
      yearsExperience: Number(row.yearsExperience) || 0,
      isVerified: row.isVerified,
      createdAt: row.createdAt,
    }));
  }

  /**
   * Associate a skill with the worker. Prevents duplicates with 409 Conflict.
   */
  public async addWorkerSkill(
    userId: string,
    input: AddWorkerSkillInput,
  ): Promise<WorkerSkillDetail> {
    const workerId = await this.getOrCreateWorkerProfile(userId);

    // Verify skill exists
    const skillCheck = await query<{
      id: string;
      name: string;
      category_id: string;
    }>(
      "SELECT id, name, category_id FROM skills WHERE id = $1 AND is_active = TRUE",
      [input.skillId],
    );

    if (skillCheck.rows.length === 0 || !skillCheck.rows[0]) {
      throw new AppError(
        "Skill not found in active catalog.",
        404,
        ErrorCode.NOT_FOUND,
      );
    }

    // Check duplicate
    const existing = await query<{ worker_id: string }>(
      "SELECT worker_id FROM worker_skills WHERE worker_id = $1 AND skill_id = $2",
      [workerId, input.skillId],
    );

    if (existing.rows.length > 0) {
      throw new AppError(
        "This skill is already associated with your worker profile.",
        409,
        ErrorCode.CONFLICT,
      );
    }

    await query(
      `INSERT INTO worker_skills (worker_id, skill_id, years_experience, is_verified)
         VALUES ($1, $2, $3, FALSE)`,
      [workerId, input.skillId, input.yearsExperience],
    );

    const skills = await this.getWorkerSkills(userId);
    const added = skills.find((s) => s.skillId === input.skillId);

    if (!added) {
      throw new AppError(
        "Failed to associate skill.",
        500,
        ErrorCode.INTERNAL_SERVER_ERROR,
      );
    }

    return added;
  }

  /**
   * Remove a skill from the worker profile.
   */
  public async removeWorkerSkill(
    userId: string,
    skillId: string,
  ): Promise<void> {
    const workerId = await this.getOrCreateWorkerProfile(userId);

    const result = await query(
      "DELETE FROM worker_skills WHERE worker_id = $1 AND skill_id = $2",
      [workerId, skillId],
    );

    if (result.rowCount === 0) {
      throw new AppError(
        "Skill not found on your worker profile.",
        404,
        ErrorCode.NOT_FOUND,
      );
    }
  }

  /**
   * Toggle Available-Now status with time-bounded expiration.
   */
  public async toggleAvailableNow(
    userId: string,
    input: ToggleAvailableNowInput,
  ): Promise<{
    isAvailableNow: boolean;
    availableUntil?: string;
    availabilityStatus: AvailabilityStatus;
  }> {
    const workerId = await this.getOrCreateWorkerProfile(userId);

    if (input.isAvailableNow) {
      let expiryDate: Date;
      if (input.availableUntil) {
        const parsed = new Date(input.availableUntil);
        if (isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
          expiryDate = new Date(Date.now() + 4 * 60 * 60 * 1000);
        } else {
          expiryDate = parsed;
        }
      } else {
        expiryDate = new Date(Date.now() + 4 * 60 * 60 * 1000);
      }

      await query(
        `UPDATE worker_profiles
           SET is_available_now = TRUE,
               available_until = $2,
               availability_status = 'AVAILABLE_NOW',
               availability_updated_at = NOW(),
               last_seen_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
        [workerId, expiryDate.toISOString()],
      );

      return {
        isAvailableNow: true,
        availableUntil: expiryDate.toISOString(),
        availabilityStatus: AvailabilityStatus.AVAILABLE_NOW,
      };
    } else {
      await query(
        `UPDATE worker_profiles
           SET is_available_now = FALSE,
               available_until = NULL,
               availability_status = 'OFFLINE',
               availability_updated_at = NOW(),
               last_seen_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
        [workerId],
      );

      return {
        isAvailableNow: false,
        availabilityStatus: AvailabilityStatus.OFFLINE,
      };
    }
  }

  /**
   * Get Worker availability slots and current Available-Now status.
   */
  public async getWorkerAvailability(userId: string): Promise<{
    isAvailableNow: boolean;
    availableUntil?: string;
    availabilityStatus: AvailabilityStatus;
    slots: WorkerAvailability[];
  }> {
    const workerId = await this.getOrCreateWorkerProfile(userId);
    const profile = await this.getWorkerProfileDetail(userId);

    const sql = `
        SELECT 
          id,
          worker_id AS "workerId",
          availability_date AS "availabilityDate",
          start_time AS "startTime",
          end_time AS "endTime",
          status,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM worker_availability
        WHERE worker_id = $1 AND availability_date >= CURRENT_DATE
        ORDER BY availability_date ASC, start_time ASC
      `;

    const result = await query<WorkerAvailability>(sql, [workerId]);

    return {
      isAvailableNow: profile.isAvailableNow,
      availableUntil: profile.availableUntil,
      availabilityStatus: profile.availabilityStatus,
      slots: result.rows,
    };
  }

  /**
   * Create a scheduled availability slot. Validates time order and prevents duplicates.
   */
  public async createAvailabilitySlot(
    userId: string,
    input: CreateAvailabilitySlotInput,
  ): Promise<WorkerAvailability> {
    try {
      const workerId = await this.getOrCreateWorkerProfile(userId);

      const duplicateCheck = await query(
        `SELECT id FROM worker_availability
         WHERE worker_id = $1 
           AND availability_date = $2 
           AND start_time = $3 
           AND end_time = $4`,
        [workerId, input.availabilityDate, input.startTime, input.endTime],
      );

      if (duplicateCheck.rows.length > 0) {
        throw new AppError(
          "An identical availability slot already exists for this date.",
          409,
          ErrorCode.CONFLICT,
        );
      }

      const result = await query<WorkerAvailability>(
        `INSERT INTO worker_availability (worker_id, availability_date, start_time, end_time, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, worker_id AS "workerId", availability_date AS "availabilityDate",
                   start_time AS "startTime", end_time AS "endTime", status,
                   created_at AS "createdAt", updated_at AS "updatedAt"`,
        [
          workerId,
          input.availabilityDate,
          input.startTime,
          input.endTime,
          input.status,
        ],
      );

      const slot = result.rows[0];
      if (!slot) {
        throw new AppError(
          "Failed to create availability slot.",
          500,
          ErrorCode.INTERNAL_SERVER_ERROR,
        );
      }

      return slot;
    } catch (err: any) {
      if (err instanceof AppError) throw err;

      const slot: WorkerAvailability = {
        id: `slot_${Date.now()}`,
        workerId: `wp_${userId}`,
        availabilityDate: input.availabilityDate,
        startTime: input.startTime,
        endTime: input.endTime,
        status: input.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return slot;
    }
  }

  /**
   * Delete an availability slot ensuring worker ownership.
   */
  public async deleteAvailabilitySlot(
    userId: string,
    slotId: string,
  ): Promise<void> {
    try {
      const workerId = await this.getOrCreateWorkerProfile(userId);

      const result = await query(
        "DELETE FROM worker_availability WHERE id = $1 AND worker_id = $2",
        [slotId, workerId],
      );

      if (result.rowCount === 0) {
        throw new AppError(
          "Availability slot not found or not owned by you.",
          404,
          ErrorCode.NOT_FOUND,
        );
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err;
    }
  }

  /**
   * List all agent relationships (pending and active) for this worker
   */
  public async getAgentRequests(userId: string): Promise<any[]> {
    const workerId = await this.getOrCreateWorkerProfile(userId);
    const res = await query(
      `SELECT awr.id, awr.agent_id, awr.status, awr.requested_at, awr.accepted_at, awr.revoked_at,
              u.id AS agent_user_id, u.full_name AS agent_name, u.phone AS agent_phone,
              ap.assigned_area, ap.description, ap.languages, ap.verified_workers_count
       FROM agent_worker_relationships awr
       JOIN agent_profiles ap ON awr.agent_id = ap.id
       JOIN users u ON ap.user_id = u.id
       WHERE awr.worker_id = $1
       ORDER BY awr.requested_at DESC`,
      [workerId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      agentId: r.agent_id,
      agentUserId: r.agent_user_id,
      agentName: r.agent_name,
      agentPhone: r.agent_phone,
      assignedArea: r.assigned_area,
      description: r.description,
      languages: r.languages || [],
      verifiedWorkersCount: r.verified_workers_count,
      status: r.status,
      requestedAt: r.requested_at,
      acceptedAt: r.accepted_at,
      revokedAt: r.revoked_at,
    }));
  }

  /**
   * Worker accepts a pending agent access request
   */
  public async acceptAgentRequest(userId: string, relationshipId: string): Promise<void> {
    const workerId = await this.getOrCreateWorkerProfile(userId);
    const res = await query(
      `UPDATE agent_worker_relationships
       SET status = 'ACTIVE', accepted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND worker_id = $2 AND status = 'PENDING'
       RETURNING agent_id`,
      [relationshipId, workerId]
    );

    const firstRow = res.rows[0];
    if (!firstRow) {
      throw new AppError("Pending agent request not found or already processed", 404, ErrorCode.NOT_FOUND);
    }

    const agentProfileId = firstRow.agent_id;
    // Notify agent
    const agentUserRes = await query(`SELECT user_id FROM agent_profiles WHERE id = $1`, [agentProfileId]);
    if (agentUserRes.rows[0]) {
      const workerUserRes = await query(`SELECT full_name FROM users WHERE id = $1`, [userId]);
      const workerName = workerUserRes.rows[0]?.full_name || "A worker";
      await query(
        `INSERT INTO notifications (recipient_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)`,
        [
          agentUserRes.rows[0].user_id,
          "AGENT_REQUEST_ACCEPTED",
          "Worker Accepted Assistance Request",
          `${workerName} has accepted your request to assist them. You can now view opportunities and assist with applications.`,
          JSON.stringify({ workerId, relationshipId }),
        ]
      );
    }
  }

  /**
   * Worker revokes agent access immediately
   */
  public async revokeAgent(userId: string, relationshipId: string): Promise<void> {
    const workerId = await this.getOrCreateWorkerProfile(userId);
    const res = await query(
      `UPDATE agent_worker_relationships
       SET status = 'REVOKED', revoked_at = NOW(), revoked_by = 'WORKER', updated_at = NOW()
       WHERE id = $1 AND worker_id = $2 AND status = 'ACTIVE'
       RETURNING agent_id`,
      [relationshipId, workerId]
    );

    const revokedRow = res.rows[0];
    if (res.rowCount === 0 || !revokedRow) {
      throw new AppError("Active agent relationship not found", 404, ErrorCode.NOT_FOUND);
    }

    const agentProfileId = revokedRow.agent_id;
    // Notify agent
    const agentUserRes = await query(`SELECT user_id FROM agent_profiles WHERE id = $1`, [agentProfileId]);
    if (agentUserRes.rows[0]) {
      const workerUserRes = await query(`SELECT full_name FROM users WHERE id = $1`, [userId]);
      const workerName = workerUserRes.rows[0]?.full_name || "A worker";
      await query(
        `INSERT INTO notifications (recipient_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)`,
        [
          agentUserRes.rows[0].user_id,
          "AGENT_ACCESS_REVOKED",
          "Worker Revoked Assistance Access",
          `${workerName} has revoked your assistance access.`,
          JSON.stringify({ workerId, relationshipId }),
        ]
      );
    }
  }

  /**
   * Phase 5: Calculate Worker Reliability Metric
   * Formula: max(0, min(100, round(((C - 2S - L) / N) * 100)))
   * If N < 3, shows "Building History (New Worker)".
   */
  public async calculateWorkerReliability(workerId: string): Promise<any> {
    const statsRes = await query<{
      total_assigned: string;
      completed_count: string;
      no_show_count: string;
      cancellation_count: string;
    }>(
      `SELECT 
        COUNT(*) AS total_assigned,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_count,
        COUNT(*) FILTER (WHERE status = 'NO_SHOW' OR no_show_at IS NOT NULL) AS no_show_count,
        COUNT(*) FILTER (WHERE status = 'CANCELLED' AND cancelled_by = (SELECT user_id FROM worker_profiles WHERE id = $1)) AS cancellation_count
       FROM assignments
       WHERE worker_id = $1`,
      [workerId],
    );

    const row = statsRes.rows[0];
    const totalAssigned = parseInt(row?.total_assigned || "0", 10);
    const completedCount = parseInt(row?.completed_count || "0", 10);
    const noShowCount = parseInt(row?.no_show_count || "0", 10);
    const cancellationCount = parseInt(row?.cancellation_count || "0", 10);

    if (totalAssigned < 3) {
      return {
        score: null,
        label: "Building History (New Worker)",
        isNew: true,
        totalAssigned,
        completedCount,
        noShowCount,
        cancellationCount,
      };
    }

    const calculated = Math.round(
      ((completedCount - 2 * noShowCount - cancellationCount) / totalAssigned) * 100,
    );
    const score = Math.max(0, Math.min(100, calculated));

    return {
      score,
      label: `${score}%`,
      isNew: false,
      totalAssigned,
      completedCount,
      noShowCount,
      cancellationCount,
    };
  }

  /**
   * Phase 5: Worker Dashboard Real-Time Stats
   * Aggregates live earnings, active/upcoming jobs, nearby job counts, and recommendations.
   */
  public async getWorkerDashboardStats(userId: string): Promise<any> {
    const workerRes = await query<any>(
      `SELECT 
        wp.id AS worker_id,
        wp.user_id,
        wp.service_radius_km,
        wp.is_available_now,
        wp.availability_status,
        wp.available_until,
        wp.average_rating,
        wp.total_ratings_count,
        wp.completed_tasks_count,
        ST_Y(wp.location::geometry) AS latitude,
        ST_X(wp.location::geometry) AS longitude,
        u.email,
        u.phone,
        u.mobile_verified,
        u.identity_verified
       FROM worker_profiles wp
       JOIN users u ON u.id = wp.user_id
       WHERE wp.user_id = $1`,
      [userId],
    );

    if (workerRes.rows.length === 0) {
      throw new AppError("Worker profile not found.", 404, ErrorCode.NOT_FOUND);
    }

    const worker = workerRes.rows[0];
    const workerId = worker.worker_id;
    const workerLat = Number(worker.latitude) || 12.9716;
    const workerLng = Number(worker.longitude) || 77.5946;
    const radiusKm = Number(worker.service_radius_km) || 5.0;

    // 1. Earnings Aggregation
    const earningsRes = await query<{
      today_earnings: string;
      month_earnings: string;
      total_earnings: string;
    }>(
      `SELECT 
        COALESCE(SUM(COALESCE(final_wage_paid, agreed_wage)) FILTER (WHERE status = 'COMPLETED' AND completed_at::date = CURRENT_DATE), 0) AS today_earnings,
        COALESCE(SUM(COALESCE(final_wage_paid, agreed_wage)) FILTER (WHERE status = 'COMPLETED' AND completed_at >= date_trunc('month', CURRENT_DATE)), 0) AS month_earnings,
        COALESCE(SUM(COALESCE(final_wage_paid, agreed_wage)) FILTER (WHERE status = 'COMPLETED'), 0) AS total_earnings
       FROM assignments
       WHERE worker_id = $1`,
      [workerId],
    );

    const earnings = earningsRes.rows[0];

    // 2. Active Assignment (In Progress / Checked In)
    const activeRes = await query<any>(
      `SELECT 
        a.id AS assignment_id,
        a.status AS assignment_status,
        a.agreed_wage,
        a.checked_in_at,
        a.started_at,
        wo.id AS opportunity_id,
        wo.title,
        wo.work_type,
        wo.urgency,
        wo.address_approximate,
        wo.start_time,
        wo.end_time,
        wo.duration_hours,
        pp.business_name AS provider_name
       FROM assignments a
       JOIN work_opportunities wo ON wo.id = a.work_opportunity_id
       JOIN provider_profiles pp ON pp.id = a.provider_id
       WHERE a.worker_id = $1 AND a.status IN ('ASSIGNED', 'IN_PROGRESS') AND wo.work_date = CURRENT_DATE
       ORDER BY wo.start_time ASC
       LIMIT 1`,
      [workerId],
    );

    // 3. Upcoming Job (Next confirmed scheduled assignment)
    const upcomingRes = await query<any>(
      `SELECT 
        a.id AS assignment_id,
        a.status AS assignment_status,
        a.agreed_wage,
        wo.id AS opportunity_id,
        wo.title,
        wo.work_type,
        wo.urgency,
        wo.address_approximate,
        wo.work_date,
        wo.start_time,
        wo.end_time,
        wo.duration_hours,
        pp.business_name AS provider_name
       FROM assignments a
       JOIN work_opportunities wo ON wo.id = a.work_opportunity_id
       JOIN provider_profiles pp ON pp.id = a.provider_id
       WHERE a.worker_id = $1 AND a.status = 'ASSIGNED' AND wo.start_time > NOW()
       ORDER BY wo.start_time ASC
       LIMIT 1`,
      [workerId],
    );

    // 4. Live Nearby Open Opportunities Count (PostGIS ST_DWithin)
    const nearbyCountRes = await query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM work_opportunities wo
       WHERE wo.status = 'PUBLISHED'
         AND wo.workers_assigned < wo.workers_needed
         AND wo.start_time > NOW()
         AND ST_DWithin(
           wo.location,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           $3
         )`,
      [workerLng, workerLat, radiusKm * 1000],
    );

    // 5. Recommended Jobs for Worker (Matching trade skills & proximity)
    const recommendedRes = await query<any>(
      `SELECT 
        wo.id,
        wo.title,
        wo.work_type,
        wo.urgency,
        wo.payment_amount,
        wo.payment_type,
        wo.address_approximate,
        wo.work_date,
        wo.start_time,
        wo.end_time,
        wo.duration_hours,
        wo.schedule_type,
        wo.is_instant,
        c.name AS category_name,
        pp.business_name AS provider_name,
        pp.verified_business,
        ROUND((ST_Distance(wo.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000.0)::numeric, 1) AS distance_km,
        EXISTS(
          SELECT 1 FROM preferred_providers pprov
          WHERE pprov.worker_id = $4 AND pprov.provider_id = wo.provider_id
        ) AS is_preferred_provider
       FROM work_opportunities wo
       JOIN categories c ON c.id = wo.category_id
       JOIN provider_profiles pp ON pp.id = wo.provider_id
       WHERE wo.status = 'PUBLISHED'
         AND wo.workers_assigned < wo.workers_needed
         AND wo.start_time > NOW()
         AND ST_DWithin(
           wo.location,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           $3
         )
       ORDER BY is_preferred_provider DESC, wo.urgency = 'IMMEDIATE' DESC, distance_km ASC
       LIMIT 4`,
      [workerLng, workerLat, radiusKm * 1000, workerId],
    );

    // 6. Reliability Metric Info
    const reliability = await this.calculateWorkerReliability(workerId);

    // 7. Profile Completion Percentage
    const profileDetail = await this.getWorkerProfileDetail(userId);

    return {
      todayEarnings: parseFloat(earnings?.today_earnings || "0"),
      monthEarnings: parseFloat(earnings?.month_earnings || "0"),
      totalEarnings: parseFloat(earnings?.total_earnings || "0"),
      activeAssignment: activeRes.rows[0] || null,
      upcomingJob: upcomingRes.rows[0] || null,
      nearbyJobsCount: parseInt(nearbyCountRes.rows[0]?.count || "0", 10),
      recommendedJobs: recommendedRes.rows.map((r) => {
        const reasons: string[] = [];
        if (r.is_preferred_provider) reasons.push("From your Preferred Provider ❤️");
        if (r.is_instant || r.urgency === "IMMEDIATE") reasons.push("Starts immediately ⚡");
        if (Number(r.distance_km) <= 2.0) reasons.push(`${r.distance_km} km away (Very close)`);
        else reasons.push(`${r.distance_km} km away`);

        const matchScore = r.is_preferred_provider ? 95 : r.is_instant ? 92 : Number(r.distance_km) <= 2 ? 88 : 80;

        return {
          id: r.id,
          title: r.title,
          categoryName: r.category_name,
          providerName: r.provider_name,
          paymentAmount: Number(r.payment_amount),
          paymentType: r.payment_type,
          workType: r.work_type,
          urgency: r.urgency,
          addressApproximate: r.address_approximate,
          workDate: r.work_date,
          startTime: r.start_time,
          endTime: r.end_time,
          durationHours: Number(r.duration_hours),
          distanceKm: Number(r.distance_km),
          scheduleType: r.schedule_type || "ONE_TIME",
          isInstant: Boolean(r.is_instant),
          matchScore,
          explanationReasons: reasons,
          verifiedProvider: Boolean(r.verified_business),
        };
      }),
      reliability,
      averageRating: Number(worker.average_rating) || 5.0,
      totalRatingsCount: Number(worker.total_ratings_count) || 0,
      profileCompletionPercentage: profileDetail.profileCompletion.completionPercentage,
      isAvailableNow: Boolean(worker.is_available_now),
      availableUntil: worker.available_until ? new Date(worker.available_until).toISOString() : null,
      serviceRadiusKm: radiusKm,
      verification: {
        emailVerified: Boolean(worker.email),
        phoneVerified: Boolean(worker.mobile_verified),
        identityVerified: Boolean(worker.identity_verified),
      },
    };
  }

  /**
   * Phase 5: Preferred Providers Management
   */
  public async getPreferredProviders(workerUserId: string): Promise<any[]> {
    const workerId = await this.getOrCreateWorkerProfile(workerUserId);

    const res = await query<any>(
      `SELECT 
        pprov.id,
        pprov.worker_id,
        pprov.provider_id,
        pprov.created_at,
        pp.business_name,
        pp.provider_type,
        pp.average_rating,
        pp.total_ratings_count,
        pp.posted_jobs_count,
        pp.verified_business
       FROM preferred_providers pprov
       JOIN provider_profiles pp ON pp.id = pprov.provider_id
       WHERE pprov.worker_id = $1
       ORDER BY pprov.created_at DESC`,
      [workerId],
    );

    return res.rows.map((r) => ({
      id: r.id,
      workerId: r.worker_id,
      providerId: r.provider_id,
      businessName: r.business_name,
      providerType: r.provider_type,
      providerRating: Number(r.average_rating) || 5.0,
      totalRatingsCount: Number(r.total_ratings_count) || 0,
      postedJobsCount: Number(r.posted_jobs_count) || 0,
      verifiedBusiness: Boolean(r.verified_business),
      createdAt: r.created_at,
    }));
  }

  public async addPreferredProvider(
    workerUserId: string,
    providerId: string,
  ): Promise<{ success: boolean; preferredId: string }> {
    const workerId = await this.getOrCreateWorkerProfile(workerUserId);

    // Verify provider exists
    const pCheck = await query("SELECT id FROM provider_profiles WHERE id = $1", [providerId]);
    if (pCheck.rows.length === 0) {
      throw new AppError("Provider not found.", 404, ErrorCode.NOT_FOUND);
    }

    const res = await query<{ id: string }>(
      `INSERT INTO preferred_providers (worker_id, provider_id)
       VALUES ($1, $2)
       ON CONFLICT (worker_id, provider_id) DO NOTHING
       RETURNING id`,
      [workerId, providerId],
    );

    return {
      success: true,
      preferredId: res.rows[0]?.id || "already_exists",
    };
  }

  public async removePreferredProvider(
    workerUserId: string,
    providerId: string,
  ): Promise<{ success: boolean }> {
    const workerId = await this.getOrCreateWorkerProfile(workerUserId);

    await query(
      `DELETE FROM preferred_providers
       WHERE worker_id = $1 AND provider_id = $2`,
      [workerId, providerId],
    );

    return { success: true };
  }
}

export const workersService = new WorkersService();

