/**
 * Assignments Domain Service (Phase 10)
 * Manages full assignment execution lifecycle:
 * ASSIGNED -> CONFIRMED -> CHECKED_IN -> IN_PROGRESS -> COMPLETED
 * Exceptional transitions: NO_SHOW, CANCELLED.
 * Enforces transaction safety, check-in time windows, GPS proximity with manual fallback,
 * provider verification, and worker availability integration.
 */

import {
  AssignmentDetail,
  AssignmentStatus,
  WorkType,
  UrgencyLevel,
  PaymentStatus,
  UserRole,
  CheckInInput,
  StartWorkInput,
  CompleteWorkInput,
  ConfirmCompletionInput,
  CancelAssignmentInput,
  NoShowInput,
  VerifyPinInput,
  CheckOutInput,
  UploadJobEvidenceInput,
  JobEvidence,
  SharedActiveJobInfo,
} from "@nearvia/types";
import { query, withTransaction } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode, NEARVIA_CONFIG } from "@nearvia/config";
import { notificationsService } from "../notifications/service";
import { trackPlatformEvent } from "../../utils/events";

interface AssignmentDbRow {
  id: string;
  work_opportunity_id: string;
  worker_id: string;
  provider_id: string;
  worker_user_id: string;
  provider_user_id: string;
  application_id: string | null;
  status: string;
  assigned_at: string;
  confirmed_at: string | null;
  checked_in_at: string | null;
  started_at: string | null;
  checked_out_at: string | null;
  worked_minutes: number | null;
  completed_at: string | null;
  cancelled_at: string | null;
  no_show_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  completion_notes: string | null;
  check_in_distance_meters: number | null;
  check_out_distance_meters: number | null;
  job_pin: string | null;
  job_pin_attempts: number;
  job_pin_verified_at: string | null;
  agreed_wage: number;
  final_wage_paid: number | null;
  payment_status: string;
  created_at: string;
  updated_at: string;
  title: string;
  description: string;
  work_type: string;
  urgency: string;
  work_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  address_approximate: string;
  instructions: string | null;
  responsibilities: string | null;
  provider_full_name: string;
  provider_business_name: string | null;
  provider_contact_phone: string;
  worker_full_name: string;
  worker_avatar_url: string | null;
  worker_contact_phone: string | null;
  opportunity_latitude?: number | null;
  opportunity_longitude?: number | null;
}

export class AssignmentsService {
  /**
   * Helper to map DB row to AssignmentDetail
   */
  private mapRowToDetail(r: AssignmentDbRow, requestingUserId?: string): AssignmentDetail {
    return {
      id: r.id,
      workOpportunityId: r.work_opportunity_id,
      workerId: r.worker_id,
      providerId: r.provider_id,
      applicationId: r.application_id || undefined,
      status: r.status as AssignmentStatus,
      assignedAt: r.assigned_at,
      confirmedAt: r.confirmed_at || undefined,
      checkedInAt: r.checked_in_at || undefined,
      startedAt: r.started_at || undefined,
      checkedOutAt: r.checked_out_at || undefined,
      workedMinutes: r.worked_minutes != null ? Number(r.worked_minutes) : undefined,
      completedAt: r.completed_at || undefined,
      cancelledAt: r.cancelled_at || undefined,
      noShowAt: r.no_show_at || undefined,
      cancelledBy: r.cancelled_by || undefined,
      cancellationReason: r.cancellation_reason || undefined,
      completionNotes: r.completion_notes || undefined,
      checkInDistanceMeters:
        r.check_in_distance_meters != null
          ? Number(r.check_in_distance_meters)
          : undefined,
      checkOutDistanceMeters:
        r.check_out_distance_meters != null
          ? Number(r.check_out_distance_meters)
          : undefined,
      // Reveal PIN to provider, or to worker only after verification
      jobPin:
        requestingUserId === r.provider_user_id || r.job_pin_verified_at != null
          ? r.job_pin || undefined
          : undefined,
      jobPinAttempts: r.job_pin_attempts != null ? Number(r.job_pin_attempts) : 0,
      jobPinVerifiedAt: r.job_pin_verified_at || undefined,
      agreedWage: Number(r.agreed_wage),
      finalWagePaid: r.final_wage_paid ? Number(r.final_wage_paid) : undefined,
      paymentStatus: r.payment_status as PaymentStatus,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      opportunityTitle: r.title,
      opportunityDescription: r.description,
      workType: r.work_type as WorkType,
      urgency: r.urgency as UrgencyLevel,
      workDate: r.work_date,
      startTime: r.start_time,
      endTime: r.end_time,
      durationHours: Number(r.duration_hours),
      addressApproximate: r.address_approximate,
      instructions: r.instructions || undefined,
      responsibilities: r.responsibilities || undefined,
      providerFullName: r.provider_full_name,
      providerBusinessName: r.provider_business_name || undefined,
      providerContactPhone: r.provider_contact_phone || "",
      workerFullName: r.worker_full_name,
      workerAvatarUrl: r.worker_avatar_url || undefined,
      workerContactPhone: r.worker_contact_phone || undefined,
      opportunityLatitude:
        r.opportunity_latitude != null
          ? Number(r.opportunity_latitude)
          : undefined,
      opportunityLongitude:
        r.opportunity_longitude != null
          ? Number(r.opportunity_longitude)
          : undefined,
    };
  }

  /**
   * Helper to fetch full assignment detail by ID with locking or standard select
   */
  private async fetchAssignmentRow(
    assignmentId: string,
    clientQuery?: typeof query,
  ): Promise<AssignmentDbRow | null> {
    const q = clientQuery || query;
    const res = await q<AssignmentDbRow>(
      `SELECT 
        asn.id,
        asn.work_opportunity_id,
        asn.worker_id,
        asn.provider_id,
        wp.user_id AS worker_user_id,
        pp.user_id AS provider_user_id,
        asn.application_id,
        asn.status,
        asn.assigned_at,
        asn.confirmed_at,
        asn.checked_in_at,
        asn.started_at,
        asn.checked_out_at,
        asn.worked_minutes,
        asn.completed_at,
        asn.cancelled_at,
        asn.no_show_at,
        asn.cancelled_by,
        asn.cancellation_reason,
        asn.completion_notes,
        asn.check_in_distance_meters,
        asn.check_out_distance_meters,
        asn.job_pin,
        asn.job_pin_attempts,
        asn.job_pin_verified_at,
        asn.agreed_wage,
        asn.final_wage_paid,
        asn.payment_status,
        asn.created_at,
        asn.updated_at,
        wo.title,
        wo.description,
        wo.work_type,
        wo.urgency,
        wo.work_date,
        wo.start_time,
        wo.end_time,
        wo.duration_hours,
        wo.address_approximate,
        wo.instructions,
        wo.responsibilities,
        ST_Y(wo.location::geometry) AS opportunity_latitude,
        ST_X(wo.location::geometry) AS opportunity_longitude,
        up.full_name AS provider_full_name,
        pp.business_name AS provider_business_name,
        pp.contact_phone AS provider_contact_phone,
        uw.full_name AS worker_full_name,
        uw.avatar_url AS worker_avatar_url,
        uw.phone AS worker_contact_phone
       FROM assignments asn
       JOIN work_opportunities wo ON asn.work_opportunity_id = wo.id
       JOIN worker_profiles wp ON asn.worker_id = wp.id
       JOIN users uw ON wp.user_id = uw.id
       JOIN provider_profiles pp ON asn.provider_id = pp.id
       JOIN users up ON pp.user_id = up.id
       WHERE asn.id = $1`,
      [assignmentId],
    );

    return res.rows[0] || null;
  }

