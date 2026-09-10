/**
 * Availability Service
 * Manages Available-Now status toggling, time windows, radius, and trade preferences.
 * Adheres to zero continuous background GPS tracking rules.
 */

import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";
import { AvailabilityStatus } from "@nearvia/types";
import {
  WorkerAvailabilityState,
  ToggleAvailabilityPayload,
  GoOnlinePayload,
} from "./types";

/** Maximum allowed online session duration: 24 hours */
const MAX_ONLINE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Default online window: 8 hours */
const DEFAULT_ONLINE_WINDOW_MS = 8 * 60 * 60 * 1000;
/** Freshness expiration threshold without explicit update: 12 hours */
const STALE_FRESHNESS_THRESHOLD_MS = 12 * 60 * 60 * 1000;

export class AvailabilityService {
  /**
   * Set Worker status to AVAILABLE NOW (Go Online)
   * Server-authoritative, idempotent, and sets time bounds & freshness timestamps.
   */
  public async goOnline(
    userId: string,
    payload?: GoOnlinePayload,
  ): Promise<WorkerAvailabilityState> {
    // 1. Verify worker profile exists
    const workerRes = await query<{
      id: string;
      user_id: string;
      service_radius_km: string;
      is_available_now: boolean;
      availability_status: string;
    }>(
      `SELECT id, user_id, service_radius_km, is_available_now, availability_status
       FROM worker_profiles
       WHERE user_id = $1`,
      [userId],
    );

    const worker = workerRes.rows[0];
    if (!worker) {
      throw new AppError(
        "Worker profile not found. Please complete profile setup.",
        404,
        ErrorCode.NOT_FOUND,
      );
    }

    const workerId = worker.id;

    // 2. Determine time-bounded availability expiry
    let availableUntil: Date;
    const now = Date.now();

    if (payload?.availableUntil) {
      const parsed = new Date(payload.availableUntil);
      if (isNaN(parsed.getTime()) || parsed.getTime() <= now) {
        throw new AppError(
          "availableUntil must be a valid timestamp in the future.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }
      // Cap at 24 hours maximum
      const maxAllowed = new Date(now + MAX_ONLINE_WINDOW_MS);
      availableUntil = parsed > maxAllowed ? maxAllowed : parsed;
    } else if (payload?.availableHours && typeof payload.availableHours === "number") {
      const hours = Math.min(24, Math.max(0.5, payload.availableHours));
      availableUntil = new Date(now + hours * 60 * 60 * 1000);
    } else {
      availableUntil = new Date(now + DEFAULT_ONLINE_WINDOW_MS);
    }

    const radiusKm = payload?.serviceRadiusKm
      ? Math.min(15, Math.max(1, Number(payload.serviceRadiusKm)))
      : Number(worker.service_radius_km || 5.0);

    // 3. Location update: only if explicitly provided for check-in; otherwise preserve existing
    let updateSql: string;
    let updateParams: any[];

    if (payload?.latitude !== undefined || payload?.longitude !== undefined) {
      if (payload.latitude === undefined || payload.longitude === undefined) {
        throw new AppError(
          "Both latitude and longitude must be provided together.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }
      if (
        typeof payload.latitude !== "number" ||
        isNaN(payload.latitude) ||
        payload.latitude < -90 ||
        payload.latitude > 90
      ) {
        throw new AppError(
          "Latitude must be a valid number between -90 and 90 degrees.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }
      if (
        typeof payload.longitude !== "number" ||
        isNaN(payload.longitude) ||
        payload.longitude < -180 ||
        payload.longitude > 180
      ) {
        throw new AppError(
          "Longitude must be a valid number between -180 and 180 degrees.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }
    }

    if (typeof payload?.latitude === "number" && typeof payload?.longitude === "number") {
      updateSql = `
        UPDATE worker_profiles
        SET is_available_now = TRUE,
            availability_status = 'AVAILABLE_NOW',
            available_until = $1,
            service_radius_km = $2,
            location = ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
            preferred_job_types = COALESCE($5, preferred_job_types),
            preferred_categories = COALESCE($6, preferred_categories),
            preferred_skills = COALESCE($7, preferred_skills),
            availability_updated_at = NOW(),
            last_seen_at = NOW(),
            updated_at = NOW()
        WHERE id = $8
        RETURNING 
          id, user_id, is_available_now, availability_status, available_until,
          availability_updated_at, last_seen_at, service_radius_km, address_approximate,
          preferred_job_types, preferred_categories, preferred_skills, updated_at,
          ST_Y(location::geometry) AS latitude,
          ST_X(location::geometry) AS longitude
      `;
      updateParams = [
        availableUntil,
        radiusKm,
        payload.longitude,
        payload.latitude,
        payload.preferredJobTypes || null,
        payload.preferredCategories || null,
        payload.preferredSkills || null,
        workerId,
      ];
    } else {
      updateSql = `
        UPDATE worker_profiles
        SET is_available_now = TRUE,
            availability_status = 'AVAILABLE_NOW',
            available_until = $1,
            service_radius_km = $2,
            preferred_job_types = COALESCE($3, preferred_job_types),
            preferred_categories = COALESCE($4, preferred_categories),
            preferred_skills = COALESCE($5, preferred_skills),
            availability_updated_at = NOW(),
            last_seen_at = NOW(),
            updated_at = NOW()
        WHERE id = $6
        RETURNING 
          id, user_id, is_available_now, availability_status, available_until,
          availability_updated_at, last_seen_at, service_radius_km, address_approximate,
          preferred_job_types, preferred_categories, preferred_skills, updated_at,
          ST_Y(location::geometry) AS latitude,
          ST_X(location::geometry) AS longitude
      `;
      updateParams = [
        availableUntil,
        radiusKm,
        payload?.preferredJobTypes || null,
        payload?.preferredCategories || null,
        payload?.preferredSkills || null,
        workerId,
      ];
    }

    const updatedRes = await query<any>(updateSql, updateParams);
    const row = updatedRes.rows[0];

    // Log security/operational audit
    await query(
      `INSERT INTO audit_logs (
        actor_id, action, target_entity, target_id, new_values
      ) VALUES ($1, 'WORKER_WENT_ONLINE', 'WORKER_AVAILABILITY', $2, $3)`,
      [
        userId,
        workerId,
        JSON.stringify({
          isAvailableNow: true,
          availabilityStatus: AvailabilityStatus.AVAILABLE_NOW,
          availableUntil: row.available_until,
          serviceRadiusKm: row.service_radius_km,
        }),
      ],
    ).catch(() => {});

    return {
      available: true,
      status: "ONLINE",
      isAvailableNow: true,
      availabilityStatus: AvailabilityStatus.AVAILABLE_NOW,
      isFresh: true,
      availableUntil: row.available_until ? new Date(row.available_until).toISOString() : null,
      serviceRadiusKm: Number(row.service_radius_km),
      location: {
        latitude: Number(row.latitude) || 12.9716,
        longitude: Number(row.longitude) || 77.5946,
      },
      addressApproximate: row.address_approximate,
      preferredJobTypes: row.preferred_job_types || ["HOURLY", "DAILY", "TASK", "SHIFT"],
      preferredCategories: row.preferred_categories || [],
      preferredSkills: row.preferred_skills || [],
      updatedAt: row.availability_updated_at ? new Date(row.availability_updated_at).toISOString() : new Date().toISOString(),
      lastUpdated: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      workerId: row.id,
      userId: row.user_id,
    };
  }

  /**
   * Set Worker status to OFFLINE (Go Offline)
   * Server-authoritative, idempotent.
   * Crucial: Does NOT cancel active assignments or completed work.
   */
  public async goOffline(userId: string): Promise<WorkerAvailabilityState> {
    const workerRes = await query<{
      id: string;
      user_id: string;
      service_radius_km: string;
      is_available_now: boolean;
      availability_status: string;
    }>(
      `SELECT id, user_id, service_radius_km, is_available_now, availability_status
       FROM worker_profiles
       WHERE user_id = $1`,
      [userId],
    );

    const worker = workerRes.rows[0];
    if (!worker) {
      throw new AppError(
        "Worker profile not found. Please complete profile setup.",
        404,
        ErrorCode.NOT_FOUND,
      );
    }

    const workerId = worker.id;

    const updatedRes = await query<any>(
      `UPDATE worker_profiles
       SET is_available_now = FALSE,
           availability_status = 'OFFLINE',
           available_until = NULL,
           availability_updated_at = NOW(),
           last_seen_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING 
         id, user_id, is_available_now, availability_status, available_until,
         availability_updated_at, last_seen_at, service_radius_km, address_approximate,
         preferred_job_types, preferred_categories, preferred_skills, updated_at,
         ST_Y(location::geometry) AS latitude,
         ST_X(location::geometry) AS longitude`,
      [workerId],
    );

    const row = updatedRes.rows[0];

    // Log security/operational audit
    await query(
      `INSERT INTO audit_logs (
        actor_id, action, target_entity, target_id, new_values
      ) VALUES ($1, 'WORKER_WENT_OFFLINE', 'WORKER_AVAILABILITY', $2, $3)`,
      [
        userId,
        workerId,
        JSON.stringify({
          isAvailableNow: false,
          availabilityStatus: AvailabilityStatus.OFFLINE,
        }),
      ],
    ).catch(() => {});

    return {
      available: false,
      status: "OFFLINE",
      isAvailableNow: false,
      availabilityStatus: AvailabilityStatus.OFFLINE,
      isFresh: true,
      availableUntil: null,
      serviceRadiusKm: Number(row.service_radius_km) || 5.0,
      location: {
        latitude: Number(row.latitude) || 12.9716,
        longitude: Number(row.longitude) || 77.5946,
      },
      addressApproximate: row.address_approximate,
      preferredJobTypes: row.preferred_job_types || ["HOURLY", "DAILY", "TASK", "SHIFT"],
      preferredCategories: row.preferred_categories || [],
      preferredSkills: row.preferred_skills || [],
      updatedAt: row.availability_updated_at ? new Date(row.availability_updated_at).toISOString() : new Date().toISOString(),
      lastUpdated: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      workerId: row.id,
      userId: row.user_id,
    };
  }

  /**
   * Toggle Worker Availability (Go Online / Go Offline)
   * Maintained for backward-compatibility with existing clients.
   */
  public async toggleAvailability(
    userId: string,
    payload: ToggleAvailabilityPayload,
  ): Promise<WorkerAvailabilityState> {
    if (payload.isAvailableNow) {
      return this.goOnline(userId, {
        availableHours: payload.availableHours,
        availableUntil: payload.availableUntil,
        serviceRadiusKm: payload.serviceRadiusKm,
        latitude: payload.latitude,
        longitude: payload.longitude,
        preferredJobTypes: payload.preferredJobTypes,
        preferredCategories: payload.preferredCategories,
        preferredSkills: payload.preferredSkills,
      });
    } else {
      return this.goOffline(userId);
    }
  }

  /**
   * Get Current Worker Availability State with Dynamic Freshness Evaluation
   */
  public async getWorkerAvailability(userId: string): Promise<WorkerAvailabilityState> {
    const res = await query<any>(
      `SELECT 
        id, user_id, is_available_now, availability_status, available_until,
        availability_updated_at, last_seen_at, service_radius_km, address_approximate,
        preferred_job_types, preferred_categories, preferred_skills, updated_at,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude
       FROM worker_profiles
       WHERE user_id = $1`,
      [userId],
    );

    if (res.rows.length === 0) {
      throw new AppError("Worker profile not found.", 404, ErrorCode.NOT_FOUND);
    }

    const row = res.rows[0];
    const now = Date.now();

    let isAvailableNow = Boolean(row.is_available_now);
    let availabilityStatus = (row.availability_status as AvailabilityStatus) || AvailabilityStatus.OFFLINE;
    let isFresh = true;

    // Check expiration / staleness
    if (isAvailableNow) {
      const isExpired = row.available_until && new Date(row.available_until).getTime() <= now;
      const updatedAtMs = row.availability_updated_at
        ? new Date(row.availability_updated_at).getTime()
        : new Date(row.updated_at).getTime();
      const isStale = (now - updatedAtMs) > STALE_FRESHNESS_THRESHOLD_MS;

      if (isExpired || isStale) {
        // Auto-revert stale online status in database
        isAvailableNow = false;
        availabilityStatus = AvailabilityStatus.OFFLINE;
        isFresh = false;

        await query(
          `UPDATE worker_profiles
           SET is_available_now = FALSE,
               availability_status = 'OFFLINE',
               available_until = NULL,
               last_seen_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [row.id],
        ).catch(() => {});
      } else {
        // Update last_seen_at to track activity
        await query(
          `UPDATE worker_profiles SET last_seen_at = NOW() WHERE id = $1`,
          [row.id],
        ).catch(() => {});
      }
    } else {
      // Offline worker is normally fresh in its offline state
      isFresh = true;
    }

    const isAvailable = isAvailableNow && isFresh;
    const status: "ONLINE" | "OFFLINE" = isAvailable ? "ONLINE" : "OFFLINE";

    return {
      available: isAvailable,
      status,
      isAvailableNow,
      availabilityStatus,
      isFresh,
      availableUntil: isAvailable && row.available_until ? new Date(row.available_until).toISOString() : null,
      serviceRadiusKm: Number(row.service_radius_km) || 5.0,
      location: {
        latitude: Number(row.latitude) || 12.9716,
        longitude: Number(row.longitude) || 77.5946,
      },
      addressApproximate: row.address_approximate,
      preferredJobTypes: row.preferred_job_types || ["HOURLY", "DAILY", "TASK", "SHIFT"],
      preferredCategories: row.preferred_categories || [],
      preferredSkills: row.preferred_skills || [],
      updatedAt: row.availability_updated_at ? new Date(row.availability_updated_at).toISOString() : new Date(row.updated_at).toISOString(),
      lastUpdated: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      workerId: row.id,
      userId: row.user_id,
    };
  }
}

export const availabilityService = new AvailabilityService();
