/**
 * Availability Service
 * Manages Available-Now status toggling, time windows, radius, and trade preferences.
 * Adheres to zero continuous background GPS tracking rules.
 */

import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";
import { AvailabilityStatus } from "@nearvia/types";
import { WorkerAvailabilityState, ToggleAvailabilityPayload } from "./types";

export class AvailabilityService {
  /**
   * Toggle Worker Availability (Go Online / Go Offline)
   */
  public async toggleAvailability(
    userId: string,
    payload: ToggleAvailabilityPayload,
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

    const firstWorker = workerRes.rows[0];
    if (!firstWorker) {
      throw new AppError(
        "Worker profile not found. Please complete profile setup.",
        404,
        ErrorCode.NOT_FOUND,
      );
    }

    const workerId = firstWorker.id;
    const isOnline = Boolean(payload.isAvailableNow);
    const newStatus: AvailabilityStatus = isOnline ? AvailabilityStatus.AVAILABLE_NOW : AvailabilityStatus.OFFLINE;

    // Default time window: 8 hours from now if going online and not specified
    let availableUntil: Date | null = null;
    if (isOnline) {
      if (payload.availableUntil) {
        availableUntil = new Date(payload.availableUntil);
      } else {
        availableUntil = new Date(Date.now() + 8 * 60 * 60 * 1000); // +8 hrs
      }
    }

    const radiusKm = payload.serviceRadiusKm ? Math.min(15, Math.max(1, Number(payload.serviceRadiusKm))) : Number(firstWorker.service_radius_km || 5.0);

    // If location is provided, update spatial point; otherwise preserve existing
    let updateSql: string;
    let updateParams: any[];

    if (typeof payload.latitude === "number" && typeof payload.longitude === "number") {
      updateSql = `
        UPDATE worker_profiles
        SET is_available_now = $1,
            availability_status = $2,
            available_until = $3,
            service_radius_km = $4,
            location = ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
            preferred_job_types = COALESCE($7, preferred_job_types),
            preferred_categories = COALESCE($8, preferred_categories),
            preferred_skills = COALESCE($9, preferred_skills),
            updated_at = NOW()
        WHERE id = $10
        RETURNING 
          id, user_id, is_available_now, availability_status, available_until,
          service_radius_km, address_approximate, preferred_job_types,
          preferred_categories, preferred_skills, updated_at,
          ST_Y(location::geometry) AS latitude,
          ST_X(location::geometry) AS longitude
      `;
      updateParams = [
        isOnline,
        newStatus,
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
        SET is_available_now = $1,
            availability_status = $2,
            available_until = $3,
            service_radius_km = $4,
            preferred_job_types = COALESCE($5, preferred_job_types),
            preferred_categories = COALESCE($6, preferred_categories),
            preferred_skills = COALESCE($7, preferred_skills),
            updated_at = NOW()
        WHERE id = $8
        RETURNING 
          id, user_id, is_available_now, availability_status, available_until,
          service_radius_km, address_approximate, preferred_job_types,
          preferred_categories, preferred_skills, updated_at,
          ST_Y(location::geometry) AS latitude,
          ST_X(location::geometry) AS longitude
      `;
      updateParams = [
        isOnline,
        newStatus,
        availableUntil,
        radiusKm,
        payload.preferredJobTypes || null,
        payload.preferredCategories || null,
        payload.preferredSkills || null,
        workerId,
      ];
    }

    const updatedRes = await query<any>(updateSql, updateParams);
    const row = updatedRes.rows[0];

    // Log security audit for availability transition
    await query(
      `INSERT INTO audit_logs (
        actor_id, action, target_entity, target_id, new_values
      ) VALUES ($1, $2, 'WORKER_AVAILABILITY', $3, $4)`,
      [
        userId,
        isOnline ? "WORKER_WENT_ONLINE" : "WORKER_WENT_OFFLINE",
        workerId,
        JSON.stringify({
          isAvailableNow: row.is_available_now,
          availableUntil: row.available_until,
          serviceRadiusKm: row.service_radius_km,
        }),
      ],
    ).catch(() => {});

    return {
      workerId: row.id,
      userId: row.user_id,
      isAvailableNow: Boolean(row.is_available_now),
      availabilityStatus: row.availability_status as AvailabilityStatus,
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
      lastUpdated: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Get Current Worker Availability State
   */
  public async getWorkerAvailability(userId: string): Promise<WorkerAvailabilityState> {
    const res = await query<any>(
      `SELECT 
        id, user_id, is_available_now, availability_status, available_until,
        service_radius_km, address_approximate, preferred_job_types,
        preferred_categories, preferred_skills, updated_at,
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
    return {
      workerId: row.id,
      userId: row.user_id,
      isAvailableNow: Boolean(row.is_available_now),
      availabilityStatus: row.availability_status as AvailabilityStatus,
      availableUntil: row.available_until ? new Date(row.available_until).toISOString() : null,
      serviceRadiusKm: Number(row.service_radius_km) || 5.0,
      location: {
        latitude: Number(row.latitude) || 12.9716,
        longitude: Number(row.longitude) || 77.5946,
      },
      addressApproximate: row.address_approximate,
      preferredJobTypes: row.preferred_job_types || ["HOURLY", "DAILY", "TASK", "SHIFT"],
      preferredCategories: row.preferred_categories || [],
      preferredSkills: row.preferred_skills || [],
      lastUpdated: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }
}

export const availabilityService = new AvailabilityService();