  /**
   * Geodesic Haversine Distance helper for offline/fallback proximity check
   */
  private calculateHaversineDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Validates if current time falls within allowable check-in window
   */
  private validateCheckInTimeWindow(
    workDateStr: string,
    startTimeStr: string,
    durationHours: number,
  ): boolean {
    const scheduledDateTime = new Date(`${workDateStr}T${startTimeStr}:00`);
    if (isNaN(scheduledDateTime.getTime())) {
      return true; // Fallback if invalid date string
    }

    const now = Date.now();
    const windowStart =
      scheduledDateTime.getTime() -
      NEARVIA_CONFIG.WORK_EXECUTION.CHECK_IN_WINDOW_BEFORE_MINUTES * 60 * 1000;
    const windowEnd =
      scheduledDateTime.getTime() +
      (durationHours * 60 +
        NEARVIA_CONFIG.WORK_EXECUTION.CHECK_IN_WINDOW_AFTER_MINUTES) *
        60 *
        1000;

    return now >= windowStart && now <= windowEnd;
  }

  /**
   * Retrieves all assignments for the authenticated user (worker or provider).
   */
  async getMyAssignments(
    userId: string,
    role: UserRole,
  ): Promise<AssignmentDetail[]> {
    let whereClause = "";
    const params = [userId];

    if (role === UserRole.WORKER) {
      whereClause = "wp.user_id = $1";
    } else if (role === UserRole.PROVIDER) {
      whereClause = "pp.user_id = $1";
    } else {
      whereClause = "1 = 1";
      params.pop();
    }

    const res = await query<AssignmentDbRow>(
      `SELECT 
        asn.id,
        asn.work_opportunity_id,
        asn.worker_id,
        asn.provider_id,
        wp.user_id AS worker_user_id,
        pp.user_id AS provider_user_id,
        asn.application_id,
        asn.status,
        asn.assigned_at,
        asn.confirmed_at,
        asn.checked_in_at,
        asn.started_at,
        asn.checked_out_at,
        asn.worked_minutes,
        asn.completed_at,
        asn.cancelled_at,
        asn.no_show_at,
        asn.cancelled_by,
        asn.cancellation_reason,
        asn.completion_notes,
        asn.check_in_distance_meters,
        asn.job_pin,
        asn.job_pin_attempts,
        asn.job_pin_verified_at,
        asn.agreed_wage,
        asn.final_wage_paid,
        asn.payment_status,
        asn.created_at,
        asn.updated_at,
        wo.title,
        wo.description,
        wo.work_type,
        wo.urgency,
        wo.work_date,
        wo.start_time,
        wo.end_time,
        wo.duration_hours,
        wo.address_approximate,
        wo.instructions,
        wo.responsibilities,
        ST_Y(wo.location::geometry) AS opportunity_latitude,
        ST_X(wo.location::geometry) AS opportunity_longitude,
        up.full_name AS provider_full_name,
        pp.business_name AS provider_business_name,
        pp.contact_phone AS provider_contact_phone,
        uw.full_name AS worker_full_name,
        uw.avatar_url AS worker_avatar_url,
        uw.phone AS worker_contact_phone
       FROM assignments asn
       JOIN work_opportunities wo ON asn.work_opportunity_id = wo.id
       JOIN worker_profiles wp ON asn.worker_id = wp.id
       JOIN users uw ON wp.user_id = uw.id
       JOIN provider_profiles pp ON asn.provider_id = pp.id
       JOIN users up ON pp.user_id = up.id
       WHERE ${whereClause}
       ORDER BY wo.work_date DESC, wo.start_time DESC`,
      params,
    );

    return res.rows.map((r) => this.mapRowToDetail(r, userId));
  }

