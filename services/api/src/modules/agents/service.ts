/**
 * Agents Service — Phase 13: Agent-Assisted Job Access
 * Handles agent profile, worker consent, assisted discovery,
 * assisted applications, and audit trail.
 *
 * Security: Every method enforces AUTHENTICATED + AGENT ROLE + ACTIVE CONSENT.
 * Agent identity is always derived server-side from req.user.id.
 */

import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";
import { logAuditEvent } from "../../utils/audit";
import {
  AgentProfileResponse,
  AgentProfileUpdateInput,
  AgentWorkerRelationshipResponse,
  AssistedWorkerDetail,
  AssistedJobDetailResponse,
  AssistedAssignmentDetailResponse,
} from "./types";

export class AgentsService {
  // ──────────────────────────────────────────────────
  // AGENT PROFILE
  // ──────────────────────────────────────────────────

  async getMyProfile(agentUserId: string): Promise<AgentProfileResponse> {
    const res = await query(
      `SELECT ap.id, ap.user_id, u.full_name, u.phone,
              ap.assigned_area, ap.description, ap.languages,
              ap.address_approximate, ap.verified_workers_count,
              ap.active_status, ap.created_at
       FROM agent_profiles ap
       JOIN users u ON ap.user_id = u.id
       WHERE ap.user_id = $1`,
      [agentUserId]
    );
    const row = res.rows[0];
    if (!row) throw new AppError("Agent profile not found. Ensure your account has the AGENT role.", 404);

    return {
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      phone: row.phone,
      assignedArea: row.assigned_area,
      description: row.description,
      languages: row.languages || [],
      addressApproximate: row.address_approximate,
      verifiedWorkersCount: row.verified_workers_count,
      activeStatus: row.active_status,
      createdAt: row.created_at,
    };
  }

