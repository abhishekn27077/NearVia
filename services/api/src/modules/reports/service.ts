/**
 * Reports Service (Phase 15)
 * Content & Conduct Moderation, Safety Incident Reporting
 */

import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";
import { logAuditEvent } from "../../utils/audit";
import {
  SubmitReportInput,
  UpdateReportStatusInput,
  ReportRecord,
  ReportTargetType,
} from "./types";

export class ReportsService {
  /**
   * Submit a new platform report with target existence and anti-abuse validation.
   */
  public async submitReport(
    reporterId: string,
    data: SubmitReportInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ReportRecord> {
    // 1. Prevent self-reporting
    if (data.targetType === "USER" && data.targetId === reporterId) {
      throw new AppError("You cannot report yourself", 400, ErrorCode.VALIDATION_ERROR);
    }

    // 2. Validate target existence
    await this.validateTargetExistence(data.targetType, data.targetId, reporterId);

    // 3. Anti-abuse: Check if user already submitted an OPEN or UNDER_REVIEW report for this target
    const existingActive = await query(
      `SELECT id FROM reports 
       WHERE reporter_id = $1 AND target_type = $2 AND target_id = $3 AND status IN ('OPEN', 'UNDER_REVIEW')`,
      [reporterId, data.targetType, data.targetId]
    );

    if (existingActive.rowCount && existingActive.rowCount > 0) {
      throw new AppError(
        "You already have an active report under review for this target",
        409,
        ErrorCode.CONFLICT
      );
    }

    // 4. Insert report
    const res = await query(
      `INSERT INTO reports (
        reporter_id, target_type, target_id, category, reason, description, evidence_urls, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN')
      RETURNING *`,
      [
        reporterId,
        data.targetType,
        data.targetId,
        data.category,
        data.reason,
        data.description || null,
        data.evidenceUrls || [],
      ]
    );

    const row = res.rows[0];
    if (!row) throw new AppError("Failed to submit report", 500, ErrorCode.INTERNAL_SERVER_ERROR);

    // 5. Immutable Audit Log
    await logAuditEvent({
      actorId: reporterId,
      action: "REPORT_SUBMITTED",
      targetEntity: "reports",
      targetId: row.id,
      newValues: {
        targetType: data.targetType,
        targetId: data.targetId,
        category: data.category,
        reason: data.reason,
      },
      ipAddress,
      userAgent,
    });

    return this.mapRowToReport(row);
  }

  /**
   * Get reports submitted by the authenticated user.
   */
  public async getMyReports(
    reporterId: string,
    page = 1,
    limit = 20
  ): Promise<{ reports: ReportRecord[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;

    const countRes = await query(
      `SELECT COUNT(*) FROM reports WHERE reporter_id = $1`,
      [reporterId]
    );
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    const res = await query(
      `SELECT * FROM reports 
       WHERE reporter_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [reporterId, limit, offset]
    );

    return {
      reports: res.rows.map((r) => this.mapRowToReport(r)),
      total,
      page,
      limit,
    };
  }

  /**
   * Get single report by ID (Accessible by Reporter or Admin).
   */
  public async getReportById(
    userId: string,
    userRole: string,
    reportId: string
  ): Promise<ReportRecord> {
    const res = await query(`SELECT * FROM reports WHERE id = $1`, [reportId]);
    const row = res.rows[0];

    if (!row) {
      throw new AppError("Report not found", 404, ErrorCode.NOT_FOUND);
    }

    // Access check: Only reporter or ADMIN can view
    if (row.reporter_id !== userId && userRole !== "ADMIN") {
      throw new AppError("You are not authorized to view this report", 403, ErrorCode.FORBIDDEN);
    }

    return this.mapRowToReport(row);
  }

  /**
   * Admin: List all platform reports.
   */
  public async getAllReports(
    page = 1,
    limit = 20,
    status?: string,
    targetType?: string
  ): Promise<{ reports: ReportRecord[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (targetType) {
      params.push(targetType);
      conditions.push(`target_type = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) FROM reports ${whereClause}`, params);
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    params.push(limit, offset);
    const res = await query(
      `SELECT r.*, u.full_name AS reporter_name, u.phone AS reporter_phone
       FROM reports r
       LEFT JOIN users u ON r.reporter_id = u.id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      reports: res.rows.map((r) => this.mapRowToReport(r)),
      total,
      page,
      limit,
    };
  }

  /**
   * Admin: Update report status (UNDER_REVIEW, RESOLVED, DISMISSED) and record resolution.
   */
  public async updateReportStatus(
    adminUserId: string,
    reportId: string,
    input: UpdateReportStatusInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ReportRecord> {
    const existing = await query(`SELECT * FROM reports WHERE id = $1`, [reportId]);
    const oldRow = existing.rows[0];

    if (!oldRow) {
      throw new AppError("Report not found", 404, ErrorCode.NOT_FOUND);
    }

    const res = await query(
      `UPDATE reports
       SET status = $1, resolution = $2, reviewed_by = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [input.status, input.resolution, adminUserId, reportId]
    );

    const updatedRow = res.rows[0];

    // Log Audit Event
    await logAuditEvent({
      actorId: adminUserId,
      action: "REPORT_MODERATION_UPDATED",
      targetEntity: "reports",
      targetId: reportId,
      oldValues: { status: oldRow.status, resolution: oldRow.resolution },
      newValues: { status: input.status, resolution: input.resolution },
      ipAddress,
      userAgent,
    });

    // Notify Reporter of Resolution
    await query(
      `INSERT INTO notifications (recipient_id, type, title, message, data)
       VALUES ($1, 'REPORT_STATUS_UPDATED', 'Update on Your Platform Report', $2, $3)`,
      [
        oldRow.reporter_id,
        `Your report regarding ${oldRow.target_type} has been reviewed and updated to '${input.status}'.`,
        JSON.stringify({ reportId, status: input.status, resolution: input.resolution }),
      ]
    );

    return this.mapRowToReport(updatedRow);
  }

  /**
   * Helper to ensure the target entity actually exists.
   */
  private async validateTargetExistence(
    targetType: ReportTargetType,
    targetId: string,
    _reporterId: string
  ): Promise<void> {
    let tableName = "";
    switch (targetType) {
      case "USER":
        tableName = "users";
        break;
      case "WORK_OPPORTUNITY":
        tableName = "work_opportunities";
        break;
      case "ASSIGNMENT":
        tableName = "assignments";
        break;
      case "REVIEW":
        tableName = "reviews";
        break;
      default:
        throw new AppError("Invalid target type", 400, ErrorCode.VALIDATION_ERROR);
    }

    const check = await query(`SELECT id FROM ${tableName} WHERE id = $1`, [targetId]);
    if (!check.rowCount || check.rowCount === 0) {
      throw new AppError(
        `Target ${targetType} with ID ${targetId} was not found`,
        404,
        ErrorCode.NOT_FOUND
      );
    }
  }

  private mapRowToReport(row: any): ReportRecord {
    return {
      id: row.id,
      reporterId: row.reporter_id,
      targetType: row.target_type,
      targetId: row.target_id,
      category: row.category || undefined,
      reason: row.reason,
      description: row.description || undefined,
      evidenceUrls: row.evidence_urls || [],
      status: row.status,
      reviewedBy: row.reviewed_by || null,
      resolution: row.resolution || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const reportsService = new ReportsService();
