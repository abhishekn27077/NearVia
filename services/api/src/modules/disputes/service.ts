/**
 * Disputes Service (Phase 15)
 * Formal Transaction & Work Fulfillment Dispute Management
 */

import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";
import { logAuditEvent } from "../../utils/audit";
import {
  CreateDisputeInput,
  UpdateDisputeStatusInput,
  DisputeRecord,
  IDisputesState,
} from "./types";

export class DisputesService {
  /**
   * Module Status
   */
  public async getStatus(): Promise<IDisputesState> {
    return {
      module: "disputes",
      status: "initialized",
      description: "Dispute resolution, mediation workflows, and evidence management",
    };
  }

  /**
   * Create a formal dispute against a legitimate assignment.
   */
  public async createDispute(
    initiatorUserId: string,
    data: CreateDisputeInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<DisputeRecord> {
    // 1. Fetch assignment and participants
    const asgRes = await query(
      `SELECT 
        a.id,
        a.status AS assignment_status,
        a.agreed_wage,
        a.payment_status,
        wo.id AS work_opportunity_id,
        wo.title AS opportunity_title,
        wo.work_type,
        wp.user_id AS worker_user_id,
        pp.user_id AS provider_user_id
       FROM assignments a
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       JOIN worker_profiles wp ON a.worker_id = wp.id
       JOIN provider_profiles pp ON a.provider_id = pp.id
       WHERE a.id = $1`,
      [data.assignmentId]
    );

    const asg = asgRes.rows[0];
    if (!asg) {
      throw new AppError("Assignment not found", 404, ErrorCode.ASSIGNMENT_NOT_FOUND);
    }

    // 2. Validate initiator is a legitimate participant
    const isWorker = asg.worker_user_id === initiatorUserId;
    const isProvider = asg.provider_user_id === initiatorUserId;

    if (!isWorker && !isProvider) {
      throw new AppError(
        "You are not a participant in this assignment and cannot open a dispute",
        403,
        ErrorCode.FORBIDDEN
      );
    }

    const respondentUserId = isWorker ? asg.provider_user_id : asg.worker_user_id;

    // 3. Anti-abuse: Check for active duplicate dispute
    const activeCheck = await query(
      `SELECT id FROM disputes 
       WHERE assignment_id = $1 AND initiator_id = $2 AND status IN ('OPEN', 'UNDER_REVIEW')`,
      [data.assignmentId, initiatorUserId]
    );

    if (activeCheck.rowCount && activeCheck.rowCount > 0) {
      throw new AppError(
        "An active dispute is already open for this assignment by you",
        409,
        ErrorCode.CONFLICT
      );
    }

    // 4. Create dispute record
    const res = await query(
      `INSERT INTO disputes (
        assignment_id, initiator_id, respondent_id, reason, description, evidence_urls, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')
      RETURNING *`,
      [
        data.assignmentId,
        initiatorUserId,
        respondentUserId,
        data.reason,
        data.description,
        data.evidenceUrls || [],
      ]
    );

    const row = res.rows[0];
    if (!row) throw new AppError("Failed to create dispute", 500, ErrorCode.INTERNAL_SERVER_ERROR);

    // 5. Immutable Audit Log
    await logAuditEvent({
      actorId: initiatorUserId,
      action: "DISPUTE_OPENED",
      targetEntity: "disputes",
      targetId: row.id,
      newValues: {
        assignmentId: data.assignmentId,
        reason: data.reason,
        respondentId: respondentUserId,
      },
      ipAddress,
      userAgent,
    });

    // 6. Notify Respondent
    await query(
      `INSERT INTO notifications (recipient_id, type, title, message, data)
       VALUES ($1, 'DISPUTE_OPENED', 'Dispute Opened on Work Assignment', $2, $3)`,
      [
        respondentUserId,
        `A dispute was opened regarding '${asg.opportunity_title}' (${data.reason.replace(/_/g, " ")}). Our moderation team will review the issue.`,
        JSON.stringify({ disputeId: row.id, assignmentId: data.assignmentId, reason: data.reason }),
      ]
    );

    return this.mapRowToDispute(row, asg);
  }

  /**
   * Get all disputes where user is either the initiator or respondent.
   */
  public async getMyDisputes(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<{ disputes: DisputeRecord[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;

    const countRes = await query(
      `SELECT COUNT(*) FROM disputes WHERE initiator_id = $1 OR respondent_id = $1`,
      [userId]
    );
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    const res = await query(
      `SELECT 
        d.*,
        wo.id AS work_opportunity_id,
        wo.title AS opportunity_title,
        wo.work_type,
        a.agreed_wage,
        a.payment_status,
        ui.full_name AS initiator_name,
        ur.full_name AS respondent_name
       FROM disputes d
       JOIN assignments a ON d.assignment_id = a.id
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       JOIN users ui ON d.initiator_id = ui.id
       JOIN users ur ON d.respondent_id = ur.id
       WHERE d.initiator_id = $1 OR d.respondent_id = $1
       ORDER BY d.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      disputes: res.rows.map((r) => this.mapRowToDispute(r, r)),
      total,
      page,
      limit,
    };
  }

  /**
   * Get dispute details by ID (Accessible by Initiator, Respondent, or ADMIN).
   */
  public async getDisputeById(
    userId: string,
    userRole: string,
    disputeId: string
  ): Promise<DisputeRecord> {
    const res = await query(
      `SELECT 
        d.*,
        wo.id AS work_opportunity_id,
        wo.title AS opportunity_title,
        wo.work_type,
        a.agreed_wage,
        a.payment_status,
        ui.full_name AS initiator_name,
        ur.full_name AS respondent_name
       FROM disputes d
       JOIN assignments a ON d.assignment_id = a.id
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       JOIN users ui ON d.initiator_id = ui.id
       JOIN users ur ON d.respondent_id = ur.id
       WHERE d.id = $1`,
      [disputeId]
    );

    const row = res.rows[0];
    if (!row) {
      throw new AppError("Dispute not found", 404, ErrorCode.NOT_FOUND);
    }

    // Access check: Initiator, Respondent, or ADMIN
    const isParticipant = row.initiator_id === userId || row.respondent_id === userId;
    if (!isParticipant && userRole !== "ADMIN") {
      throw new AppError("You are not authorized to view this dispute", 403, ErrorCode.FORBIDDEN);
    }

    return this.mapRowToDispute(row, row);
  }

  /**
   * Admin: List all platform disputes.
   */
  public async getAllDisputes(
    page = 1,
    limit = 20,
    status?: string
  ): Promise<{ disputes: DisputeRecord[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      params.push(status);
      conditions.push(`d.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) FROM disputes d ${whereClause}`, params);
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    params.push(limit, offset);
    const res = await query(
      `SELECT 
        d.*,
        wo.id AS work_opportunity_id,
        wo.title AS opportunity_title,
        wo.work_type,
        a.agreed_wage,
        a.payment_status,
        ui.full_name AS initiator_name,
        ur.full_name AS respondent_name
       FROM disputes d
       JOIN assignments a ON d.assignment_id = a.id
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       JOIN users ui ON d.initiator_id = ui.id
       JOIN users ur ON d.respondent_id = ur.id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      disputes: res.rows.map((r) => this.mapRowToDispute(r, r)),
      total,
      page,
      limit,
    };
  }

  /**
   * Admin: Update dispute status (UNDER_REVIEW, RESOLVED, REJECTED) and resolution notes.
   */
  public async updateDisputeStatus(
    adminUserId: string,
    disputeId: string,
    input: UpdateDisputeStatusInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<DisputeRecord> {
    const existing = await query(`SELECT * FROM disputes WHERE id = $1`, [disputeId]);
    const oldRow = existing.rows[0];

    if (!oldRow) {
      throw new AppError("Dispute not found", 404, ErrorCode.NOT_FOUND);
    }

    const res = await query(
      `UPDATE disputes
       SET status = $1, resolution_notes = $2, resolved_by = $3, resolved_at = NOW(), updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [input.status, input.resolutionNotes, adminUserId, disputeId]
    );

    const updatedRow = res.rows[0];

    // Log Audit Event
    await logAuditEvent({
      actorId: adminUserId,
      action: "DISPUTE_MODERATION_UPDATED",
      targetEntity: "disputes",
      targetId: disputeId,
      oldValues: { status: oldRow.status, resolutionNotes: oldRow.resolution_notes },
      newValues: { status: input.status, resolutionNotes: input.resolutionNotes },
      ipAddress,
      userAgent,
    });

    // Notify both Initiator & Respondent
    const notifyMessage = `Dispute regarding your assignment has been marked '${input.status}'. Resolution notes: ${input.resolutionNotes}`;
    const notifyData = JSON.stringify({ disputeId, status: input.status, resolutionNotes: input.resolutionNotes });

    await query(
      `INSERT INTO notifications (recipient_id, type, title, message, data)
       VALUES 
         ($1, 'DISPUTE_RESOLVED', 'Dispute Status Update', $3, $4),
         ($2, 'DISPUTE_RESOLVED', 'Dispute Status Update', $3, $4)`,
      [oldRow.initiator_id, oldRow.respondent_id, notifyMessage, notifyData]
    );

    return this.mapRowToDispute(updatedRow);
  }

  private mapRowToDispute(row: any, extra?: any): DisputeRecord {
    return {
      id: row.id,
      assignmentId: row.assignment_id,
      initiatorId: row.initiator_id,
      respondentId: row.respondent_id,
      reason: row.reason,
      description: row.description,
      evidenceUrls: row.evidence_urls || [],
      status: row.status,
      resolutionNotes: row.resolution_notes || null,
      resolvedBy: row.resolved_by || null,
      resolvedAt: row.resolved_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      workOpportunityId: extra?.work_opportunity_id || row.work_opportunity_id,
      opportunityTitle: extra?.opportunity_title || row.opportunity_title,
      workType: extra?.work_type || row.work_type,
      agreedWage: extra?.agreed_wage ? Number(extra.agreed_wage) : undefined,
      paymentStatus: extra?.payment_status || row.payment_status,
      initiatorName: extra?.initiator_name || row.initiator_name,
      respondentName: extra?.respondent_name || row.respondent_name,
    };
  }
}

export const disputesService = new DisputesService();