  async updateMyProfile(agentUserId: string, data: AgentProfileUpdateInput): Promise<AgentProfileResponse> {
    // Build dynamic SET clause
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (data.assignedArea !== undefined) {
      setClauses.push(`assigned_area = $${paramIdx++}`);
      params.push(data.assignedArea);
    }
    if (data.description !== undefined) {
      setClauses.push(`description = $${paramIdx++}`);
      params.push(data.description);
    }
    if (data.languages !== undefined) {
      setClauses.push(`languages = $${paramIdx++}`);
      params.push(data.languages);
    }
    if (data.addressApproximate !== undefined) {
      setClauses.push(`address_approximate = $${paramIdx++}`);
      params.push(data.addressApproximate);
    }
    if (data.latitude !== undefined && data.longitude !== undefined) {
      setClauses.push(`location = ST_SetSRID(ST_MakePoint($${paramIdx}, $${paramIdx + 1}), 4326)::geography`);
      params.push(data.longitude, data.latitude);
      paramIdx += 2;
    }

    if (setClauses.length === 0) {
      return this.getMyProfile(agentUserId);
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(agentUserId);

    await query(
      `UPDATE agent_profiles SET ${setClauses.join(", ")} WHERE user_id = $${paramIdx}`,
      params
    );

    return this.getMyProfile(agentUserId);
  }

  // ──────────────────────────────────────────────────
  // AGENT-WORKER RELATIONSHIPS
  // ──────────────────────────────────────────────────

  async requestWorkerAccess(
    agentUserId: string,
    params: string | { workerPhone?: string; workerId?: string; consentConfirmed?: boolean }
  ): Promise<AgentWorkerRelationshipResponse> {
    // 1. Resolve agent profile
    const agentRes = await query(`SELECT id FROM agent_profiles WHERE user_id = $1`, [agentUserId]);
    const agent = agentRes.rows[0];
    if (!agent) throw new AppError("Agent profile not found", 404);

    let worker: { worker_id: string; user_id: string; full_name: string; phone: string } | undefined;
    const workerPhone = typeof params === "string" ? params : params.workerPhone;
    const workerId = typeof params === "object" ? params.workerId : undefined;
    const consentConfirmed = typeof params === "object" ? params.consentConfirmed : undefined;

    // 2. Find worker by phone or ID
    if (workerPhone) {
      const userRes = await query<{ id: string }>(`SELECT id FROM users WHERE phone = $1`, [workerPhone]);
      if (userRes.rows[0]?.id === agentUserId) {
        throw new AppError("You cannot establish an agent-worker relationship with yourself", 400, ErrorCode.VALIDATION_ERROR);
      }

      const workerRes = await query<{ worker_id: string; user_id: string; full_name: string; phone: string }>(
        `SELECT wp.id AS worker_id, u.id AS user_id, u.full_name, u.phone
         FROM users u
         JOIN worker_profiles wp ON wp.user_id = u.id
         WHERE u.phone = $1 AND u.role = 'WORKER'`,
        [workerPhone]
      );
      worker = workerRes.rows[0];
      if (!worker) throw new AppError("No worker found with this phone number", 404);
    } else if (workerId) {
      const wpUserRes = await query<{ user_id: string }>(`SELECT user_id FROM worker_profiles WHERE id = $1`, [workerId]);
      if (wpUserRes.rows[0]?.user_id === agentUserId) {
        throw new AppError("You cannot establish an agent-worker relationship with yourself", 400, ErrorCode.VALIDATION_ERROR);
      }

      const workerRes = await query<{ worker_id: string; user_id: string; full_name: string; phone: string }>(
        `SELECT wp.id AS worker_id, u.id AS user_id, u.full_name, u.phone
         FROM worker_profiles wp
         JOIN users u ON wp.user_id = u.id
         WHERE wp.id = $1 AND u.role = 'WORKER'`,
        [workerId]
      );
      worker = workerRes.rows[0];
      if (!worker) throw new AppError("No worker found with this ID", 404);
    } else {
      throw new AppError("Either workerPhone or workerId must be provided", 400);
    }

    // 2.5 Prevent self-relationship
    if (worker.user_id === agentUserId) {
      throw new AppError("You cannot establish an agent-worker relationship with yourself", 400, ErrorCode.VALIDATION_ERROR);
    }

    // 3. Check existing relationship
    const existingRes = await query(
      `SELECT id, status FROM agent_worker_relationships WHERE agent_id = $1 AND worker_id = $2`,
      [agent.id, worker.worker_id]
    );
    const existing = existingRes.rows[0];
    if (existing) {
      if (existing.status === "ACTIVE") throw new AppError("You already have active access to this worker", 400);
      if (existing.status === "PENDING") throw new AppError("Access request already pending for this worker", 400);
      // REVOKED → allow re-request by updating back to PENDING
      await query(
        `UPDATE agent_worker_relationships SET status = 'PENDING', requested_at = NOW(), accepted_at = NULL, revoked_at = NULL, revoked_by = NULL, updated_at = NOW() WHERE id = $1`,
        [existing.id]
      );
    } else {
      await query(
        `INSERT INTO agent_worker_relationships (agent_id, worker_id, status) VALUES ($1, $2, 'PENDING')`,
        [agent.id, worker.worker_id]
      );
    }

    // 4. Create notification for worker
    await query(
      `INSERT INTO notifications (recipient_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)`,
      [
        worker.user_id,
        "AGENT_ACCESS_REQUEST",
        "Agent Access Request",
        `A local agent wants to assist you with finding work on NEARVIA. You can accept or decline this request.`,
        JSON.stringify({ agentUserId, consentConfirmed: !!consentConfirmed }),
      ]
    );

    // 5. Audit
    await this.recordAudit(
      agent.id,
      worker.worker_id,
      null,
      "ACCESS_REQUESTED",
      `Requested access for worker ${worker.worker_id} (consentConfirmed: ${!!consentConfirmed})`
    );

    // 6. Return the relationship
    return this.getRelationship(agent.id, worker.worker_id);
  }

  async getMyWorkers(agentUserId: string): Promise<AgentWorkerRelationshipResponse[]> {
    const agentRes = await query(`SELECT id FROM agent_profiles WHERE user_id = $1`, [agentUserId]);
    const agent = agentRes.rows[0];
    if (!agent) throw new AppError("Agent profile not found", 404);

    const res = await query(
      `SELECT awr.id, awr.agent_id, awr.worker_id, awr.status, awr.requested_at, awr.accepted_at, awr.revoked_at,
              u.id AS worker_user_id, u.full_name AS worker_full_name, u.phone AS worker_phone
       FROM agent_worker_relationships awr
       JOIN worker_profiles wp ON awr.worker_id = wp.id
       JOIN users u ON wp.user_id = u.id
       WHERE awr.agent_id = $1
       ORDER BY awr.requested_at DESC`,
      [agent.id]
    );

    return res.rows.map((r) => ({
      id: r.id,
      agentId: r.agent_id,
      workerId: r.worker_id,
      workerUserId: r.worker_user_id,
      workerFullName: r.worker_full_name,
      workerPhone: r.worker_phone,
      status: r.status,
      requestedAt: r.requested_at,
      acceptedAt: r.accepted_at,
      revokedAt: r.revoked_at,
    }));
  }

  async revokeWorkerAccess(agentUserId: string, workerId: string): Promise<void> {
    const agentRes = await query(`SELECT id FROM agent_profiles WHERE user_id = $1`, [agentUserId]);
    const agent = agentRes.rows[0];
    if (!agent) throw new AppError("Agent profile not found", 404);

    const res = await query(
      `UPDATE agent_worker_relationships SET status = 'REVOKED', revoked_at = NOW(), revoked_by = 'AGENT', updated_at = NOW()
       WHERE agent_id = $1 AND worker_id = $2 AND status IN ('ACTIVE', 'PENDING')
       RETURNING id`,
      [agent.id, workerId]
    );
    if (res.rowCount === 0) throw new AppError("No active or pending relationship found to revoke", 400);

    await this.recordAudit(agent.id, workerId, null, "ACCESS_REVOKED_BY_AGENT", "Agent revoked access");
  }

  // ──────────────────────────────────────────────────
  // ASSISTED WORKER VIEW
  // ──────────────────────────────────────────────────

  async getWorkerForAgent(agentUserId: string, workerId: string): Promise<AssistedWorkerDetail> {
    await this.enforceActiveConsent(agentUserId, workerId);

    const res = await query(
      `SELECT wp.id AS worker_id, wp.user_id AS worker_user_id, u.full_name, u.phone,
              wp.bio, wp.experience_years, wp.address_approximate, wp.service_radius_km,
              wp.availability_status, wp.is_available_now,
              wp.average_rating, wp.total_ratings_count, wp.completed_tasks_count
       FROM worker_profiles wp
       JOIN users u ON wp.user_id = u.id
       WHERE wp.id = $1`,
      [workerId]
    );
    const row = res.rows[0];
    if (!row) throw new AppError("Worker not found", 404);

    // Fetch skills
    const skillsRes = await query(
      `SELECT ws.skill_id, s.name AS skill_name, c.name AS category_name, ws.years_experience
       FROM worker_skills ws
       JOIN skills s ON ws.skill_id = s.id
       JOIN categories c ON s.category_id = c.id
       WHERE ws.worker_id = $1
       ORDER BY s.name`,
      [workerId]
    );

    await this.recordAudit(
      await this.getAgentProfileId(agentUserId), workerId, null,
      "PROFILE_VIEWED", "Agent viewed worker profile"
    );

    return {
      workerId: row.worker_id,
      workerUserId: row.worker_user_id,
      fullName: row.full_name,
      phone: row.phone,
      bio: row.bio,
      experienceYears: parseFloat(row.experience_years) || 0,
      addressApproximate: row.address_approximate,
      serviceRadiusKm: parseFloat(row.service_radius_km) || 5,
      availabilityStatus: row.availability_status,
      isAvailableNow: row.is_available_now,
      averageRating: parseFloat(row.average_rating) || 5,
      totalRatingsCount: parseInt(row.total_ratings_count, 10) || 0,
      completedTasksCount: parseInt(row.completed_tasks_count, 10) || 0,
      skills: skillsRes.rows.map((s) => ({
        skillId: s.skill_id,
        skillName: s.skill_name,
        categoryName: s.category_name,
        yearsExperience: parseFloat(s.years_experience) || 0,
      })),
    };
  }

  // ──────────────────────────────────────────────────
  // ASSISTED DISCOVERY (reuses Phase 7 discovery)
  // ──────────────────────────────────────────────────

  async getWorkForWorker(agentUserId: string, workerId: string, queryParams: Record<string, string>): Promise<unknown> {
    await this.enforceActiveConsent(agentUserId, workerId);

    // Resolve worker's location to use as search center
    const locRes = await query(
      `SELECT ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude, service_radius_km
       FROM worker_profiles WHERE id = $1`,
      [workerId]
    );
    const loc = locRes.rows[0];
    if (!loc || loc.latitude === null) throw new AppError("Worker location not configured", 400);

    // Import and use discovery service
    const { discoveryService } = await import("../jobs/discovery.service");
    const workerRes = await query(`SELECT user_id FROM worker_profiles WHERE id = $1`, [workerId]);
    const workerUserId = workerRes.rows[0]?.user_id;

    const result = await discoveryService.discoverNearbyWork(workerUserId, {
      latitude: loc.latitude,
      longitude: loc.longitude,
      radiusKm: parseFloat(loc.service_radius_km) || 5,
      page: queryParams.page ? parseInt(queryParams.page, 10) : 1,
      limit: queryParams.limit ? parseInt(queryParams.limit, 10) : 20,
      workType: queryParams.workType as any,
      categoryId: queryParams.category || queryParams.categoryId,
      search: queryParams.search,
      sort: queryParams.sort as any,
      minPayment: queryParams.minPayment ? parseFloat(queryParams.minPayment) : undefined,
      maxPayment: queryParams.maxPayment ? parseFloat(queryParams.maxPayment) : undefined,
      urgency: queryParams.urgency as any,
      dateFilter: queryParams.dateFilter as any,
      durationFilter: queryParams.durationFilter as any,
    });

    await this.recordAudit(
      await this.getAgentProfileId(agentUserId), workerId, null,
      "WORK_SEARCHED", `Agent searched work for worker`
    );

    return result;
  }

  // ──────────────────────────────────────────────────
  // ASSISTED APPLICATION (reuses Phase 9 applications)
  // ──────────────────────────────────────────────────

  async submitAssistedApplication(
    agentUserId: string,
    workerId: string,
    workOpportunityId: string,
    proposedWage?: number,
    workerNotes?: string,
    consentConfirmed?: boolean
  ): Promise<unknown> {
    await this.enforceActiveConsent(agentUserId, workerId);

    if (consentConfirmed !== true) {
      throw new AppError(
        "Worker consent confirmation is required before submitting an application on their behalf",
        400,
        ErrorCode.VALIDATION_ERROR
      );
    }

    const agentProfileId = await this.getAgentProfileId(agentUserId);

    // Resolve worker user ID
    const workerRes = await query(`SELECT user_id FROM worker_profiles WHERE id = $1`, [workerId]);
    const workerUserId = workerRes.rows[0]?.user_id;
    if (!workerUserId) throw new AppError("Worker not found", 404);

    // Use the applications service to submit the application as the WORKER
    const { applicationsService } = await import("../applications/service");
    const application = await applicationsService.applyForWork(
      workerUserId,
      workOpportunityId,
      { proposedWage, workerNotes }
    );

    // Tag with assisted_by_agent_id
    await query(
      `UPDATE applications SET assisted_by_agent_id = $1 WHERE id = $2`,
      [agentProfileId, application.id]
    );

    // Notify worker
    const agentUserRes = await query(`SELECT full_name FROM users WHERE id = $1`, [agentUserId]);
    const agentName = agentUserRes.rows[0]?.full_name || "An agent";

    await query(
      `INSERT INTO notifications (recipient_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)`,
      [
        workerUserId,
        "AGENT_ASSISTED_APPLICATION",
        "Application Submitted on Your Behalf",
        `${agentName} has submitted a work application for you. You can view it in your applications.`,
        JSON.stringify({ workOpportunityId, agentUserId, consentConfirmed: !!consentConfirmed }),
      ]
    );

    // Audit
    await this.recordAudit(
      agentProfileId,
      workerId,
      workOpportunityId,
      "APPLICATION_ASSISTED",
      `Agent submitted application for work ${workOpportunityId} (consentConfirmed: ${!!consentConfirmed})`
    );

    return application;
  }

  // ──────────────────────────────────────────────────
  // WORKER APPLICATIONS & ASSIGNMENTS (read-only for agent)
  // ──────────────────────────────────────────────────

  async getWorkerApplications(agentUserId: string, workerId: string): Promise<unknown[]> {
    await this.enforceActiveConsent(agentUserId, workerId);

    const res = await query(
      `SELECT a.id, a.work_opportunity_id, a.status, a.proposed_wage, a.worker_notes,
              a.applied_at, a.responded_at, a.assisted_by_agent_id,
              wo.title, wo.work_type, wo.urgency, wo.work_date, wo.payment_amount, wo.address_approximate
       FROM applications a
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       WHERE a.worker_id = $1
       ORDER BY a.applied_at DESC
       LIMIT 50`,
      [workerId]
    );

    await this.recordAudit(
      await this.getAgentProfileId(agentUserId), workerId, null,
      "APPLICATION_STATUS_VIEWED", "Agent viewed worker applications"
    );

    return res.rows.map((r) => ({
      id: r.id,
      workOpportunityId: r.work_opportunity_id,
      status: r.status,
      proposedWage: r.proposed_wage,
      workerNotes: r.worker_notes,
      appliedAt: r.applied_at,
      respondedAt: r.responded_at,
      assisted: !!r.assisted_by_agent_id,
      opportunityTitle: r.title,
      workType: r.work_type,
      urgency: r.urgency,
      workDate: r.work_date,
      paymentAmount: r.payment_amount,
      address: r.address_approximate,
    }));
  }

  async getWorkerAssignments(agentUserId: string, workerId: string): Promise<unknown[]> {
    await this.enforceActiveConsent(agentUserId, workerId);

    const res = await query(
      `SELECT a.id, a.status, a.assigned_at, a.agreed_wage,
              wo.title, wo.work_type, wo.work_date, wo.start_time, wo.end_time, wo.address_approximate
       FROM assignments a
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       WHERE a.worker_id = $1
       ORDER BY a.assigned_at DESC
       LIMIT 50`,
      [workerId]
    );

    await this.recordAudit(
      await this.getAgentProfileId(agentUserId), workerId, null,
      "ASSIGNMENT_STATUS_VIEWED", "Agent viewed worker assignments"
    );

    return res.rows.map((r) => ({
      id: r.id,
      status: r.status,
      assignedAt: r.assigned_at,
      agreedWage: r.agreed_wage,
      opportunityTitle: r.title,
      workType: r.work_type,
      workDate: r.work_date,
      startTime: r.start_time,
      endTime: r.end_time,
      address: r.address_approximate,
    }));
  }

  async getJobDetailForWorker(
    agentUserId: string,
    workerId: string,
    jobId: string
  ): Promise<AssistedJobDetailResponse> {
    await this.enforceActiveConsent(agentUserId, workerId);

    const res = await query(
      `SELECT wo.id, wo.title, wo.description, wo.work_type, c.name AS category_name,
              wo.urgency, wo.work_date, wo.start_time, wo.end_time, wo.duration_hours,
              wo.payment_amount, wo.payment_type, wo.workers_needed, wo.workers_assigned,
              wo.address_approximate, wo.instructions AS special_instructions,
              pp.business_name AS provider_business_name, pp.average_rating AS provider_rating
       FROM work_opportunities wo
       JOIN categories c ON wo.category_id = c.id
       JOIN provider_profiles pp ON wo.provider_id = pp.id
       WHERE wo.id = $1 AND wo.status IN ('PUBLISHED', 'PARTIALLY_FILLED')`,
      [jobId]
    );
    const row = res.rows[0];
    if (!row) {
      throw new AppError("Work opportunity not found or no longer active", 404, ErrorCode.NOT_FOUND);
    }

    const agentProfileId = await this.getAgentProfileId(agentUserId);
    await this.recordAudit(
      agentProfileId,
      workerId,
      jobId,
      "JOB_DETAIL_EXPLAINED",
      `Agent reviewed job details to explain to worker: ${row.title}`
    );

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      workType: row.work_type,
      categoryName: row.category_name,
      urgency: row.urgency,
      workDate: row.work_date,
      startTime: row.start_time,
      endTime: row.end_time,
      durationHours: parseFloat(row.duration_hours) || 0,
      paymentAmount: parseFloat(row.payment_amount) || 0,
      paymentType: row.payment_type,
      requiredWorkers: row.workers_needed,
      assignedWorkersCount: row.workers_assigned,
      addressApproximate: row.address_approximate,
      providerBusinessName: row.provider_business_name,
      providerRating: parseFloat(row.provider_rating) || 5.0,
      specialInstructions: row.special_instructions,
    };
  }