  /**
   * Retrieves single assignment by ID with authorization check.
   */
  async getAssignmentById(
    userId: string,
    assignmentId: string,
  ): Promise<AssignmentDetail> {
    const row = await this.fetchAssignmentRow(assignmentId);
    if (!row) {
      throw new AppError(
        "Assignment not found.",
        404,
        ErrorCode.ASSIGNMENT_NOT_FOUND,
      );
    }

    if (userId !== row.worker_user_id && userId !== row.provider_user_id) {
      throw new AppError(
        "You are not authorized to view this assignment.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    return this.mapRowToDetail(row, userId);
  }

  /**
   * Worker confirms assignment (ASSIGNED -> CONFIRMED)
   */
  async confirmAssignment(
    workerUserId: string,
    assignmentId: string,
  ): Promise<AssignmentDetail> {
    return withTransaction(async (client) => {
      const row = await this.fetchAssignmentRow(
        assignmentId,
        client.query.bind(client),
      );
      if (!row) {
        throw new AppError(
          "Assignment not found.",
          404,
          ErrorCode.ASSIGNMENT_NOT_FOUND,
        );
      }

      if (row.worker_user_id !== workerUserId) {
        throw new AppError(
          "Only the assigned worker can confirm this work assignment.",
          403,
          ErrorCode.NOT_AUTHORIZED_FOR_ACTION,
        );
      }

      if (row.status !== AssignmentStatus.ASSIGNED) {
        throw new AppError(
          `Cannot confirm assignment with status '${row.status}'. Must be '${AssignmentStatus.ASSIGNED}'.`,
          400,
          ErrorCode.ASSIGNMENT_INVALID_STATE,
        );
      }

      await client.query(
        `UPDATE assignments 
         SET status = 'CONFIRMED', 
             confirmed_at = NOW(), 
             updated_at = NOW() 
         WHERE id = $1`,
        [assignmentId],
      );

      const updated = await this.fetchAssignmentRow(
        assignmentId,
        client.query.bind(client),
      );
      if (!updated) {
        throw new AppError(
          "Failed to update assignment.",
          500,
          ErrorCode.DATABASE_ERROR,
        );
      }

      await trackPlatformEvent({
        eventType: "ASSIGNMENT_CONFIRMED",
        entityType: "assignment",
        entityId: assignmentId,
        userId: workerUserId,
        details: {
          workOpportunityId: row.work_opportunity_id,
          status: AssignmentStatus.CONFIRMED,
        },
      });

      notificationsService
        .createNotification(
          row.provider_user_id,
          "WORKER_CONFIRMED",
          "Shift Confirmed by Worker",
          `The assigned worker confirmed they will attend '${row.title}'.`,
          { assignmentId, workOpportunityId: row.work_opportunity_id },
        )
        .catch(() => {});

      return this.mapRowToDetail(updated);
    });
  }

  /**
   * Worker checks in (CONFIRMED -> CHECKED_IN)
   */
  async checkIn(
    workerUserId: string,
    assignmentId: string,
    input: CheckInInput,
  ): Promise<AssignmentDetail> {
    return withTransaction(async (client) => {
      const row = await this.fetchAssignmentRow(
        assignmentId,
        client.query.bind(client),
      );
      if (!row) {
        throw new AppError(
          "Assignment not found.",
          404,
          ErrorCode.ASSIGNMENT_NOT_FOUND,
        );
      }

      if (row.worker_user_id !== workerUserId) {
        throw new AppError(
          "Only the assigned worker can check in for this assignment.",
          403,
          ErrorCode.NOT_AUTHORIZED_FOR_ACTION,
        );
      }

      if (
        row.status === AssignmentStatus.CHECKED_IN ||
        row.status === AssignmentStatus.IN_PROGRESS
      ) {
        throw new AppError(
          "Worker has already checked in for this assignment.",
          400,
          ErrorCode.ALREADY_CHECKED_IN,
        );
      }

      if (row.status !== AssignmentStatus.CONFIRMED) {
        throw new AppError(
          `Cannot check in to assignment with status '${row.status}'. Please confirm the assignment first.`,
          400,
          ErrorCode.ASSIGNMENT_INVALID_STATE,
        );
      }

      // 1. Job PIN Validation (if provided at check-in)
      let pinVerified = false;
      if (input.jobPin) {
        if (
          (row.job_pin_attempts || 0) >=
          NEARVIA_CONFIG.WORK_EXECUTION.MAX_JOB_PIN_ATTEMPTS
        ) {
          throw new AppError(
            `Maximum PIN verification attempts exceeded (${NEARVIA_CONFIG.WORK_EXECUTION.MAX_JOB_PIN_ATTEMPTS}/${NEARVIA_CONFIG.WORK_EXECUTION.MAX_JOB_PIN_ATTEMPTS}). Please request provider on-site assistance.`,
            429,
            ErrorCode.JOB_PIN_MAX_ATTEMPTS_EXCEEDED,
          );
        }

        const inputPin = String(input.jobPin).trim();
        const expectedPin = String(row.job_pin || "").trim();

        if (!inputPin || inputPin !== expectedPin) {
          const newAttempts = (row.job_pin_attempts || 0) + 1;
          await query(
            `UPDATE assignments
             SET job_pin_attempts = $2,
                 updated_at = NOW()
             WHERE id = $1`,
            [assignmentId, newAttempts],
          );

          await trackPlatformEvent({
            eventType: "JOB_PIN_FAILED",
            entityType: "assignment",
            entityId: assignmentId,
            userId: workerUserId,
            details: { attempts: newAttempts },
          });

          if (
            newAttempts >= NEARVIA_CONFIG.WORK_EXECUTION.MAX_JOB_PIN_ATTEMPTS
          ) {
            throw new AppError(
              `Maximum PIN verification attempts exceeded (${NEARVIA_CONFIG.WORK_EXECUTION.MAX_JOB_PIN_ATTEMPTS}/${NEARVIA_CONFIG.WORK_EXECUTION.MAX_JOB_PIN_ATTEMPTS}). Assignment is locked. Contact provider or support.`,
              429,
              ErrorCode.JOB_PIN_MAX_ATTEMPTS_EXCEEDED,
            );
          }

          throw new AppError(
            `Invalid Job PIN. Attempts remaining: ${
              NEARVIA_CONFIG.WORK_EXECUTION.MAX_JOB_PIN_ATTEMPTS - newAttempts
            }. Please verify with provider.`,
            400,
            ErrorCode.INVALID_JOB_PIN,
          );
        }

        pinVerified = true;
      }

      // 2. Time Window Validation
      const isWindowValid = this.validateCheckInTimeWindow(
        row.work_date,
        row.start_time,
        Number(row.duration_hours) || 2,
      );

      if (!isWindowValid && !input.manualFallback) {
        throw new AppError(
          "Check-in window is currently closed. You may only check in shortly before and during the scheduled shift time.",
          400,
          ErrorCode.CHECK_IN_WINDOW_CLOSED,
        );
      }

      // 3. Proximity Calculation & Verification
      let calculatedDistanceMeters: number | null = null;
      if (
        input.latitude != null &&
        input.longitude != null &&
        row.opportunity_latitude != null &&
        row.opportunity_longitude != null
      ) {
        calculatedDistanceMeters = this.calculateHaversineDistanceMeters(
          input.latitude,
          input.longitude,
          Number(row.opportunity_latitude),
          Number(row.opportunity_longitude),
        );

        if (
          calculatedDistanceMeters >
            NEARVIA_CONFIG.WORK_EXECUTION.MAX_CHECK_IN_PROXIMITY_METERS &&
          !input.manualFallback
        ) {
          throw new AppError(
            `You are ${(calculatedDistanceMeters / 1000).toFixed(1)} km away from the work site (allowed: ${(
              NEARVIA_CONFIG.WORK_EXECUTION.MAX_CHECK_IN_PROXIMITY_METERS / 1000
            ).toFixed(
              1,
            )} km). Please check in near the site or confirm manual check-in.`,
            400,
            ErrorCode.CHECK_IN_PROXIMITY_EXCEEDED,
          );
        }
      }

      // 4. Update Assignment Status
      await client.query(
        `UPDATE assignments 
         SET status = 'CHECKED_IN', 
             checked_in_at = NOW(), 
             check_in_distance_meters = $2,
             job_pin_verified_at = CASE WHEN $3::boolean = TRUE THEN NOW() ELSE job_pin_verified_at END,
             job_pin_attempts = CASE WHEN $3::boolean = TRUE THEN 0 ELSE job_pin_attempts END,
             updated_at = NOW() 
         WHERE id = $1`,
        [assignmentId, calculatedDistanceMeters, pinVerified],
      );

      // 5. Record in Attendance Table
      try {
        const attRes = await client.query(
          `SELECT id FROM attendance_records WHERE assignment_id = $1 LIMIT 1`,
          [assignmentId],
        );

        if (attRes.rows.length > 0) {
          await client.query(
            `UPDATE attendance_records
             SET check_in_time = NOW(),
                 check_in_location = CASE WHEN $2::numeric IS NOT NULL AND $3::numeric IS NOT NULL THEN ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography ELSE check_in_location END,
                 distance_meters = COALESCE($4, distance_meters),
                 verified_by_provider = CASE WHEN $5::boolean = TRUE THEN TRUE ELSE verified_by_provider END,
                 notes = COALESCE($6, notes)
             WHERE assignment_id = $1`,
            [
              assignmentId,
              input.latitude || null,
              input.longitude || null,
              calculatedDistanceMeters,
              pinVerified,
              input.notes || (input.manualFallback ? "Manual check-in" : "GPS check-in"),
            ],
          );
        } else {
          await client.query(
            `INSERT INTO attendance_records (
              assignment_id,
              worker_id,
              check_in_time,
              check_in_location,
              distance_meters,
              verified_by_provider,
              notes,
              created_at
             ) VALUES (
              $1,
              $2,
              NOW(),
              CASE WHEN $3::numeric IS NOT NULL AND $4::numeric IS NOT NULL THEN ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography ELSE NULL END,
              $5,
              $6,
              $7,
              NOW()
             )`,
            [
              assignmentId,
              row.worker_id,
              input.latitude || null,
              input.longitude || null,
              calculatedDistanceMeters,
              pinVerified,
              input.notes || (input.manualFallback ? "Manual check-in" : "GPS check-in"),
            ],
          );
        }
      } catch (e) {
        console.warn("[AssignmentsService] Failed to write attendance record:", e);
      }

      const updated = await this.fetchAssignmentRow(
        assignmentId,
        client.query.bind(client),
      );
      if (!updated) {
        throw new AppError(
          "Failed to update assignment.",
          500,
          ErrorCode.DATABASE_ERROR,
        );
      }

      await trackPlatformEvent({
        eventType: "WORKER_CHECKED_IN",
        entityType: "assignment",
        entityId: assignmentId,
        userId: workerUserId,
        details: {
          workOpportunityId: row.work_opportunity_id,
          status: AssignmentStatus.CHECKED_IN,
          checkInDistanceMeters: calculatedDistanceMeters,
          pinVerified,
        },
      });

      if (pinVerified) {
        await trackPlatformEvent({
          eventType: "JOB_PIN_VERIFIED",
          entityType: "assignment",
          entityId: assignmentId,
          userId: workerUserId,
        });
      }

      notificationsService
        .createNotification(
          row.provider_user_id,
          "WORKER_CHECKED_IN",
          "Worker Checked In On-Site",
          `The assigned worker has checked in on-site for '${row.title}'.`,
          { assignmentId, workOpportunityId: row.work_opportunity_id },
        )
        .catch(() => {});

      return this.mapRowToDetail(updated);
    });
  }

  /**
   * Worker starts work (CHECKED_IN -> IN_PROGRESS)
   */
  async startWork(
    workerUserId: string,
    assignmentId: string,
    _input: StartWorkInput,
  ): Promise<AssignmentDetail> {
    return withTransaction(async (client) => {
      const row = await this.fetchAssignmentRow(
        assignmentId,
        client.query.bind(client),
      );
      if (!row) {
        throw new AppError(
          "Assignment not found.",
          404,
          ErrorCode.ASSIGNMENT_NOT_FOUND,
        );
      }

      if (row.worker_user_id !== workerUserId) {
        throw new AppError(
          "Only the assigned worker can start this work.",
          403,
          ErrorCode.NOT_AUTHORIZED_FOR_ACTION,
        );
      }

      if (row.status !== AssignmentStatus.CHECKED_IN) {
        throw new AppError(
          `Cannot start work from status '${row.status}'. Worker must check in first.`,
          400,
          ErrorCode.ASSIGNMENT_INVALID_STATE,
        );
      }

      // Update assignment
      await client.query(
        `UPDATE assignments 
         SET status = 'IN_PROGRESS', 
             started_at = NOW(), 
             updated_at = NOW() 
         WHERE id = $1`,
        [assignmentId],
      );

      // Update worker availability to BUSY
      await client.query(
        `UPDATE worker_profiles 
         SET availability_status = 'BUSY', 
             updated_at = NOW() 
         WHERE id = $1`,
        [row.worker_id],
      );

      // Update work opportunity to IN_PROGRESS
      await client.query(
        `UPDATE work_opportunities 
         SET status = 'IN_PROGRESS', 
             updated_at = NOW() 
         WHERE id = $1`,
        [row.work_opportunity_id],
      );

      const updated = await this.fetchAssignmentRow(
        assignmentId,
        client.query.bind(client),
      );
      if (!updated) {
        throw new AppError(
          "Failed to update assignment.",
          500,
          ErrorCode.DATABASE_ERROR,
        );
      }
      await trackPlatformEvent({
        eventType: "WORK_STARTED",
        entityType: "assignment",
        entityId: assignmentId,
        userId: workerUserId,
        details: {
          workOpportunityId: row.work_opportunity_id,
          status: AssignmentStatus.IN_PROGRESS,
        },
      });

      return this.mapRowToDetail(updated);
    });
  }

  /**
   * Worker marks work as completed (IN_PROGRESS -> COMPLETED)
   */
  async completeWork(
    workerUserId: string,
    assignmentId: string,
    input: CompleteWorkInput,
  ): Promise<AssignmentDetail> {
    return withTransaction(async (client) => {
      const row = await this.fetchAssignmentRow(
        assignmentId,
        client.query.bind(client),
      );
      if (!row) {
        throw new AppError(
          "Assignment not found.",
          404,
          ErrorCode.ASSIGNMENT_NOT_FOUND,
        );
      }

      if (row.worker_user_id !== workerUserId) {
        throw new AppError(
          "Only the assigned worker can submit completion for this work.",
          403,
          ErrorCode.NOT_AUTHORIZED_FOR_ACTION,
        );
      }

      if (row.status === AssignmentStatus.COMPLETED) {
        throw new AppError(
          "This assignment has already been completed.",
          400,
          ErrorCode.ALREADY_COMPLETED,
        );
      }

      if (
        row.status !== AssignmentStatus.IN_PROGRESS &&
        row.status !== AssignmentStatus.CHECKED_IN
      ) {
        throw new AppError(
          `Cannot complete assignment from status '${row.status}'. Must be '${AssignmentStatus.IN_PROGRESS}'.`,
          400,
          ErrorCode.ASSIGNMENT_INVALID_STATE,
        );
      }

      // Update assignment status
      await client.query(
        `UPDATE assignments 
         SET status = 'COMPLETED', 
             completed_at = NOW(), 
             completion_notes = $2,
             updated_at = NOW() 
         WHERE id = $1`,
        [assignmentId, input.completionNotes || null],
      );

      // Check if all assignments for this opportunity are completed
      const checkRes = await client.query<{ uncompleted: number }>(
        `SELECT COUNT(*) AS uncompleted 
         FROM assignments 
         WHERE work_opportunity_id = $1 AND status NOT IN ('COMPLETED', 'CANCELLED', 'NO_SHOW')`,
        [row.work_opportunity_id],
      );

      if (Number(checkRes.rows[0]?.uncompleted || 0) === 0) {
        await client.query(
          `UPDATE work_opportunities 
           SET status = 'COMPLETED', 
               completed_at = NOW(), 
               updated_at = NOW() 
           WHERE id = $1`,
          [row.work_opportunity_id],
        );
      }

      // Reset worker availability status from BUSY to AVAILABLE_NOW or OFFLINE
      await client.query(
        `UPDATE worker_profiles 
         SET availability_status = CASE 
           WHEN is_available_now = TRUE AND available_until > NOW() THEN 'AVAILABLE_NOW'::availability_status
           ELSE 'OFFLINE'::availability_status
         END,
         updated_at = NOW()
         WHERE id = $1`,
        [row.worker_id],
      );

      const updated = await this.fetchAssignmentRow(
        assignmentId,
        client.query.bind(client),
      );
      if (!updated) {
        throw new AppError(
          "Failed to update assignment.",
          500,
          ErrorCode.DATABASE_ERROR,
        );
      }

      await trackPlatformEvent({
        eventType: "WORK_COMPLETED",
        entityType: "assignment",
        entityId: assignmentId,
        userId: workerUserId,
        details: {
          workOpportunityId: row.work_opportunity_id,
          status: AssignmentStatus.COMPLETED,
        },
      });

      notificationsService
        .createNotification(
          row.provider_user_id,
          "SHIFT_COMPLETED",
          "Work Marked Completed",
          `The assigned worker marked work complete for '${row.title}'. Please verify and sign off.`,
          { assignmentId, workOpportunityId: row.work_opportunity_id },
        )
        .catch(() => {});

      return this.mapRowToDetail(updated);
    });
  }

  /**
   * Provider confirms completion of work (Provider action)
   */
  async confirmCompletion(
    providerUserId: string,
    assignmentId: string,
    input: ConfirmCompletionInput,
  ): Promise<AssignmentDetail> {
    return withTransaction(async (client) => {
      const row = await this.fetchAssignmentRow(
        assignmentId,
        client.query.bind(client),
      );
      if (!row) {
        throw new AppError(
          "Assignment not found.",
          404,
          ErrorCode.ASSIGNMENT_NOT_FOUND,
        );
      }

      if (row.provider_user_id !== providerUserId) {
        throw new AppError(
          "Only the work opportunity provider can confirm completion for this assignment.",
          403,
          ErrorCode.NOT_AUTHORIZED_FOR_ACTION,
        );
      }

      if (
        row.status !== AssignmentStatus.IN_PROGRESS &&
        row.status !== AssignmentStatus.CHECKED_IN &&
        row.status !== AssignmentStatus.COMPLETED
      ) {
        throw new AppError(
          `Cannot confirm completion for assignment in status '${row.status}'.`,
          400,
          ErrorCode.ASSIGNMENT_INVALID_STATE,
        );
      }

      const finalWage = input.finalWagePaid || row.agreed_wage;

      // Update assignment
      await client.query(
        `UPDATE assignments 
         SET status = 'COMPLETED', 
             completed_at = COALESCE(completed_at, NOW()), 
             final_wage_paid = $2,
             updated_at = NOW() 
         WHERE id = $1`,
        [assignmentId, finalWage],
      );

      // Mark attendance record verified if exists
      try {
        await client.query(
          `UPDATE attendance_records 
           SET verified_by_provider = TRUE 
           WHERE assignment_id = $1`,
          [assignmentId],
        );
      } catch {
        // Table fallback
      }

      // Check if all assignments for opportunity are completed
      const checkRes = await client.query<{ uncompleted: number }>(
        `SELECT COUNT(*) AS uncompleted 
         FROM assignments 
         WHERE work_opportunity_id = $1 AND status NOT IN ('COMPLETED', 'CANCELLED', 'NO_SHOW')`,
        [row.work_opportunity_id],
      );

      const allCompleted = Number(checkRes.rows[0]?.uncompleted || 0) === 0;
      if (allCompleted) {
        await client.query(
          `UPDATE work_opportunities 
           SET status = 'SETTLEMENT_PENDING', 
               completed_at = COALESCE(completed_at, NOW()), 
               updated_at = NOW() 
           WHERE id = $1`,
          [row.work_opportunity_id],
        );
      }

      // Initialize pending payment_records row if not already created
      try {
        const payRes = await client.query(
          `SELECT id FROM payment_records WHERE assignment_id = $1 LIMIT 1`,
          [assignmentId],
        );
        if (payRes.rows.length === 0) {
          const finalWageNum = Number(finalWage) || 0;
          const finalWagePaise = Math.round(finalWageNum * 100);
          await client.query(
            `INSERT INTO payment_records (
               assignment_id, payer_id, payee_id, amount, amount_paise,
               currency, status, payment_method, notes, created_at, recorded_at
             ) VALUES ($1, $2, $3, $4, $5, 'INR', 'PENDING', 'DIRECT', $6, NOW(), NOW())`,
            [
              assignmentId,
              row.provider_user_id,
              row.worker_user_id,
              finalWageNum,
              finalWagePaise,
              `Wage settlement pending for ${row.title}`,
            ],
          );
        }
      } catch {
        // Table fallback
      }

      // Reset worker availability
      await client.query(
        `UPDATE worker_profiles 
         SET availability_status = CASE 
           WHEN is_available_now = TRUE AND available_until > NOW() THEN 'AVAILABLE_NOW'::availability_status
           ELSE 'OFFLINE'::availability_status
         END,
         updated_at = NOW()
         WHERE id = $1`,
        [row.worker_id],
      );

      const updated = await this.fetchAssignmentRow(
        assignmentId,
        client.query.bind(client),
      );
      if (!updated) {
        throw new AppError(
          "Failed to update assignment.",
          500,
          ErrorCode.DATABASE_ERROR,
        );
      }

      await trackPlatformEvent({
        eventType: "PROVIDER_CONFIRMED_COMPLETION",
        entityType: "assignment",
        entityId: assignmentId,
        userId: providerUserId,
        details: {
          workOpportunityId: row.work_opportunity_id,
          finalWage,
          status: AssignmentStatus.COMPLETED,
        },
      });

      if (allCompleted) {
        await trackPlatformEvent({
          eventType: "SETTLEMENT_PENDING",
          entityType: "work_opportunity",
          entityId: row.work_opportunity_id,
          userId: providerUserId,
          details: {
            assignmentId,
            finalWage,
            status: "SETTLEMENT_PENDING",
          },
        });
      }

      notificationsService
        .createNotification(
          row.worker_user_id,
          "COMPLETION_CONFIRMED",
          "Shift Confirmed & Payment Recorded!",
          `The employer signed off on your shift for '${row.title}'. Guaranteed wage of ₹${finalWage} recorded to your earnings.`,
          { assignmentId, workOpportunityId: row.work_opportunity_id },
        )
        .catch(() => {});

      return this.mapRowToDetail(updated);
    });
  }

  /**
   * Provider reports worker no-show (ASSIGNED / CONFIRMED -> NO_SHOW)
   */
  async reportNoShow(
    providerUserId: string,
    assignmentId: string,
    _input: NoShowInput,
  ): Promise<AssignmentDetail> {
    return withTransaction(async (client) => {
      const row = await this.fetchAssignmentRow(
        assignmentId,
        client.query.bind(client),
      );
      if (!row) {
        throw new AppError(
          "Assignment not found.",
          404,
          ErrorCode.ASSIGNMENT_NOT_FOUND,
        );
      }

      if (row.provider_user_id !== providerUserId) {
        throw new AppError(
          "Only the work provider can report a no-show for this assignment.",
          403,
          ErrorCode.NOT_AUTHORIZED_FOR_ACTION,
        );
      }

      if (
        row.status !== AssignmentStatus.ASSIGNED &&
        row.status !== AssignmentStatus.CONFIRMED
      ) {
        throw new AppError(
          `Cannot report no-show for assignment in status '${row.status}'.`,
          400,
          ErrorCode.ASSIGNMENT_INVALID_STATE,
        );
      }

      // Check if scheduled start time + grace period has elapsed
      const startTime =
        (row.start_time as any) instanceof Date
          ? (row.start_time as any).getTime()
          : new Date(String(row.start_time)).getTime();

      if (!isNaN(startTime)) {
        const graceEnd =
          startTime +
          NEARVIA_CONFIG.WORK_EXECUTION.NO_SHOW_GRACE_PERIOD_MINUTES *
            60 *
            1000;
        if (Date.now() < graceEnd) {
          throw new AppError(
            `Cannot report no-show before the scheduled start time plus ${NEARVIA_CONFIG.WORK_EXECUTION.NO_SHOW_GRACE_PERIOD_MINUTES}-minute grace period.`,
            400,
            ErrorCode.NO_SHOW_NOT_ELIGIBLE,
          );
        }
      }

      // Update assignment
      await client.query(
        `UPDATE assignments 
         SET status = 'NO_SHOW', 
             no_show_at = NOW(), 
             updated_at = NOW() 
         WHERE id = $1`,
        [assignmentId],
      );

      // Decrement workers_assigned on work_opportunity and update status
      await client.query(
        `UPDATE work_opportunities 
         SET workers_assigned = GREATEST(0, workers_assigned - 1),
             status = CASE 
               WHEN workers_assigned - 1 <= 0 THEN 'PUBLISHED'::work_opportunity_status
               ELSE 'PARTIALLY_FILLED'::work_opportunity_status
             END,
             updated_at = NOW()
         WHERE id = $1`,
        [row.work_opportunity_id],
      );

      const updated = await this.fetchAssignmentRow(
        assignmentId,
        client.query.bind(client),
      );
      if (!updated) {
        throw new AppError(
          "Failed to update assignment.",
          500,
          ErrorCode.DATABASE_ERROR,
        );
      }
      return this.mapRowToDetail(updated);
    });
  }

  /**
   * Worker or Provider cancels assignment (ASSIGNED / CONFIRMED -> CANCELLED)
   */
  async cancelAssignment(
    userId: string,
    role: UserRole,
    assignmentId: string,
    input: CancelAssignmentInput,
  ): Promise<AssignmentDetail> {
    return withTransaction(async (client) => {
      const row = await this.fetchAssignmentRow(
        assignmentId,
        client.query.bind(client),
      );
      if (!row) {
        throw new AppError(
          "Assignment not found.",
          404,
          ErrorCode.ASSIGNMENT_NOT_FOUND,
        );
      }

      if (
        row.worker_user_id !== userId &&
        row.provider_user_id !== userId &&
        role !== UserRole.ADMIN
      ) {
        throw new AppError(
          "You are not authorized to cancel this assignment.",
          403,
          ErrorCode.NOT_AUTHORIZED_FOR_ACTION,
        );
      }

      if (
        row.status !== AssignmentStatus.ASSIGNED &&
        row.status !== AssignmentStatus.CONFIRMED
      ) {
        throw new AppError(
          `Cannot cancel assignment with status '${row.status}'. Work in progress or completed must be resolved via dispute.`,
          400,
          ErrorCode.ASSIGNMENT_INVALID_STATE,
        );
      }

      // Update assignment
      await client.query(
        `UPDATE assignments 
         SET status = 'CANCELLED', 
             cancelled_at = NOW(), 
             cancelled_by = $2,
             cancellation_reason = $3,
             updated_at = NOW() 
         WHERE id = $1`,
        [assignmentId, userId, input.reason],
      );

      // Decrement workers_assigned on work_opportunity and update status
      await client.query(
        `UPDATE work_opportunities 
         SET workers_assigned = GREATEST(0, workers_assigned - 1),
             status = CASE 
               WHEN workers_assigned - 1 <= 0 THEN 'PUBLISHED'::work_opportunity_status
               ELSE 'PARTIALLY_FILLED'::work_opportunity_status
             END,
             updated_at = NOW()
         WHERE id = $1`,
        [row.work_opportunity_id],
      );

      // Reset worker availability from BUSY if necessary
      await client.query(
        `UPDATE worker_profiles 
         SET availability_status = CASE 
           WHEN is_available_now = TRUE AND available_until > NOW() THEN 'AVAILABLE_NOW'::availability_status
           ELSE 'OFFLINE'::availability_status
         END,
         updated_at = NOW()
         WHERE id = $1`,
        [row.worker_id],
      );

      const updated = await this.fetchAssignmentRow(
        assignmentId,
        client.query.bind(client),
      );
      if (!updated) {
        throw new AppError(
          "Failed to update assignment.",
          500,
          ErrorCode.DATABASE_ERROR,
        );
      }
      await trackPlatformEvent({
        eventType: "ASSIGNMENT_CANCELLED",
        entityType: "assignment",
        entityId: assignmentId,
        userId,
        details: {
          workOpportunityId: row.work_opportunity_id,
          reason: input.reason,
          status: AssignmentStatus.CANCELLED,
        },
      });

      return this.mapRowToDetail(updated);
    });
  }

  /**
   * Phase 5: Find Replacement Worker after No-Show
   */
  public async requestReplacementWorker(
    originalAssignmentId: string,
    providerUserId: string,
    reason?: string,
  ): Promise<{
    replacementRequestId: string;
    opportunityId: string;
    notifiedWorkersCount: number;
  }> {
    return withTransaction(async (client) => {
      const row = await this.fetchAssignmentRow(originalAssignmentId, client.query.bind(client));
      if (!row) {
        throw new AppError("Assignment not found.", 404, ErrorCode.NOT_FOUND);
      }

      if (row.provider_user_id !== providerUserId) {
        throw new AppError("Only the assigned provider can request a replacement worker.", 403, ErrorCode.FORBIDDEN);
      }

      // Record replacement request
      const reqRes = await client.query<{ id: string }>(
        `INSERT INTO replacement_requests (
          original_assignment_id,
          provider_id,
          previous_worker_id,
          reason,
          status
        ) VALUES ($1, $2, $3, $4, 'PENDING')
        RETURNING id`,
        [
          originalAssignmentId,
          row.provider_id,
          row.worker_id,
          reason || "WORKER_NO_SHOW_REPLACEMENT",
        ],
      );

      const replacementRequestId = reqRes.rows[0]?.id || "rep_req_created";

      // Update work opportunity to IMMEDIATE urgency so nearby online workers prioritize it
      await client.query(
        `UPDATE work_opportunities
         SET urgency = 'IMMEDIATE',
             status = 'PUBLISHED',
             updated_at = NOW()
         WHERE id = $1`,
        [row.work_opportunity_id],
      );

      // Fast-notify online workers in 5km radius
      const workersRes = await client.query<{ user_id: string }>(
        `SELECT wp.user_id
         FROM worker_profiles wp
         JOIN work_opportunities wo ON wo.id = $1
         WHERE wp.is_available_now = TRUE
           AND wp.id != $2
           AND (wp.available_until IS NULL OR wp.available_until > NOW())
           AND ST_DWithin(wp.location, wo.location, 5000)`,
        [row.work_opportunity_id, row.worker_id],
      );

      let notified = 0;
      for (const w of workersRes.rows) {
        await client.query(
          `INSERT INTO notifications (recipient_id, type, title, message, data)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            w.user_id,
            "URGENT_REPLACEMENT_JOB",
            "⚡ Urgent Replacement Job Needed!",
            `An urgent job "${row.title}" needs a replacement worker now in your area (₹${row.agreed_wage}).`,
            JSON.stringify({
              opportunityId: row.work_opportunity_id,
              replacementRequestId,
            }),
          ],
        );
        notified++;
      }

      return {
        replacementRequestId,
        opportunityId: row.work_opportunity_id,
        notifiedWorkersCount: notified,
      };
    });
  }

  /**
   * Phase 6: Verify Job PIN (Worker on-site arrival verification)
   */
  public async verifyJobPin(
    workerUserId: string,
    assignmentId: string,
    input: VerifyPinInput,
  ): Promise<AssignmentDetail> {
    return withTransaction(async (client) => {
      const row = await this.fetchAssignmentRow(assignmentId, client.query.bind(client));
      if (!row) {
        throw new AppError("Assignment not found.", 404, ErrorCode.ASSIGNMENT_NOT_FOUND);
      }

      if (row.worker_user_id !== workerUserId) {
        throw new AppError(
          "Only the assigned worker can verify the on-site Job PIN.",
          403,
          ErrorCode.NOT_AUTHORIZED_FOR_ACTION,
        );
      }

      // Check max attempts
      if ((row.job_pin_attempts || 0) >= 5) {
        throw new AppError(
          "Maximum PIN verification attempts exceeded (5/5). Please request provider on-site assistance.",
          429,
          ErrorCode.JOB_PIN_MAX_ATTEMPTS_EXCEEDED,
        );
      }

      const inputPin = String(input.jobPin || "").trim();
      const expectedPin = String(row.job_pin || "").trim();

      if (!inputPin || inputPin !== expectedPin) {
        const newAttempts = (row.job_pin_attempts || 0) + 1;
        await query(
          `UPDATE assignments
           SET job_pin_attempts = $2,
               updated_at = NOW()
           WHERE id = $1`,
          [assignmentId, newAttempts],
        );

        await trackPlatformEvent({
          eventType: "JOB_PIN_FAILED",
          entityType: "assignment",
          entityId: assignmentId,
          userId: workerUserId,
          details: { attempts: newAttempts },
        });

        if (newAttempts >= 5) {
          throw new AppError(
            "Maximum PIN verification attempts exceeded (5/5). Assignment is locked. Contact provider or support.",
            429,
            ErrorCode.JOB_PIN_MAX_ATTEMPTS_EXCEEDED,
          );
        }

        throw new AppError(
          `Invalid Job PIN. Attempts remaining: ${5 - newAttempts}. Please verify with provider.`,
          400,
          ErrorCode.INVALID_JOB_PIN,
        );
      }

      // PIN matched! Mark verified
      await client.query(
        `UPDATE assignments
         SET job_pin_verified_at = NOW(),
             job_pin_attempts = 0,
             updated_at = NOW()
         WHERE id = $1`,
        [assignmentId],
      );

      try {
        await client.query(
          `UPDATE attendance_records SET verified_by_provider = TRUE WHERE assignment_id = $1`,
          [assignmentId],
        );
      } catch {
        // Fallback
      }

      await trackPlatformEvent({
        eventType: "JOB_PIN_VERIFIED",
        entityType: "assignment",
        entityId: assignmentId,
        userId: workerUserId,
      });

      // Audit log
      try {
        await client.query(
          `INSERT INTO audit_logs (actor_id, action, target_entity, target_id, new_values)
           VALUES ($1, 'JOB_PIN_VERIFIED', 'assignment', $2, $3)`,
          [
            workerUserId,
            assignmentId,
            JSON.stringify({ verifiedAt: new Date().toISOString() }),
          ],
        );
      } catch (e) {
        console.warn("[AssignmentsService] Failed to write audit log for JOB_PIN_VERIFIED:", e);
      }

      // Notify provider
      notificationsService
        .createNotification(
          row.provider_user_id,
          "JOB_PIN_VERIFIED",
          "✓ Worker Arrived & PIN Verified",
          `Worker entered valid on-site Job PIN for '${row.title}'.`,
          { assignmentId, workOpportunityId: row.work_opportunity_id },
        )
        .catch(() => {});

      const updated = await this.fetchAssignmentRow(assignmentId, client.query.bind(client));
      if (!updated) {
        throw new AppError("Failed to update assignment.", 500, ErrorCode.DATABASE_ERROR);
      }
      return this.mapRowToDetail(updated, workerUserId);
    });
  }

  /**
   * Phase 6: Worker Check-Out (Calculates worked duration and submits completion)
   */
  public async checkOut(
    workerUserId: string,
    assignmentId: string,
    input: CheckOutInput,
  ): Promise<AssignmentDetail> {
    return withTransaction(async (client) => {
      const row = await this.fetchAssignmentRow(assignmentId, client.query.bind(client));
      if (!row) {
        throw new AppError("Assignment not found.", 404, ErrorCode.ASSIGNMENT_NOT_FOUND);
      }

      if (row.worker_user_id !== workerUserId) {
        throw new AppError(
          "Only the assigned worker can check out from this work.",
          403,
          ErrorCode.NOT_AUTHORIZED_FOR_ACTION,
        );
      }

      if (row.status === AssignmentStatus.COMPLETED) {
        throw new AppError("This assignment has already been completed.", 400, ErrorCode.ALREADY_COMPLETED);
      }

      if (
        row.status !== AssignmentStatus.IN_PROGRESS &&
        row.status !== AssignmentStatus.CHECKED_IN
      ) {
        throw new AppError(
          `Cannot check out from status '${row.status}'. Must be '${AssignmentStatus.IN_PROGRESS}' or '${AssignmentStatus.CHECKED_IN}'.`,
          400,
          ErrorCode.CHECK_OUT_INVALID_STATE,
        );
      }

      // Proximity Calculation & Verification on Check-Out
      let calculatedDistanceMeters: number | null = null;
      if (
        input.latitude != null &&
        input.longitude != null &&
        row.opportunity_latitude != null &&
        row.opportunity_longitude != null
      ) {
        calculatedDistanceMeters = this.calculateHaversineDistanceMeters(
          input.latitude,
          input.longitude,
          Number(row.opportunity_latitude),
          Number(row.opportunity_longitude),
        );

        if (
          calculatedDistanceMeters >
            NEARVIA_CONFIG.WORK_EXECUTION.MAX_CHECK_OUT_PROXIMITY_METERS &&
          !input.manualFallback
        ) {
          throw new AppError(
            `You are ${(calculatedDistanceMeters / 1000).toFixed(1)} km away from the work site (allowed: ${(
              NEARVIA_CONFIG.WORK_EXECUTION.MAX_CHECK_OUT_PROXIMITY_METERS / 1000
            ).toFixed(1)} km). Please check out near the site or confirm manual check-out.`,
            400,
            ErrorCode.CHECK_OUT_PROXIMITY_EXCEEDED,
          );
        }
      }

      // Calculate worked minutes
      const startMs = row.started_at
        ? new Date(row.started_at).getTime()
        : row.checked_in_at
        ? new Date(row.checked_in_at).getTime()
        : Date.now() - 3600000;
      const workedMinutes = Math.max(1, Math.round((Date.now() - startMs) / 60000));

      // Update assignment
      await client.query(
        `UPDATE assignments
         SET status = 'COMPLETED',
             checked_out_at = NOW(),
             completed_at = COALESCE(completed_at, NOW()),
             worked_minutes = $2,
             check_out_distance_meters = $3,
             completion_notes = COALESCE($4, completion_notes),
             updated_at = NOW()
         WHERE id = $1`,
        [
          assignmentId,
          workedMinutes,
          calculatedDistanceMeters,
          input.completionNotes || null,
        ],
      );

      // Record check-out in attendance_records
      try {
        const attRes = await client.query(
          `SELECT id FROM attendance_records WHERE assignment_id = $1 LIMIT 1`,
          [assignmentId],
        );

        if (attRes.rows.length > 0) {
          await client.query(
            `UPDATE attendance_records
             SET check_out_time = NOW(),
                 check_out_location = CASE WHEN $2::numeric IS NOT NULL AND $3::numeric IS NOT NULL THEN ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography ELSE check_out_location END,
                 check_out_distance_meters = COALESCE($4, check_out_distance_meters),
                 notes = COALESCE($5, notes)
             WHERE assignment_id = $1`,
            [
              assignmentId,
              input.latitude || null,
              input.longitude || null,
              calculatedDistanceMeters,
              input.completionNotes || null,
            ],
          );
        } else {
          await client.query(
            `INSERT INTO attendance_records (
              assignment_id,
              worker_id,
              check_in_time,
              check_out_time,
              check_out_location,
              check_out_distance_meters,
              notes,
              created_at
             ) VALUES (
              $1,
              $2,
              NOW(),
              NOW(),
              CASE WHEN $3::numeric IS NOT NULL AND $4::numeric IS NOT NULL THEN ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography ELSE NULL END,
              $5,
              $6,
              NOW()
             )`,
            [
              assignmentId,
              row.worker_id,
              input.latitude || null,
              input.longitude || null,
              calculatedDistanceMeters,
              input.completionNotes || null,
            ],
          );
        }
      } catch (e) {
        console.warn("[AssignmentsService] Failed to update attendance record on check-out:", e);
      }

      // Check if all workers for opportunity are completed
      const checkRes = await client.query<{ uncompleted: number }>(
        `SELECT COUNT(*) AS uncompleted 
         FROM assignments 
         WHERE work_opportunity_id = $1 AND status NOT IN ('COMPLETED', 'CANCELLED', 'NO_SHOW')`,
        [row.work_opportunity_id],
      );

      if (Number(checkRes.rows[0]?.uncompleted || 0) === 0) {
        await client.query(
          `UPDATE work_opportunities 
           SET status = 'COMPLETED', 
               completed_at = NOW(), 
               updated_at = NOW() 
           WHERE id = $1`,
          [row.work_opportunity_id],
        );
      }

      // Reset worker availability from BUSY
      await client.query(
        `UPDATE worker_profiles 
         SET availability_status = CASE 
           WHEN is_available_now = TRUE AND available_until > NOW() THEN 'AVAILABLE_NOW'::availability_status
           ELSE 'OFFLINE'::availability_status
         END,
         updated_at = NOW()
         WHERE id = $1`,
        [row.worker_id],
      );

      // Audit log
      try {
        await client.query(
          `INSERT INTO audit_logs (actor_id, action, target_entity, target_id, new_values)
           VALUES ($1, 'CHECK_OUT', 'assignment', $2, $3)`,
          [
            workerUserId,
            assignmentId,
            JSON.stringify({
              workedMinutes,
              checkOutDistanceMeters: calculatedDistanceMeters,
              checkedOutAt: new Date().toISOString(),
              completionNotes: input.completionNotes,
            }),
          ],
        );
      } catch (e) {
        console.warn("[AssignmentsService] Failed to write audit log for CHECK_OUT:", e);
      }

      await trackPlatformEvent({
        eventType: "WORKER_CHECKED_OUT",
        entityType: "assignment",
        entityId: assignmentId,
        userId: workerUserId,
        details: {
          workOpportunityId: row.work_opportunity_id,
          workedMinutes,
          checkOutDistanceMeters: calculatedDistanceMeters,
        },
      });

      await trackPlatformEvent({
        eventType: "WORK_COMPLETED",
        entityType: "assignment",
        entityId: assignmentId,
        userId: workerUserId,
        details: {
          workOpportunityId: row.work_opportunity_id,
          workedMinutes,
        },
      });

      // Notify provider
      const hours = Math.floor(workedMinutes / 60);
      const mins = workedMinutes % 60;
      const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`;

      notificationsService
        .createNotification(
          row.provider_user_id,
          "SHIFT_CHECKED_OUT",
          "Worker Checked Out — Completion Ready",
          `The assigned worker submitted completion for '${row.title}' (${durationStr} worked). Please confirm.`,
          { assignmentId, workOpportunityId: row.work_opportunity_id },
        )
        .catch(() => {});

      const updated = await this.fetchAssignmentRow(assignmentId, client.query.bind(client));
      if (!updated) {
        throw new AppError("Failed to update assignment.", 500, ErrorCode.DATABASE_ERROR);
      }
      return this.mapRowToDetail(updated, workerUserId);
    });
  }

  /**
   * Phase 6: Upload Optional Job Evidence (Before/After/Issue/Receipt)
   */
  public async uploadJobEvidence(
    userId: string,
    assignmentId: string,
    input: UploadJobEvidenceInput,
  ): Promise<JobEvidence> {
    const row = await this.fetchAssignmentRow(assignmentId);
    if (!row) {
      throw new AppError("Assignment not found.", 404, ErrorCode.ASSIGNMENT_NOT_FOUND);
    }

    if (userId !== row.worker_user_id && userId !== row.provider_user_id) {
      throw new AppError(
        "You are not authorized to upload evidence for this assignment.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    const res = await query<{
      id: string;
      assignment_id: string;
      uploaded_by: string;
      evidence_type: string;
      file_url: string;
      notes: string | null;
      created_at: string;
      full_name: string;
    }>(
      `INSERT INTO job_evidence (
        assignment_id,
        uploaded_by,
        evidence_type,
        file_url,
        notes
       ) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, assignment_id, uploaded_by, evidence_type, file_url, notes, created_at`,
      [
        assignmentId,
        userId,
        input.evidenceType,
        input.fileUrl,
        input.notes || null,
      ],
    );

    const inserted = res.rows[0];
    if (!inserted) {
      throw new AppError("Failed to record evidence in database.", 500, ErrorCode.DATABASE_ERROR);
    }

    // Audit log
    try {
      await query(
        `INSERT INTO audit_logs (actor_id, action, target_entity, target_id, new_values)
         VALUES ($1, 'EVIDENCE_UPLOADED', 'assignment', $2, $3)`,
        [
          userId,
          assignmentId,
          JSON.stringify({
            evidenceId: inserted.id,
            evidenceType: input.evidenceType,
          }),
        ],
      );
    } catch (e) {
      console.warn("[AssignmentsService] Failed to write audit log for EVIDENCE_UPLOADED:", e);
    }

    return {
      id: inserted.id,
      assignmentId: inserted.assignment_id,
      uploadedBy: inserted.uploaded_by,
      evidenceType: inserted.evidence_type as any,
      fileUrl: inserted.file_url,
      notes: inserted.notes || undefined,
      createdAt: inserted.created_at,
    };
  }

  /**
   * Phase 6: Get All Job Evidence for an Assignment
   */
  public async getJobEvidence(
    userId: string,
    assignmentId: string,
  ): Promise<JobEvidence[]> {
    const row = await this.fetchAssignmentRow(assignmentId);
    if (!row) {
      throw new AppError("Assignment not found.", 404, ErrorCode.ASSIGNMENT_NOT_FOUND);
    }

    if (userId !== row.worker_user_id && userId !== row.provider_user_id) {
      throw new AppError(
        "You are not authorized to view evidence for this assignment.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    const res = await query<{
      id: string;
      assignment_id: string;
      uploaded_by: string;
      evidence_type: string;
      file_url: string;
      notes: string | null;
      created_at: string;
      uploader_name: string;
    }>(
      `SELECT 
        je.id,
        je.assignment_id,
        je.uploaded_by,
        je.evidence_type,
        je.file_url,
        je.notes,
        je.created_at,
        u.full_name AS uploader_name
       FROM job_evidence je
       JOIN users u ON je.uploaded_by = u.id
       WHERE je.assignment_id = $1
       ORDER BY je.created_at ASC`,
      [assignmentId],
    );

    return res.rows.map((r) => ({
      id: r.id,
      assignmentId: r.assignment_id,
      uploadedBy: r.uploaded_by,
      uploaderName: r.uploader_name,
      evidenceType: r.evidence_type as any,
      fileUrl: r.file_url,
      notes: r.notes || undefined,
      createdAt: r.created_at,
    }));
  }

  /**
   * Phase 6: Privacy-Safe Active Job Share Snapshot (Zero private phone numbers or exact coordinates)
   */
  public async getSharedActiveJob(
    assignmentId: string,
  ): Promise<SharedActiveJobInfo> {
    const row = await this.fetchAssignmentRow(assignmentId);
    if (!row) {
      throw new AppError("Shared job not found.", 404, ErrorCode.NOT_FOUND);
    }

    return {
      id: row.id,
      title: row.title,
      workType: row.work_type,
      providerName: row.provider_business_name || row.provider_full_name,
      status: row.status,
      workDate: row.work_date,
      startTime: row.start_time,
      endTime: row.end_time,
      addressApproximate: row.address_approximate,
      checkedInAt: row.checked_in_at || undefined,
      checkedOutAt: row.checked_out_at || undefined,
      completedAt: row.completed_at || undefined,
    };
  }
}

export const assignmentsService = new AssignmentsService();

