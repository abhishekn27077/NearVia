/**
 * Applications Domain Service
 * Handles Worker Applications, Provider Review, Shortlisting, Rejection,
 * and Transactional Concurrency-Safe Selection & Assignment Creation.
 */

import {
  ApplicationDetail,
  ApplicantListItem,
  ApplyWorkInput,
  ApplicationStatus,
  WorkOpportunityStatus,
  WorkType,
  UrgencyLevel,
  PaymentType,
} from "@nearvia/types";
import { query, withTransaction } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";
import { matchingService } from "../matching/service";
import crypto from "crypto";
import { notificationsService } from "../notifications/service";
import { trackPlatformEvent } from "../../utils/events";

export class ApplicationsService {
  /**
   * Worker submits an application for a published work opportunity.
   */
  async applyForWork(
    workerUserId: string,
    workOpportunityId: string,
    input: ApplyWorkInput,
  ): Promise<ApplicationDetail> {
    // 1. Resolve worker profile
    const workerRes = await query<{
      id: string;
      latitude: number | null;
      longitude: number | null;
      service_radius_km: number | null;
    }>(
      `SELECT id, ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude, service_radius_km
       FROM worker_profiles
       WHERE user_id = $1`,
      [workerUserId],
    );

    const worker = workerRes.rows[0];
    const effectiveLat = input.workerLatitude ?? worker?.latitude ?? 12.9716;
    const effectiveLng = input.workerLongitude ?? worker?.longitude ?? 77.5946;

    if (!worker) {
      throw new AppError(
        "You must configure your profile and location before applying for work.",
        400,
        ErrorCode.LOCATION_REQUIRED,
      );
    }

    // If client supplied updated live GPS coordinates, synchronize to worker_profiles in database
    if (input.workerLatitude !== undefined && input.workerLongitude !== undefined) {
      query(
        `UPDATE worker_profiles 
         SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, updated_at = NOW() 
         WHERE user_id = $3`,
        [effectiveLng, effectiveLat, workerUserId],
      ).catch(() => {});
    }

    // 2. Fetch work opportunity & verify lifecycle state
    const jobRes = await query<{
      id: string;
      provider_id: string;
      title: string;
      description: string;
      work_type: string;
      urgency: string;
      status: string;
      workers_needed: number;
      workers_assigned: number;
      work_date: string;
      start_time: string;
      end_time: string;
      duration_hours: number;
      payment_amount: number;
      payment_type: string;
      address_approximate: string;
      distance_meters: number;
    }>(
      `SELECT 
        wo.id,
        wo.provider_id,
        wo.title,
        wo.description,
        wo.work_type,
        wo.urgency,
        wo.status,
        wo.workers_needed,
        wo.workers_assigned,
        wo.work_date,
        wo.start_time,
        wo.end_time,
        wo.duration_hours,
        wo.payment_amount,
        wo.payment_type,
        wo.address_approximate,
        ST_Distance(wo.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
       FROM work_opportunities wo
       WHERE wo.id = $3`,
      [effectiveLng, effectiveLat, workOpportunityId],
    );

    const job = jobRes.rows[0];
    if (!job) {
      throw new AppError(
        "Work opportunity not found.",
        404,
        ErrorCode.NOT_FOUND,
      );
    }

    // Prevent self-application (provider applying to own opportunity)
    const provCheck = await query<{ user_id: string }>(
      "SELECT user_id FROM provider_profiles WHERE id = $1",
      [job.provider_id],
    );
    if (provCheck.rows[0]?.user_id === workerUserId) {
      throw new AppError(
        "You cannot apply to your own work opportunity.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Lifecycle check
    if (job.status === "DRAFT") {
      throw new AppError(
        "Cannot apply to an unpublished draft opportunity.",
        400,
        ErrorCode.WORK_EXPIRED_OR_CANCELLED,
      );
    }
    if (job.status === "CANCELLED") {
      throw new AppError(
        "Cannot apply to a cancelled work opportunity.",
        400,
        ErrorCode.WORK_EXPIRED_OR_CANCELLED,
      );
    }
    if (
      job.status === "COMPLETED" ||
      job.status === "EXPIRED" ||
      job.status === "FILLED" ||
      job.status === "SETTLEMENT_PENDING" ||
      job.status === "PAID" ||
      job.status === "CLOSED"
    ) {
      throw new AppError(
        "This work opportunity is closed and cannot accept applications.",
        400,
        ErrorCode.WORK_EXPIRED_OR_CANCELLED,
      );
    }
    const validStatuses = ["PUBLISHED", "MATCHING", "PARTIALLY_FILLED"];
    if (!validStatuses.includes(job.status)) {
      throw new AppError(
        `Cannot apply for work with status '${job.status}'.`,
        400,
        ErrorCode.WORK_EXPIRED_OR_CANCELLED,
      );
    }

    // Expiry check
    const todayStr = new Date().toISOString().split("T")[0] ?? "";
    if (job.work_date < todayStr) {
      throw new AppError(
        "This work opportunity has expired.",
        400,
        ErrorCode.WORK_EXPIRED_OR_CANCELLED,
      );
    }

    // Capacity check
    if (job.workers_assigned >= job.workers_needed) {
      throw new AppError(
        "This opportunity has already reached required worker capacity.",
        409,
        ErrorCode.WORK_ALREADY_FILLED,
      );
    }

    // Spatial radius check (max allowed discovery radius: 15 km or worker's configured radius)
    const distanceKm = (Number(job.distance_meters) || 0) / 1000;
    const maxAllowedRadius = Math.max(worker.service_radius_km || 15, 15);
    if (distanceKm > maxAllowedRadius) {
      throw new AppError(
        `Work location (${distanceKm.toFixed(1)} km) is outside your service radius.`,
        400,
        ErrorCode.RADIUS_EXCEEDED,
      );
    }

    // Duplicate check
    const existingApp = await query<{ id: string }>(
      `SELECT id FROM applications WHERE work_opportunity_id = $1 AND worker_id = $2`,
      [workOpportunityId, worker.id],
    );
    if (existingApp.rows.length > 0) {
      throw new AppError(
        "You have already submitted an application for this work opportunity.",
        409,
        ErrorCode.APPLICATION_DUPLICATE,
      );
    }

    // 3. Compute match score snapshot
    let matchScore = 80;
    let matchReasons: string[] = ["Spatial and availability fit"];
    try {
      const match = await matchingService.explainMatch(
        workerUserId,
        workOpportunityId,
      );
      matchScore = match.score;
      matchReasons = match.reasons;
    } catch {
      // Offline fallback
    }

    // 4. Create application with race-condition protection (Postgres 23505)
    let insertRes;
    try {
      insertRes = await query<{
        id: string;
        created_at: string;
        applied_at: string;
        status: string;
        proposed_wage: number | null;
        worker_notes: string | null;
      }>(
        `INSERT INTO applications (
          work_opportunity_id,
          worker_id,
          status,
          proposed_wage,
          worker_notes,
          applied_at
         ) VALUES ($1, $2, 'PENDING', $3, $4, NOW())
         RETURNING id, created_at, applied_at, status, proposed_wage, worker_notes`,
        [
          workOpportunityId,
          worker.id,
          input.proposedWage || null,
          input.workerNotes || null,
        ],
      );
    } catch (err: any) {
      if (err?.code === "23505") {
        throw new AppError(
          "You have already submitted an application for this work opportunity.",
          409,
          ErrorCode.APPLICATION_DUPLICATE,
        );
      }
      throw err;
    }

    const appRow = insertRes.rows[0];
    if (!appRow) {
      throw new AppError(
        "Failed to create application.",
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }

    // Transition work opportunity status to MATCHING if previously PUBLISHED
    if (job.status === "PUBLISHED") {
      await query(
        `UPDATE work_opportunities SET status = 'MATCHING', updated_at = NOW() WHERE id = $1`,
        [workOpportunityId],
      );
    }

    // Trigger in-app notification to Provider
    query<{ user_id: string }>(
      "SELECT user_id FROM provider_profiles WHERE id = $1",
      [job.provider_id],
    )
      .then((res) => {
        const providerUserId = res.rows[0]?.user_id;
        if (providerUserId) {
          notificationsService.createNotification(
            providerUserId,
            "NEW_APPLICATION",
            `New Applicant for ${job.title}`,
            `A worker applied for your shift '${job.title}'. Review applicants to assign.`,
            { workOpportunityId, applicationId: appRow.id },
          );
        }
      })
      .catch(() => {});

    return {
      id: appRow.id,
      workOpportunityId,
      workerId: worker.id,
      status: ApplicationStatus.PENDING,
      proposedWage: appRow.proposed_wage
        ? Number(appRow.proposed_wage)
        : undefined,
      workerNotes: appRow.worker_notes || undefined,
      appliedAt: appRow.applied_at,
      createdAt: appRow.created_at,
      updatedAt: appRow.created_at,
      opportunityTitle: job.title,
      opportunityDescription: job.description,
      workType: job.work_type as WorkType,
      urgency: job.urgency as UrgencyLevel,
      workDate: job.work_date,
      startTime: job.start_time,
      endTime: job.end_time,
      durationHours: Number(job.duration_hours),
      paymentAmount: Number(job.payment_amount),
      paymentType: job.payment_type as PaymentType,
      addressApproximate: job.address_approximate,
      opportunityStatus: WorkOpportunityStatus.MATCHING,
      matchScore,
      matchReasons,
    };
  }

  /**
   * Get all applications submitted by the authenticated worker.
   */
  async getMyApplications(workerUserId: string): Promise<ApplicationDetail[]> {
    const res = await query<{
      id: string;
      work_opportunity_id: string;
      worker_id: string;
      status: string;
      proposed_wage: number | null;
      worker_notes: string | null;
      applied_at: string;
      responded_at: string | null;
      decision_notes: string | null;
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
      payment_amount: number;
      payment_type: string;
      address_approximate: string;
      opp_status: string;
      category_name: string;
      business_name: string | null;
      assisted_by_agent_id: string | null;
    }>(
      `SELECT 
        a.id,
        a.work_opportunity_id,
        a.worker_id,
        a.status,
        a.proposed_wage,
        a.worker_notes,
        a.applied_at,
        a.responded_at,
        a.decision_notes,
        a.assisted_by_agent_id,
        a.created_at,
        a.updated_at,
        wo.title,
        wo.description,
        wo.work_type,
        wo.urgency,
        wo.work_date,
        wo.start_time,
        wo.end_time,
        wo.duration_hours,
        wo.payment_amount,
        wo.payment_type,
        wo.address_approximate,
        wo.status AS opp_status,
        c.name AS category_name,
        pp.business_name
       FROM applications a
       JOIN worker_profiles wp ON a.worker_id = wp.id
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       JOIN categories c ON wo.category_id = c.id
       JOIN provider_profiles pp ON wo.provider_id = pp.id
       WHERE wp.user_id = $1
       ORDER BY a.applied_at DESC`,
      [workerUserId],
    );

    return res.rows.map((r) => ({
      id: r.id,
      workOpportunityId: r.work_opportunity_id,
      workerId: r.worker_id,
      status: r.status as ApplicationStatus,
      proposedWage: r.proposed_wage ? Number(r.proposed_wage) : undefined,
      workerNotes: r.worker_notes || undefined,
      appliedAt: r.applied_at,
      respondedAt: r.responded_at || undefined,
      decisionNotes: r.decision_notes || undefined,
      assistedByAgentId: r.assisted_by_agent_id || undefined,
      isAgentAssisted: Boolean(r.assisted_by_agent_id),
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
      paymentAmount: Number(r.payment_amount),
      paymentType: r.payment_type as PaymentType,
      addressApproximate: r.address_approximate,
      opportunityStatus: r.opp_status as WorkOpportunityStatus,
      categoryName: r.category_name,
      providerBusinessName: r.business_name || undefined,
    }));
  }

  /**
   * Get single application by ID with ownership authorization check.
   */
  async getApplicationById(
    userId: string,
    applicationId: string,
  ): Promise<ApplicationDetail> {
    const res = await query<{
      id: string;
      work_opportunity_id: string;
      worker_id: string;
      worker_user_id: string;
      provider_user_id: string;
      status: string;
      proposed_wage: number | null;
      worker_notes: string | null;
      applied_at: string;
      responded_at: string | null;
      decision_notes: string | null;
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
      payment_amount: number;
      payment_type: string;
      address_approximate: string;
      opp_status: string;
      category_name: string;
      business_name: string | null;
      worker_full_name: string;
      worker_avatar_url: string | null;
      worker_rating: number | null;
      worker_completed_tasks: number | null;
      assisted_by_agent_id: string | null;
    }>(
      `SELECT 
        a.id,
        a.work_opportunity_id,
        a.worker_id,
        wp.user_id AS worker_user_id,
        pp.user_id AS provider_user_id,
        a.status,
        a.proposed_wage,
        a.worker_notes,
        a.applied_at,
        a.responded_at,
        a.decision_notes,
        a.assisted_by_agent_id,
        a.created_at,
        a.updated_at,
        wo.title,
        wo.description,
        wo.work_type,
        wo.urgency,
        wo.work_date,
        wo.start_time,
        wo.end_time,
        wo.duration_hours,
        wo.payment_amount,
        wo.payment_type,
        wo.address_approximate,
        wo.status AS opp_status,
        c.name AS category_name,
        pp.business_name,
        uw.full_name AS worker_full_name,
        uw.avatar_url AS worker_avatar_url,
        wp.average_rating AS worker_rating,
        wp.completed_tasks_count AS worker_completed_tasks
       FROM applications a
       JOIN worker_profiles wp ON a.worker_id = wp.id
       JOIN users uw ON wp.user_id = uw.id
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       JOIN categories c ON wo.category_id = c.id
       JOIN provider_profiles pp ON wo.provider_id = pp.id
       WHERE a.id = $1`,
      [applicationId],
    );

    const r = res.rows[0];
    if (!r) {
      throw new AppError(
        "Application not found.",
        404,
        ErrorCode.APPLICATION_NOT_FOUND,
      );
    }

    if (userId !== r.worker_user_id && userId !== r.provider_user_id) {
      throw new AppError(
        "You are not authorized to view this application.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    return {
      id: r.id,
      workOpportunityId: r.work_opportunity_id,
      workerId: r.worker_id,
      status: r.status as ApplicationStatus,
      proposedWage: r.proposed_wage ? Number(r.proposed_wage) : undefined,
      workerNotes: r.worker_notes || undefined,
      appliedAt: r.applied_at,
      respondedAt: r.responded_at || undefined,
      decisionNotes: r.decision_notes || undefined,
      assistedByAgentId: r.assisted_by_agent_id || undefined,
      isAgentAssisted: Boolean(r.assisted_by_agent_id),
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
      paymentAmount: Number(r.payment_amount),
      paymentType: r.payment_type as PaymentType,
      addressApproximate: r.address_approximate,
      opportunityStatus: r.opp_status as WorkOpportunityStatus,
      categoryName: r.category_name,
      providerBusinessName: r.business_name || undefined,
      workerFullName: r.worker_full_name,
      workerAvatarUrl: r.worker_avatar_url || undefined,
      workerRating: r.worker_rating ? Number(r.worker_rating) : undefined,
      workerCompletedTasks: r.worker_completed_tasks
        ? Number(r.worker_completed_tasks)
        : undefined,
    };
  }

  /**
   * Worker withdraws their own pending or shortlisted application.
   */
  async withdrawApplication(
    workerUserId: string,
    applicationId: string,
    reason?: string,
  ): Promise<ApplicationDetail> {
    const appRes = await query<{
      id: string;
      worker_user_id: string;
      status: string;
    }>(
      `SELECT a.id, wp.user_id AS worker_user_id, a.status
       FROM applications a
       JOIN worker_profiles wp ON a.worker_id = wp.id
       WHERE a.id = $1`,
      [applicationId],
    );

    const app = appRes.rows[0];
    if (!app) {
      throw new AppError(
        "Application not found.",
        404,
        ErrorCode.APPLICATION_NOT_FOUND,
      );
    }

    if (app.worker_user_id !== workerUserId) {
      throw new AppError(
        "You can only withdraw your own applications.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    if (app.status !== "PENDING" && app.status !== "SHORTLISTED") {
      throw new AppError(
        `Cannot withdraw application with status '${app.status}'.`,
        400,
        ErrorCode.APPLICATION_INVALID_STATE,
      );
    }

    const updateRes = await query(
      `UPDATE applications
       SET status = 'WITHDRAWN', decision_notes = $1, responded_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status IN ('PENDING', 'SHORTLISTED')`,
      [reason || "Withdrawn by worker", applicationId],
    );

    if (updateRes.rowCount === 0) {
      throw new AppError(
        "Application state has changed or application cannot be withdrawn.",
        409,
        ErrorCode.APPLICATION_INVALID_STATE,
      );
    }

    return this.getApplicationById(workerUserId, applicationId);
  }

  /**
   * Provider views all applicants for their work opportunity, ranked by match score.
   */
  async getOpportunityApplicants(
    providerUserId: string,
    workOpportunityId: string,
  ): Promise<ApplicantListItem[]> {
    // Verify provider ownership
    const ownRes = await query<{ id: string; location: any }>(
      `SELECT wo.id, wo.location
       FROM work_opportunities wo
       JOIN provider_profiles pp ON wo.provider_id = pp.id
       WHERE wo.id = $1 AND pp.user_id = $2`,
      [workOpportunityId, providerUserId],
    );

    if (ownRes.rows.length === 0) {
      throw new AppError(
        "You are not authorized to view applicants for this work opportunity.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    // Fetch all applicants for this opportunity
    const appsRes = await query<{
      application_id: string;
      worker_id: string;
      worker_user_id: string;
      full_name: string;
      avatar_url: string | null;
      average_rating: number | null;
      completed_tasks_count: number | null;
      is_available_now: boolean | null;
      worker_phone_verified: boolean | null;
      worker_identity_verified: boolean | null;
      worker_email_verified: boolean | null;
      status: string;
      proposed_wage: number | null;
      worker_notes: string | null;
      applied_at: string;
      distance_meters: number;
      assisted_by_agent_id: string | null;
    }>(
      `SELECT 
        a.id AS application_id,
        a.worker_id,
        wp.user_id AS worker_user_id,
        u.full_name,
        u.avatar_url,
        wp.average_rating,
        wp.completed_tasks_count,
        wp.is_available_now,
        u.mobile_verified AS worker_phone_verified,
        u.identity_verified AS worker_identity_verified,
        (u.email IS NOT NULL) AS worker_email_verified,
        a.status,
        a.proposed_wage,
        a.worker_notes,
        a.applied_at,
        ST_Distance(wp.location, wo.location) AS distance_meters,
        a.assisted_by_agent_id
       FROM applications a
       JOIN worker_profiles wp ON a.worker_id = wp.id
       JOIN users u ON wp.user_id = u.id
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       WHERE a.work_opportunity_id = $1
       ORDER BY a.applied_at DESC`,
      [workOpportunityId],
    );

    const applicants: ApplicantListItem[] = [];

    for (const row of appsRes.rows) {
      // Fetch trade skills for applicant
      let skills: string[] = [];
      try {
        const skRes = await query<{ name: string }>(
          `SELECT s.name
           FROM worker_skills ws
           JOIN skills s ON ws.skill_id = s.id
           WHERE ws.worker_id = $1`,
          [row.worker_id],
        );
        skills = skRes.rows.map((s) => s.name);
      } catch {
        skills = [];
      }

      // Compute match score snapshot
      let matchScore = 80;
      let matchReasons: string[] = ["Qualified local candidate"];
      try {
        const match = await matchingService.explainMatch(
          row.worker_user_id,
          workOpportunityId,
        );
        matchScore = match.score;
        matchReasons = match.reasons;
      } catch {
        // Ignored
      }

      const distMeters = Number(row.distance_meters) || 0;
      const distKm = Math.round((distMeters / 1000) * 10) / 10;

      applicants.push({
        applicationId: row.application_id,
        workerId: row.worker_id,
        workerUserId: row.worker_user_id,
        workerFullName: row.full_name,
        workerAvatarUrl: row.avatar_url || undefined,
        workerRating: row.average_rating ? Number(row.average_rating) : 5.0,
        workerCompletedTasks: row.completed_tasks_count
          ? Number(row.completed_tasks_count)
          : 0,
        workerTradeSkills: skills,
        workerDistanceKm: distKm,
        workerIsAvailableNow: Boolean(row.is_available_now),
        workerPhoneVerified: Boolean(row.worker_phone_verified),
        workerIdentityVerified: Boolean(row.worker_identity_verified),
        workerEmailVerified: Boolean(row.worker_email_verified),
        status: row.status as ApplicationStatus,
        proposedWage: row.proposed_wage ? Number(row.proposed_wage) : undefined,
        workerNotes: row.worker_notes || undefined,
        appliedAt: row.applied_at,
        assistedByAgentId: row.assisted_by_agent_id || undefined,
        isAgentAssisted: Boolean(row.assisted_by_agent_id),
        matchScore,
        matchReasons,
      });
    }

    // Sort applicants by match score descending
    applicants.sort((a, b) => b.matchScore - a.matchScore);

    return applicants;
  }

  /**
   * Provider shortlists a pending application.
   */
  async shortlistApplication(
    providerUserId: string,
    applicationId: string,
    notes?: string,
  ): Promise<ApplicationDetail> {
    const app = await this.getApplicationById(providerUserId, applicationId);

    if (app.status !== ApplicationStatus.PENDING) {
      throw new AppError(
        `Cannot shortlist application with status '${app.status}'.`,
        400,
        ErrorCode.APPLICATION_INVALID_STATE,
      );
    }

    await query(
      `UPDATE applications
       SET status = 'SHORTLISTED', decision_notes = $1, responded_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [notes || "Shortlisted for review", applicationId],
    );

    query<{ user_id: string }>(
      "SELECT user_id FROM worker_profiles WHERE id = $1",
      [app.workerId],
    )
      .then((res) => {
        const workerUserId = res.rows[0]?.user_id;
        if (workerUserId) {
          notificationsService.createNotification(
            workerUserId,
            "APPLICATION_SHORTLISTED",
            `Shortlisted for ${app.opportunityTitle}`,
            `The employer shortlisted your application for '${app.opportunityTitle}'.`,
            { workOpportunityId: app.workOpportunityId, applicationId },
          );
        }
      })
      .catch(() => {});

    return this.getApplicationById(providerUserId, applicationId);
  }

  /**
   * Provider rejects an application.
   */
  async rejectApplication(
    providerUserId: string,
    applicationId: string,
    notes?: string,
  ): Promise<ApplicationDetail> {
    const app = await this.getApplicationById(providerUserId, applicationId);

    if (
      app.status !== ApplicationStatus.PENDING &&
      app.status !== ApplicationStatus.SHORTLISTED
    ) {
      throw new AppError(
        `Cannot reject application with status '${app.status}'.`,
        400,
        ErrorCode.APPLICATION_INVALID_STATE,
      );
    }

    await query(
      `UPDATE applications
       SET status = 'REJECTED', decision_notes = $1, responded_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [notes || "Declined by provider", applicationId],
    );

    query<{ user_id: string }>(
      "SELECT user_id FROM worker_profiles WHERE id = $1",
      [app.workerId],
    )
      .then((res) => {
        const workerUserId = res.rows[0]?.user_id;
        if (workerUserId) {
          notificationsService.createNotification(
            workerUserId,
            "APPLICATION_REJECTED",
            `Update on ${app.opportunityTitle}`,
            `Your application for '${app.opportunityTitle}' was not selected.`,
            { workOpportunityId: app.workOpportunityId, applicationId },
          );
        }
      })
      .catch(() => {});

    return this.getApplicationById(providerUserId, applicationId);
  }

  /**
   * Provider selects / accepts an applicant.
   * TRANSACTIONAL CONCURRENCY: Uses SELECT ... FOR UPDATE on work_opportunities
   * to guarantee workers_needed capacity is never exceeded.
   */
  async acceptApplication(
    providerUserId: string,
    applicationId: string,
    notes?: string,
    requestingRole?: string,
  ): Promise<{ application: ApplicationDetail; assignmentId: string }> {
    const meta = await withTransaction(async (client) => {
      // 1. Fetch application details with lock
      const appRes = await client.query<{
        id: string;
        work_opportunity_id: string;
        worker_id: string;
        status: string;
        proposed_wage: number | null;
        provider_user_id: string;
        provider_id: string;
      }>(
        `SELECT 
          a.id,
          a.work_opportunity_id,
          a.worker_id,
          a.status,
          a.proposed_wage,
          pp.user_id AS provider_user_id,
          pp.id AS provider_id
         FROM applications a
         JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
         JOIN provider_profiles pp ON wo.provider_id = pp.id
         WHERE a.id = $1`,
        [applicationId],
      );

      const app = appRes.rows[0];
      if (!app) {
        throw new AppError(
          "Application not found.",
          404,
          ErrorCode.APPLICATION_NOT_FOUND,
        );
      }

      // Check provider ownership
      const isAdmin = requestingRole === "ADMIN";
      if (!isAdmin && app.provider_user_id !== providerUserId) {
        throw new AppError(
          "You are not authorized to accept applicants for this work.",
          403,
          ErrorCode.FORBIDDEN,
        );
      }

      // Check application status
      if (app.status !== "PENDING" && app.status !== "SHORTLISTED") {
        throw new AppError(
          `Cannot accept application with status '${app.status}'.`,
          400,
          ErrorCode.APPLICATION_INVALID_STATE,
        );
      }

      // 2. Lock work opportunity row to prevent race conditions & over-hiring
      const jobLockRes = await client.query<{
        id: string;
        title: string;
        workers_needed: number;
        workers_assigned: number;
        payment_amount: number;
        status: string;
      }>(
        `SELECT id, title, workers_needed, workers_assigned, payment_amount, status
         FROM work_opportunities
         WHERE id = $1
         FOR UPDATE`,
        [app.work_opportunity_id],
      );

      const job = jobLockRes.rows[0];
      if (!job) {
        throw new AppError(
          "Work opportunity not found.",
          404,
          ErrorCode.NOT_FOUND,
        );
      }

      // Check if worker already has an active assignment for this job
      const existingActive = await client.query<{ id: string }>(
        `SELECT id FROM assignments 
         WHERE work_opportunity_id = $1 AND worker_id = $2
           AND status NOT IN ('CANCELLED', 'NO_SHOW', 'REPLACED')`,
        [app.work_opportunity_id, app.worker_id],
      );
      if (existingActive.rows.length > 0) {
        throw new AppError(
          "Worker is already actively assigned to this work opportunity.",
          409,
          ErrorCode.CONFLICT,
        );
      }

      // Capacity verification
      if (job.workers_assigned >= job.workers_needed) {
        throw new AppError(
          `Capacity reached (${job.workers_assigned}/${job.workers_needed}). Cannot accept additional workers.`,
          409,
          ErrorCode.WORK_ALREADY_FILLED,
        );
      }

      // 3. Update application to ACCEPTED with atomic concurrency check
      const appUpdateRes = await client.query(
        `UPDATE applications
         SET status = 'ACCEPTED', decision_notes = $1, responded_at = NOW(), updated_at = NOW()
         WHERE id = $2 AND status IN ('PENDING', 'SHORTLISTED')`,
        [notes || "Accepted and assigned to work", applicationId],
      );

      if (appUpdateRes.rowCount === 0) {
        throw new AppError(
          "Application is no longer in a valid state to be accepted.",
          409,
          ErrorCode.APPLICATION_INVALID_STATE,
        );
      }

      // 4. Increment workers_assigned & update opportunity status
      const newAssigned = job.workers_assigned + 1;
      const isNowFilled = newAssigned >= job.workers_needed;
      const newStatus =
        isNowFilled ? "FILLED" : "PARTIALLY_FILLED";

      await client.query(
        `UPDATE work_opportunities
         SET workers_assigned = $1, status = $2, updated_at = NOW()
         WHERE id = $3`,
        [newAssigned, newStatus, app.work_opportunity_id],
      );

      // 5. Create official assignment record
      const agreedWage = app.proposed_wage
        ? Number(app.proposed_wage)
        : Number(job.payment_amount);

      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      const pinHash = crypto.createHash("sha256").update(pin).digest("hex");

      const assignRes = await client.query<{ id: string }>(
        `INSERT INTO assignments (
          work_opportunity_id,
          worker_id,
          provider_id,
          application_id,
          status,
          agreed_wage,
          job_pin,
          job_pin_hash,
          assigned_at
         ) VALUES ($1, $2, $3, $4, 'ASSIGNED', $5, $6, $7, NOW())
         RETURNING id`,
        [
          app.work_opportunity_id,
          app.worker_id,
          app.provider_id,
          app.id,
          agreedWage,
          pin,
          pinHash,
        ],
      );

      const assignmentId = assignRes.rows[0]?.id;
      if (!assignmentId) {
        throw new AppError(
          "Failed to create assignment record.",
          500,
          ErrorCode.DATABASE_ERROR,
        );
      }

      // 6. When position is filled, auto-reject remaining pending/shortlisted candidates
      const rejectedWorkerUserIds: string[] = [];
      if (isNowFilled) {
        const remainingRes = await client.query<{ id: string; worker_id: string }>(
          `UPDATE applications
           SET status = 'REJECTED', 
               decision_notes = 'Position filled by another candidate', 
               responded_at = NOW(), 
               updated_at = NOW()
           WHERE work_opportunity_id = $1 
             AND status IN ('PENDING', 'SHORTLISTED') 
             AND id != $2
           RETURNING id, worker_id`,
          [app.work_opportunity_id, applicationId],
        );

        for (const rem of remainingRes.rows) {
          const wRes = await client.query<{ user_id: string }>(
            "SELECT user_id FROM worker_profiles WHERE id = $1",
            [rem.worker_id],
          );
          if (wRes.rows[0]?.user_id) {
            rejectedWorkerUserIds.push(wRes.rows[0].user_id);
          }
        }
      }

      return {
        assignmentId,
        workOpportunityId: app.work_opportunity_id,
        workerId: app.worker_id,
        jobTitle: job.title,
        rejectedWorkerUserIds,
      };
    });

    // 7. Return updated detail (queried after transaction COMMIT)
    const updatedApp = await this.getApplicationById(
      providerUserId,
      applicationId,
    );

    // Notify rejected candidates whose applications were closed
    for (const rejectedUserId of meta.rejectedWorkerUserIds) {
      notificationsService
        .createNotification(
          rejectedUserId,
          "APPLICATION_REJECTED",
          `Position Filled: ${meta.jobTitle}`,
          `The position for '${meta.jobTitle}' has been filled by another candidate. Thank you for your interest.`,
          { workOpportunityId: meta.workOpportunityId },
        )
        .catch(() => {});
    }

    // Audit Events
    trackPlatformEvent({
      eventType: "WORKER_SELECTED",
      userId: providerUserId,
      resourceType: "applications",
      resourceId: applicationId,
      metadata: { workOpportunityId: meta.workOpportunityId, workerId: meta.workerId },
    }).catch(() => {});

    trackPlatformEvent({
      eventType: "ASSIGNMENT_CREATED",
      userId: providerUserId,
      resourceType: "assignments",
      resourceId: meta.assignmentId,
      metadata: { workOpportunityId: meta.workOpportunityId, workerId: meta.workerId },
    }).catch(() => {});

    // Trigger in-app notification to Worker
    query<{ user_id: string }>(
      "SELECT user_id FROM worker_profiles WHERE id = $1",
      [meta.workerId],
    )
      .then((res) => {
        const workerUserId = res.rows[0]?.user_id;
        if (workerUserId) {
          notificationsService.createNotification(
            workerUserId,
            "APPLICATION_ACCEPTED",
            `You've been hired for ${meta.jobTitle}!`,
            `You've been hired for '${meta.jobTitle}'! Open My Shifts to confirm attendance and get directions.`,
            {
              workOpportunityId: meta.workOpportunityId,
              assignmentId: meta.assignmentId,
            },
          );
        }
      })
      .catch(() => {});

    // Trigger in-app notification to assisting Agent if applicable
    if (updatedApp.assistedByAgentId) {
      query<{ user_id: string }>(
        "SELECT user_id FROM agent_profiles WHERE id = $1",
        [updatedApp.assistedByAgentId],
      )
        .then((res) => {
          const agentUserId = res.rows[0]?.user_id;
          if (agentUserId) {
            notificationsService.createNotification(
              agentUserId,
              "AGENT_WORKER_HIRED",
              `Worker hired for ${meta.jobTitle}`,
              `Your assisted worker has been hired for '${meta.jobTitle}'. Help them prepare for their shift.`,
              {
                workOpportunityId: meta.workOpportunityId,
                assignmentId: meta.assignmentId,
                workerId: meta.workerId,
              },
            );
          }
        })
        .catch(() => {});
    }

    return {
      application: updatedApp,
      assignmentId: meta.assignmentId,
    };
  }
}

export const applicationsService = new ApplicationsService();