  async getAssignmentDetailForWorker(
    agentUserId: string,
    workerId: string,
    assignmentId: string
  ): Promise<AssistedAssignmentDetailResponse> {
    await this.enforceActiveConsent(agentUserId, workerId);

    const res = await query(
      `SELECT a.id, a.status, a.assigned_at, a.agreed_wage,
              wo.id AS work_opportunity_id, wo.title, wo.work_type, wo.work_date,
              wo.start_time, wo.end_time, wo.address_approximate,
              a.checked_in_at, a.completed_at
       FROM assignments a
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       WHERE a.id = $1 AND a.worker_id = $2`,
      [assignmentId, workerId]
    );
    const row = res.rows[0];
    if (!row) {
      throw new AppError("Assignment not found for this assisted worker", 404, ErrorCode.ASSIGNMENT_NOT_FOUND);
    }

    const agentProfileId = await this.getAgentProfileId(agentUserId);
    await this.recordAudit(
      agentProfileId,
      workerId,
      row.work_opportunity_id,
      "ASSIGNMENT_COORDINATION_VIEWED",
      `Agent coordinated assignment schedule: ${row.title} (${row.status})`
    );

    let coordinationNotes = "Assist worker to arrive 15 minutes prior to scheduled start time.";
    if (row.status === "COMPLETED") {
      coordinationNotes = "Shift completed. Help worker verify receipt of cash or digital payment.";
    } else if (row.status === "CHECKED_IN") {
      coordinationNotes = "Worker is currently checked in and on site.";
    }

    return {
      id: row.id,
      status: row.status,
      assignedAt: row.assigned_at,
      confirmedAt: row.checked_in_at ? row.assigned_at : null,
      agreedWage: parseFloat(row.agreed_wage) || 0,
      workOpportunityId: row.work_opportunity_id,
      opportunityTitle: row.title,
      workType: row.work_type,
      workDate: row.work_date,
      startTime: row.start_time,
      endTime: row.end_time,
      addressApproximate: row.address_approximate,
      checkInWindowMinutes: 30,
      checkInDistanceMeters: null,
      attendanceStatus: row.checked_in_at ? "CHECKED_IN" : "PENDING",
      coordinationNotes,
    };
  }

