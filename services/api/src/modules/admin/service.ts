/**
 * Admin Service (Phase 16)
 * Platform oversight, user moderation, verification queues, and operational controls
 */

import { query, withTransaction } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";
import { UserRole } from "@nearvia/types";
import { logAuditEvent } from "../../utils/audit";
import {
  AdminDashboardMetrics,
  AdminUserListItem,
  AdminUserDetail,
  UpdateUserStatusInput,
  UpdateUserRoleInput,
  ApproveVerificationInput,
  RejectVerificationInput,
  ModerateWorkInput,
  IAdminState,
} from "./types";

export class AdminService {
  public async getStatus(): Promise<IAdminState> {
    return {
      module: "admin",
      status: "initialized",
      description: "Platform oversight, user moderation, verification queues, and operational controls",
    };
  }

  /**
   * 1. High-Level Operational Metrics
   */
  public async getDashboardMetrics(): Promise<AdminDashboardMetrics> {
    // Run parallel aggregate queries for high performance
    const [
      usersRes,
      workRes,
      asgRes,
      verifRes,
      reportsRes,
      disputesRes,
      paymentsRes,
      auditRes,
    ] = await Promise.all([
      // Users summary
      query(`
        SELECT 
          COUNT(*) AS total_users,
          COUNT(*) FILTER (WHERE role = 'WORKER') AS total_workers,
          COUNT(*) FILTER (WHERE role = 'PROVIDER') AS total_providers,
          COUNT(*) FILTER (WHERE role = 'AGENT') AS total_agents
        FROM users
      `),
      // Work opportunities summary
      query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'PUBLISHED') AS published_work,
          COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_work,
          (SELECT COUNT(*) FROM applications) AS total_applications
        FROM work_opportunities
      `),
      // Assignments summary
      query(`
        SELECT 
          COUNT(*) FILTER (WHERE status IN ('ASSIGNED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')) AS active_assignments,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_assignments
        FROM assignments
      `),
      // Verification queue
      query(`
        SELECT COUNT(*) AS pending_verifications
        FROM verifications
        WHERE status = 'PENDING'
      `),
      // Reports queue
      query(`
        SELECT COUNT(*) AS open_reports
        FROM reports
        WHERE status IN ('OPEN', 'UNDER_REVIEW')
      `),
      // Disputes queue
      query(`
        SELECT COUNT(*) AS open_disputes
        FROM disputes
        WHERE status IN ('OPEN', 'UNDER_REVIEW')
      `),
      // Payments summary
      query(`
        SELECT 
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'CONFIRMED'), 0) AS confirmed_paise,
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'CONFIRMED' AND payment_method = 'CASH'), 0) AS cash_paise,
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'CONFIRMED' AND (payment_method != 'CASH' OR payment_method IS NULL)), 0) AS sandbox_paise,
          COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_payments
        FROM payment_records
      `),
      // Recent audit activity
      query(`
        SELECT a.*, u.full_name AS actor_name
        FROM audit_logs a
        LEFT JOIN users u ON a.actor_id = u.id
        ORDER BY a.created_at DESC
        LIMIT 10
      `),
    ]);

    const uRow: any = usersRes.rows[0] || {};
    const wRow: any = workRes.rows[0] || {};
    const aRow: any = asgRes.rows[0] || {};
    const vRow: any = verifRes.rows[0] || {};
    const rRow: any = reportsRes.rows[0] || {};
    const dRow: any = disputesRes.rows[0] || {};
    const pRow: any = paymentsRes.rows[0] || {};

    const confirmedPaise = parseInt(pRow.confirmed_paise || "0", 10);
    const cashPaise = parseInt(pRow.cash_paise || "0", 10);
    const sandboxPaise = parseInt(pRow.sandbox_paise || "0", 10);

    return {
      totalUsers: parseInt(uRow.total_users || "0", 10),
      totalWorkers: parseInt(uRow.total_workers || "0", 10),
      totalProviders: parseInt(uRow.total_providers || "0", 10),
      totalAgents: parseInt(uRow.total_agents || "0", 10),
      publishedWorkCount: parseInt(wRow.published_work || "0", 10),
      cancelledWorkCount: parseInt(wRow.cancelled_work || "0", 10),
      totalApplicationsCount: parseInt(wRow.total_applications || "0", 10),
      activeAssignmentsCount: parseInt(aRow.active_assignments || "0", 10),
      completedAssignmentsCount: parseInt(aRow.completed_assignments || "0", 10),
      pendingVerificationsCount: parseInt(vRow.pending_verifications || "0", 10),
      openReportsCount: parseInt(rRow.open_reports || "0", 10),
      openDisputesCount: parseInt(dRow.open_disputes || "0", 10),
      confirmedPaymentsVolumePaise: confirmedPaise,
      confirmedPaymentsVolume: confirmedPaise / 100,
      cashSettledVolume: cashPaise / 100,
      sandboxSettledVolume: sandboxPaise / 100,
      pendingPaymentsCount: parseInt(pRow.pending_payments || "0", 10),
      recentAuditLogs: auditRes.rows.map((row) => ({
        id: row.id,
        actorId: row.actor_id,
        actorName: row.actor_name || "System",
        action: row.action,
        targetEntity: row.target_entity,
        targetId: row.target_id,
        oldValues: row.old_values,
        newValues: row.new_values,
        createdAt: row.created_at,
      })),
    };
  }

  /**
   * 2. User Management: Search, Filter, Paginate
   */
  public async getUsers(
    page = 1,
    limit = 20,
    search?: string,
    role?: string,
    status?: string
  ): Promise<{ users: AdminUserListItem[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(full_name ILIKE $${params.length} OR phone ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }

    if (role && role.trim()) {
      params.push(role.trim());
      conditions.push(`role = $${params.length}`);
    }

    if (status) {
      if (status === "ACTIVE") {
        conditions.push(`is_active = TRUE`);
      } else if (status === "SUSPENDED") {
        conditions.push(`is_active = FALSE`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) FROM users ${whereClause}`, params);
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    params.push(limit, offset);
    const res = await query(
      `SELECT id, phone, full_name, email, role, is_active, avatar_url, created_at, updated_at
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      users: res.rows.map((row) => ({
        id: row.id,
        phone: row.phone,
        fullName: row.full_name,
        email: row.email,
        role: row.role as UserRole,
        isActive: row.is_active !== false,
        avatarUrl: row.avatar_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * 3. Get User Detail with Profile Context
   */
  public async getUserById(userId: string): Promise<AdminUserDetail> {
    const userRes = await query(
      `SELECT id, phone, full_name, email, role, is_active, avatar_url, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );

    const user = userRes.rows[0];
    if (!user) {
      throw new AppError("User not found", 404, ErrorCode.NOT_FOUND);
    }

    const [workerRes, providerRes, agentRes, verifRes, asgCountRes] = await Promise.all([
      query(`SELECT * FROM worker_profiles WHERE user_id = $1`, [userId]),
      query(`SELECT * FROM provider_profiles WHERE user_id = $1`, [userId]),
      query(`SELECT * FROM agent_profiles WHERE user_id = $1`, [userId]),
      query(`SELECT * FROM verifications WHERE target_id = $1 ORDER BY created_at DESC`, [userId]),
      query(`
        SELECT 
          COUNT(*) AS assigned_count,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_count
        FROM assignments a
        JOIN worker_profiles wp ON a.worker_id = wp.id
        WHERE wp.user_id = $1
      `, [userId]),
    ]);

    const asgStats = asgCountRes.rows[0] || {};

    return {
      id: user.id,
      phone: user.phone,
      fullName: user.full_name,
      email: user.email,
      role: user.role as UserRole,
      isActive: user.is_active !== false,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      workerProfile: workerRes.rows[0] || null,
      providerProfile: providerRes.rows[0] || null,
      agentProfile: agentRes.rows[0] || null,
      verifications: verifRes.rows || [],
      assignedCount: parseInt(asgStats.assigned_count || "0", 10),
      completedCount: parseInt(asgStats.completed_count || "0", 10),
    };
  }

  /**
   * 4. Suspend / Activate User Account
   */
  public async updateUserStatus(
    adminId: string,
    targetUserId: string,
    input: UpdateUserStatusInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AdminUserListItem> {
    if (adminId === targetUserId && input.status === "SUSPENDED") {
      throw new AppError("You cannot suspend your own administrative account", 400, ErrorCode.VALIDATION_ERROR);
    }

    const targetUser = await query(`SELECT * FROM users WHERE id = $1`, [targetUserId]);
    const oldRow = targetUser.rows[0];
    if (!oldRow) {
      throw new AppError("User not found", 404, ErrorCode.NOT_FOUND);
    }

    const newIsActive = input.status === "ACTIVE";

    // Idempotency: Prevent duplicate state updates
    if (oldRow.is_active === newIsActive) {
      return {
        id: oldRow.id,
        phone: oldRow.phone,
        fullName: oldRow.full_name,
        email: oldRow.email,
        role: oldRow.role as UserRole,
        isActive: oldRow.is_active,
        avatarUrl: oldRow.avatar_url,
        createdAt: oldRow.created_at,
        updatedAt: oldRow.updated_at,
      };
    }

    const res = await query(
      `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newIsActive, targetUserId]
    );
    const updated = res.rows[0];
    if (!updated) {
      throw new AppError("Failed to update user status", 500, ErrorCode.INTERNAL_SERVER_ERROR);
    }

    // Log Audit Event
    await logAuditEvent({
      actorId: adminId,
      action: "USER_STATUS_UPDATED",
      targetEntity: "users",
      targetId: targetUserId,
      oldValues: { isActive: oldRow.is_active },
      newValues: { isActive: newIsActive, reason: input.reason },
      ipAddress,
      userAgent,
    });

    // Notify user
    const title = newIsActive ? "Account Reactivated" : "Account Suspended";
    const msg = newIsActive
      ? "Your NEARVIA account access has been restored."
      : `Your NEARVIA account has been suspended: ${input.reason}`;

    await query(
      `INSERT INTO notifications (recipient_id, type, title, message, data)
       VALUES ($1, 'ACCOUNT_STATUS_CHANGED', $2, $3, $4)`,
      [targetUserId, title, msg, JSON.stringify({ status: input.status, reason: input.reason })]
    );

    return {
      id: updated.id,
      phone: updated.phone,
      fullName: updated.full_name,
      email: updated.email,
      role: updated.role as UserRole,
      isActive: updated.is_active,
      avatarUrl: updated.avatar_url,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  }

  /**
   * 5. Change User Role (Controlled Administrative Action)
   */
  public async updateUserRole(
    adminId: string,
    targetUserId: string,
    input: UpdateUserRoleInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AdminUserListItem> {
    if (adminId === targetUserId && input.role !== UserRole.ADMIN) {
      throw new AppError(
        "You cannot demote your own administrative account to prevent platform lockout",
        400,
        ErrorCode.VALIDATION_ERROR
      );
    }

    const targetUser = await query(`SELECT * FROM users WHERE id = $1`, [targetUserId]);
    const oldRow = targetUser.rows[0];
    if (!oldRow) {
      throw new AppError("User not found", 404, ErrorCode.NOT_FOUND);
    }

    if (oldRow.role === input.role) {
      return {
        id: oldRow.id,
        phone: oldRow.phone,
        fullName: oldRow.full_name,
        email: oldRow.email,
        role: oldRow.role as UserRole,
        isActive: oldRow.is_active,
        avatarUrl: oldRow.avatar_url,
        createdAt: oldRow.created_at,
        updatedAt: oldRow.updated_at,
      };
    }

    const res = await query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [input.role, targetUserId]
    );
    const updated = res.rows[0];
    if (!updated) {
      throw new AppError("Failed to update user role", 500, ErrorCode.INTERNAL_SERVER_ERROR);
    }

    // Log Audit Event
    await logAuditEvent({
      actorId: adminId,
      action: "USER_ROLE_UPDATED",
      targetEntity: "users",
      targetId: targetUserId,
      oldValues: { role: oldRow.role },
      newValues: { role: input.role, reason: input.reason },
      ipAddress,
      userAgent,
    });

    return {
      id: updated.id,
      phone: updated.phone,
      fullName: updated.full_name,
      email: updated.email,
      role: updated.role as UserRole,
      isActive: updated.is_active,
      avatarUrl: updated.avatar_url,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  }

  /**
   * 6. Work Opportunities Moderation List
   */
  public async getWorkOpportunities(
    page = 1,
    limit = 20,
    status?: string,
    workType?: string,
    search?: string
  ): Promise<{ work: any[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(wo.title ILIKE $${params.length} OR wo.description ILIKE $${params.length})`);
    }

    if (status && status.trim()) {
      params.push(status.trim());
      conditions.push(`wo.status = $${params.length}`);
    }

    if (workType && workType.trim()) {
      params.push(workType.trim());
      conditions.push(`wo.work_type = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) FROM work_opportunities wo ${whereClause}`, params);
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    params.push(limit, offset);
    const res = await query(
      `SELECT 
        wo.*,
        c.name AS category_name,
        u.full_name AS provider_name,
        u.phone AS provider_phone,
        (SELECT COUNT(*) FROM applications a WHERE a.work_opportunity_id = wo.id) AS applications_count
       FROM work_opportunities wo
       JOIN categories c ON wo.category_id = c.id
       JOIN provider_profiles pp ON wo.provider_id = pp.id
       JOIN users u ON pp.user_id = u.id
       ${whereClause}
       ORDER BY wo.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      work: res.rows,
      total,
      page,
      limit,
    };
  }

  /**
   * 7. Moderate & Cancel Work Posting
   */
  public async moderateCancelWork(
    adminId: string,
    workId: string,
    input: ModerateWorkInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    const existing = await query(`SELECT * FROM work_opportunities WHERE id = $1`, [workId]);
    const oldRow = existing.rows[0];
    if (!oldRow) {
      throw new AppError("Work opportunity not found", 404, ErrorCode.NOT_FOUND);
    }

    if (oldRow.status === "CANCELLED") {
      return oldRow;
    }

    const res = await query(
      `UPDATE work_opportunities 
       SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [workId]
    );
    const updated = res.rows[0];

    // Log Audit Event
    await logAuditEvent({
      actorId: adminId,
      action: "WORK_OPPORTUNITY_MODERATED_CANCELLED",
      targetEntity: "work_opportunities",
      targetId: workId,
      oldValues: { status: oldRow.status },
      newValues: { status: "CANCELLED", reason: input.reason },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  /**
   * 8. Verification Queue List
   */
  public async getVerifications(
    page = 1,
    limit = 20,
    status?: string,
    targetType?: string
  ): Promise<{ verifications: any[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];

    if (status && status.trim()) {
      params.push(status.trim());
      conditions.push(`v.status = $${params.length}`);
    }

    if (targetType && targetType.trim()) {
      params.push(targetType.trim());
      conditions.push(`v.target_type = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) FROM verifications v ${whereClause}`, params);
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    params.push(limit, offset);
    const res = await query(
      `SELECT 
        v.*,
        u.full_name AS user_name,
        u.phone AS user_phone,
        u.role AS user_role,
        ua.full_name AS reviewer_name
       FROM verifications v
       LEFT JOIN users u ON v.target_id = u.id
       LEFT JOIN users ua ON v.reviewed_by = ua.id
       ${whereClause}
       ORDER BY v.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      verifications: res.rows,
      total,
      page,
      limit,
    };
  }

  /**
   * 9. Approve Verification
   */
  public async approveVerification(
    adminId: string,
    verificationId: string,
    input: ApproveVerificationInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    return await withTransaction(async (client) => {
      const vRes = await client.query(
        `SELECT * FROM verifications WHERE id = $1 FOR UPDATE`,
        [verificationId]
      );
      const oldRow = vRes.rows[0];
      if (!oldRow) {
        throw new AppError("Verification record not found", 404, ErrorCode.NOT_FOUND);
      }

      if (oldRow.status === "VERIFIED") {
        return oldRow;
      }

      const updateRes = await client.query(
        `UPDATE verifications 
         SET status = 'VERIFIED', reviewed_by = $1, reviewed_at = NOW(), notes = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [adminId, input.notes || null, verificationId]
      );
      const updated = updateRes.rows[0];

      // Update target profile verified flag if applicable
      if (oldRow.target_type === "WORKER") {
        await client.query(
          `UPDATE worker_profiles SET updated_at = NOW() WHERE user_id = $1`,
          [oldRow.target_id]
        );
      } else if (oldRow.target_type === "PROVIDER") {
        await client.query(
          `UPDATE provider_profiles SET verified_business = TRUE, updated_at = NOW() WHERE user_id = $1`,
          [oldRow.target_id]
        );
      }

      // Log Audit Event
      await logAuditEvent({
        actorId: adminId,
        action: "VERIFICATION_APPROVED",
        targetEntity: "verifications",
        targetId: verificationId,
        oldValues: { status: oldRow.status },
        newValues: { status: "VERIFIED", notes: input.notes },
        ipAddress,
        userAgent,
      });

      // Notify User
      await client.query(
        `INSERT INTO notifications (recipient_id, type, title, message, data)
         VALUES ($1, 'VERIFICATION_APPROVED', 'Profile Verification Approved', 'Your profile and identity credentials have been verified by platform administrators.', $2)`,
        [oldRow.target_id, JSON.stringify({ verificationId, status: "VERIFIED" })]
      );

      return updated;
    });
  }

  /**
   * 10. Reject Verification
   */
  public async rejectVerification(
    adminId: string,
    verificationId: string,
    input: RejectVerificationInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    const existing = await query(`SELECT * FROM verifications WHERE id = $1`, [verificationId]);
    const oldRow = existing.rows[0];
    if (!oldRow) {
      throw new AppError("Verification record not found", 404, ErrorCode.NOT_FOUND);
    }

    if (oldRow.status === "REJECTED") {
      return oldRow;
    }

    const res = await query(
      `UPDATE verifications 
       SET status = 'REJECTED', rejection_reason = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [input.rejectionReason, adminId, verificationId]
    );
    const updated = res.rows[0];

    // Log Audit Event
    await logAuditEvent({
      actorId: adminId,
      action: "VERIFICATION_REJECTED",
      targetEntity: "verifications",
      targetId: verificationId,
      oldValues: { status: oldRow.status },
      newValues: { status: "REJECTED", reason: input.rejectionReason },
      ipAddress,
      userAgent,
    });

    // Notify User
    await query(
      `INSERT INTO notifications (recipient_id, type, title, message, data)
       VALUES ($1, 'VERIFICATION_REJECTED', 'Verification Application Update', $2, $3)`,
      [
        oldRow.target_id,
        `Your verification application was not approved: ${input.rejectionReason}`,
        JSON.stringify({ verificationId, rejectionReason: input.rejectionReason }),
      ]
    );

    return updated;
  }

  /**
   * 11. Payments Operations List (Excludes sensitive financial credentials)
   */
  public async getPayments(
    page = 1,
    limit = 20,
    status?: string,
    search?: string
  ): Promise<{ payments: any[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];

    if (status && status.trim()) {
      params.push(status.trim());
      conditions.push(`p.status = $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(p.transaction_ref ILIKE $${params.length} OR p.gateway_order_id ILIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) FROM payment_records p ${whereClause}`, params);
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    params.push(limit, offset);
    const res = await query(
      `SELECT 
        p.id,
        p.assignment_id,
        p.amount,
        p.amount_paise,
        p.currency,
        p.status,
        p.payment_method,
        p.transaction_ref,
        p.gateway_order_id,
        p.recorded_at,
        p.created_at,
        wo.title AS opportunity_title,
        wo.work_type,
        up.full_name AS payer_name,
        uw.full_name AS payee_name
       FROM payment_records p
       JOIN assignments a ON p.assignment_id = a.id
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       JOIN users up ON p.payer_id = up.id
       JOIN users uw ON p.payee_id = uw.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      payments: res.rows.map((r) => ({
        id: r.id,
        assignmentId: r.assignment_id,
        amount: Number(r.amount),
        amountPaise: parseInt(r.amount_paise || "0", 10),
        currency: r.currency,
        status: r.status,
        paymentMethod: r.payment_method,
        transactionRef: r.transaction_ref,
        gatewayOrderId: r.gateway_order_id,
        opportunityTitle: r.opportunity_title,
        workType: r.work_type,
        payerName: r.payer_name,
        payeeName: r.payee_name,
        recordedAt: r.recorded_at,
        createdAt: r.created_at,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * 12. Audit Logs Trail
   */
  public async getAuditLogs(
    page = 1,
    limit = 30,
    action?: string,
    targetEntity?: string
  ): Promise<{ auditLogs: any[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];

    if (action && action.trim()) {
      params.push(action.trim());
      conditions.push(`a.action = $${params.length}`);
    }

    if (targetEntity && targetEntity.trim()) {
      params.push(targetEntity.trim());
      conditions.push(`a.target_entity = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) FROM audit_logs a ${whereClause}`, params);
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    params.push(limit, offset);
    const res = await query(
      `SELECT 
        a.*,
        u.full_name AS actor_name,
        u.phone AS actor_phone,
        u.role AS actor_role
       FROM audit_logs a
       LEFT JOIN users u ON a.actor_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      auditLogs: res.rows.map((row) => ({
        id: row.id,
        actorId: row.actor_id,
        actorName: row.actor_name || "System Automated",
        actorPhone: row.actor_phone,
        actorRole: row.actor_role,
        action: row.action,
        targetEntity: row.target_entity,
        targetId: row.target_id,
        oldValues: row.old_values,
        newValues: row.new_values,
        ipAddress: row.ip_address,
        createdAt: row.created_at,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * 13. Unified Platform Search
   */
  public async searchPlatform(q: string): Promise<{
    users: any[];
    work: any[];
    payments: any[];
  }> {
    if (!q || !q.trim()) {
      return { users: [], work: [], payments: [] };
    }

    const pattern = `%${q.trim()}%`;

    const [uRes, wRes, pRes] = await Promise.all([
      query(
        `SELECT id, full_name, phone, role, is_active FROM users 
         WHERE full_name ILIKE $1 OR phone ILIKE $1 OR id::text ILIKE $1 
         LIMIT 5`,
        [pattern]
      ),
      query(
        `SELECT id, title, work_type, status, payment_amount FROM work_opportunities 
         WHERE title ILIKE $1 OR description ILIKE $1 OR id::text ILIKE $1 
         LIMIT 5`,
        [pattern]
      ),
      query(
        `SELECT id, assignment_id, amount, status, transaction_ref, gateway_order_id FROM payment_records 
         WHERE transaction_ref ILIKE $1 OR gateway_order_id ILIKE $1 OR id::text ILIKE $1 
         LIMIT 5`,
        [pattern]
      ),
    ]);

    return {
      users: uRes.rows,
      work: wRes.rows,
      payments: pRes.rows,
    };
  }
}

export const adminService = new AdminService();