  // ──────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ──────────────────────────────────────────────────

  /** Enforces that an ACTIVE agent_worker_relationship exists. */
  private async enforceActiveConsent(agentUserId: string, workerId: string): Promise<void> {
    const agentRes = await query(`SELECT id FROM agent_profiles WHERE user_id = $1`, [agentUserId]);
    const agent = agentRes.rows[0];
    if (!agent) throw new AppError("Agent profile not found", 404);

    const relRes = await query(
      `SELECT status FROM agent_worker_relationships WHERE agent_id = $1 AND worker_id = $2`,
      [agent.id, workerId]
    );
    const rel = relRes.rows[0];
    if (!rel || rel.status !== "ACTIVE") {
      throw new AppError("You do not have active consent to access this worker's data", 403, ErrorCode.FORBIDDEN);
    }
  }

  /** Resolves agent_profiles.id from users.id */
  private async getAgentProfileId(agentUserId: string): Promise<string> {
    const res = await query(`SELECT id FROM agent_profiles WHERE user_id = $1`, [agentUserId]);
    const row = res.rows[0];
    if (!row) throw new AppError("Agent profile not found", 404);
    return row.id;
  }

  /** Records an audit entry in audit_logs */
  private async recordAudit(
    agentProfileIdOrUserId: string,
    workerId: string,
    workOpportunityId: string | null,
    interactionType: string,
    notes: string
  ): Promise<void> {
    try {
      let actorUserId = agentProfileIdOrUserId;
      const uRes = await query(`SELECT id FROM users WHERE id = $1`, [agentProfileIdOrUserId]);
      if (uRes.rows.length === 0) {
        const apRes = await query(`SELECT user_id FROM agent_profiles WHERE id = $1`, [agentProfileIdOrUserId]);
        if (apRes.rows[0]) {
          actorUserId = apRes.rows[0].user_id;
        }
      }

      await logAuditEvent({
        actorId: actorUserId,
        action: `AGENT_${interactionType}`,
        targetEntity: "agent_worker_relationships",
        targetId: workerId,
        newValues: { workOpportunityId, notes },
      });
    } catch {
      // Fallback
    }
  }

  /** Resolves relationship object */
  private async getRelationship(agentId: string, workerId: string): Promise<AgentWorkerRelationshipResponse> {
    const res = await query(
      `SELECT awr.id, awr.agent_id, awr.worker_id, awr.status, awr.requested_at, awr.accepted_at, awr.revoked_at,
              u.id AS worker_user_id, u.full_name AS worker_full_name, u.phone AS worker_phone
       FROM agent_worker_relationships awr
       JOIN worker_profiles wp ON awr.worker_id = wp.id
       JOIN users u ON wp.user_id = u.id
       WHERE awr.agent_id = $1 AND awr.worker_id = $2`,
      [agentId, workerId]
    );
    const row = res.rows[0];
    if (!row) throw new AppError("Relationship not found", 404);
    return {
      id: row.id,
      agentId: row.agent_id,
      workerId: row.worker_id,
      workerUserId: row.worker_user_id,
      workerFullName: row.worker_full_name,
      workerPhone: row.worker_phone,
      status: row.status,
      requestedAt: row.requested_at,
      acceptedAt: row.accepted_at,
      revokedAt: row.revoked_at,
    };
  }
}

export const agentsService = new AgentsService();
