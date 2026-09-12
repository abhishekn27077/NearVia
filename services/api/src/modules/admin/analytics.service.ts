import { query } from "../../db";
import {
  AdminMarketplaceAnalytics,
  AdminTrustSafetyAnalytics,
  AdminPaymentAnalytics,
} from "@nearvia/types";

export interface OverviewAnalytics {
  users: {
    total: number;
    workers: number;
    providers: number;
    agents: number;
    activeCount: number;
    suspendedCount: number;
  };
  work: {
    totalPosted: number;
    publishedActive: number;
    completed: number;
    cancelled: number;
    draft: number;
  };
  funnel: {
    publishedJobs: number;
    totalApplications: number;
    totalAssignments: number;
    completedShifts: number;
    applicationToAssignmentRate: number;
    workCompletionRate: number;
  };
  assignments: {
    totalAssignments: number;
    activeAssignments: number;
    completedAssignments: number;
    cancelledAssignments: number;
  };
  reportsAndDisputes: {
    openReports: number;
    resolvedReports: number;
    openDisputes: number;
    resolvedDisputes: number;
    totalIssues: number;
  };
  financials: {
    totalSettledVolumePaise: number;
    totalSettledVolume: number;
    totalSettledCount: number;
    cashSettledVolume: number;
    cashSettledCount: number;
    sandboxSettledVolume: number;
    sandboxSettledCount: number;
    averageJobWage: number;
  };
}

export interface MarketplaceHealth {
  jobsPosted: number;
  jobsFilled: number;
  jobsUnfilled: number;
  fillRatePercentage: number;
  completionRatePercentage: number;
  cancellationRatePercentage: number;
  noShowRatePercentage: number;
  disputeRatePercentage: number;
  reportResolutionRatePercentage: number;
  averageApplicationsPerJob: number;
  activeDisputesCount: number;
  activeReportsCount: number;
}

export class AnalyticsService {
  /**
   * 1. Overview Business & Platform Analytics (Item 1)
   * Real DB-backed authoritative metrics across all platform dimensions.
   */
  public async getOverviewAnalytics(): Promise<OverviewAnalytics> {
    const [uRes, wRes, funRes, asgRes, repDispRes, finRes] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) AS total_users,
          COUNT(*) FILTER (WHERE role = 'WORKER') AS total_workers,
          COUNT(*) FILTER (WHERE role = 'PROVIDER') AS total_providers,
          COUNT(*) FILTER (WHERE role = 'AGENT') AS total_agents,
          COUNT(*) FILTER (WHERE is_active = TRUE) AS active_count,
          COUNT(*) FILTER (WHERE is_active = FALSE) AS suspended_count
        FROM users
      `),
      query(`
        SELECT 
          COUNT(*) AS total_posted,
          COUNT(*) FILTER (WHERE status = 'PUBLISHED') AS published_active,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_work,
          COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_work,
          COUNT(*) FILTER (WHERE status = 'DRAFT') AS draft_work,
          COALESCE(AVG(payment_amount), 0) AS avg_wage
        FROM work_opportunities
      `),
      query(`
        SELECT 
          (SELECT COUNT(*) FROM work_opportunities WHERE status IN ('PUBLISHED', 'COMPLETED', 'CANCELLED', 'MATCHING', 'IN_PROGRESS')) AS published_jobs,
          (SELECT COUNT(*) FROM applications) AS total_applications,
          (SELECT COUNT(*) FROM assignments) AS total_assignments,
          (SELECT COUNT(*) FROM assignments WHERE status = 'COMPLETED') AS completed_shifts
      `),
      query(`
        SELECT
          COUNT(*) AS total_assignments,
          COUNT(*) FILTER (WHERE status IN ('ASSIGNED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')) AS active_assignments,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_assignments,
          COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_assignments
        FROM assignments
      `),
      query(`
        SELECT
          (SELECT COUNT(*) FROM reports WHERE status IN ('OPEN', 'UNDER_REVIEW')) AS open_reports,
          (SELECT COUNT(*) FROM reports WHERE status IN ('ACTION_TAKEN', 'DISMISSED')) AS resolved_reports,
          (SELECT COUNT(*) FROM disputes WHERE status IN ('OPEN', 'UNDER_REVIEW')) AS open_disputes,
          (SELECT COUNT(*) FROM disputes WHERE status IN ('RESOLVED', 'REJECTED')) AS resolved_disputes
      `),
      query(`
        SELECT 
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'CONFIRMED'), 0) AS total_settled_paise,
          COUNT(*) FILTER (WHERE status = 'CONFIRMED') AS total_settled_count,
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'CONFIRMED' AND payment_method = 'CASH'), 0) AS cash_settled_paise,
          COUNT(*) FILTER (WHERE status = 'CONFIRMED' AND payment_method = 'CASH') AS cash_settled_count,
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'CONFIRMED' AND (payment_method != 'CASH' OR payment_method IS NULL)), 0) AS sandbox_settled_paise,
          COUNT(*) FILTER (WHERE status = 'CONFIRMED' AND (payment_method != 'CASH' OR payment_method IS NULL)) AS sandbox_settled_count
        FROM payment_records
      `),
    ]);

    const uRow = uRes.rows[0] || {};
    const wRow = wRes.rows[0] || {};
    const fRow = funRes.rows[0] || {};
    const aRow = asgRes.rows[0] || {};
    const rdRow = repDispRes.rows[0] || {};
    const pRow = finRes.rows[0] || {};

    const totalApplications = parseInt(fRow.total_applications || "0", 10);
    const totalAssignments = parseInt(fRow.total_assignments || "0", 10);
    const completedShifts = parseInt(fRow.completed_shifts || "0", 10);
    const settledPaise = parseInt(pRow.total_settled_paise || pRow.settled_paise || "0", 10);
    const cashPaise = parseInt(pRow.cash_settled_paise || "0", 10);
    const sandboxPaise = parseInt(pRow.sandbox_settled_paise || "0", 10);

    const appToAsgRate = totalApplications > 0
      ? Math.min(100, Math.round((totalAssignments / totalApplications) * 1000) / 10)
      : 0;

    const workCompRate = totalAssignments > 0
      ? Math.min(100, Math.round((completedShifts / totalAssignments) * 1000) / 10)
      : 0;

    const openReports = parseInt(rdRow.open_reports || "0", 10);
    const resolvedReports = parseInt(rdRow.resolved_reports || "0", 10);
    const openDisputes = parseInt(rdRow.open_disputes || "0", 10);
    const resolvedDisputes = parseInt(rdRow.resolved_disputes || "0", 10);

    return {
      users: {
        total: parseInt(uRow.total_users || "0", 10),
        workers: parseInt(uRow.total_workers || "0", 10),
        providers: parseInt(uRow.total_providers || "0", 10),
        agents: parseInt(uRow.total_agents || "0", 10),
        activeCount: parseInt(uRow.active_count || "0", 10),
        suspendedCount: parseInt(uRow.suspended_count || "0", 10),
      },
      work: {
        totalPosted: parseInt(wRow.total_posted || "0", 10),
        publishedActive: parseInt(wRow.published_active || "0", 10),
        completed: parseInt(wRow.completed_work || "0", 10),
        cancelled: parseInt(wRow.cancelled_work || "0", 10),
        draft: parseInt(wRow.draft_work || "0", 10),
      },
      funnel: {
        publishedJobs: parseInt(fRow.published_jobs || "0", 10),
        totalApplications,
        totalAssignments,
        completedShifts,
        applicationToAssignmentRate: appToAsgRate,
        workCompletionRate: workCompRate,
      },
      assignments: {
        totalAssignments: parseInt(aRow.total_assignments || "0", 10),
        activeAssignments: parseInt(aRow.active_assignments || "0", 10),
        completedAssignments: parseInt(aRow.completed_assignments || "0", 10),
        cancelledAssignments: parseInt(aRow.cancelled_assignments || "0", 10),
      },
      reportsAndDisputes: {
        openReports,
        resolvedReports,
        openDisputes,
        resolvedDisputes,
        totalIssues: openReports + resolvedReports + openDisputes + resolvedDisputes,
      },
      financials: {
        totalSettledVolumePaise: settledPaise,
        totalSettledVolume: settledPaise / 100,
        totalSettledCount: parseInt(pRow.total_settled_count || pRow.settled_count || "0", 10),
        cashSettledVolume: cashPaise / 100,
        cashSettledCount: parseInt(pRow.cash_settled_count || "0", 10),
        sandboxSettledVolume: sandboxPaise / 100,
        sandboxSettledCount: parseInt(pRow.sandbox_settled_count || "0", 10),
        averageJobWage: Math.round(Number(wRow.avg_wage || 0)),
      },
    };
  }

  /**
   * 2. Comprehensive Marketplace Analytics (Item 2)
   * Jobs by category, type, status, conversion funnel, and active workforce.
   */
  public async getMarketplaceAnalytics(): Promise<AdminMarketplaceAnalytics> {
    const [catRes, typeRes, statusRes, funnelRes, workforceRes] = await Promise.all([
      // Jobs by Category
      query<{ category_id: string; category_name: string; count: string; avg_wage: string }>(`
        SELECT 
          c.id AS category_id,
          c.name AS category_name,
          COUNT(wo.id) AS count,
          COALESCE(ROUND(AVG(wo.payment_amount)), 0) AS avg_wage
        FROM categories c
        LEFT JOIN work_opportunities wo ON wo.category_id = c.id
        GROUP BY c.id, c.name
        ORDER BY count DESC
      `),
      // Jobs by Work Type (TASK, SHIFT, JOB)
      query<{ work_type: "TASK" | "SHIFT" | "JOB"; count: string }>(`
        SELECT work_type, COUNT(*) AS count
        FROM work_opportunities
        GROUP BY work_type
        ORDER BY count DESC
      `),
      // Jobs by Lifecycle Status
      query<{ status: string; count: string }>(`
        SELECT status, COUNT(*) AS count
        FROM work_opportunities
        GROUP BY status
        ORDER BY count DESC
      `),
      // Funnel metrics
      query(`
        SELECT 
          (SELECT COUNT(*) FROM work_opportunities WHERE status IN ('PUBLISHED', 'MATCHING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')) AS published_jobs,
          (SELECT COUNT(*) FROM work_opportunities) AS total_jobs,
          (SELECT COUNT(*) FROM work_opportunities WHERE status = 'CANCELLED') AS cancelled_jobs,
          (SELECT COUNT(*) FROM applications) AS total_applications,
          (SELECT COUNT(*) FROM assignments) AS total_assignments,
          (SELECT COUNT(*) FROM assignments WHERE status = 'COMPLETED') AS completed_assignments
      `),
      // Active Workforce Activity
      query(`
        SELECT
          (
            SELECT COUNT(*) 
            FROM worker_profiles 
            WHERE is_available_now = TRUE 
              AND availability_status != 'OFFLINE'
              AND (
                (availability_updated_at IS NOT NULL AND availability_updated_at >= NOW() - INTERVAL '12 hours')
                OR
                (availability_updated_at IS NULL AND updated_at >= NOW() - INTERVAL '12 hours')
              )
          ) AS online_workers_count,
          (
            SELECT COUNT(DISTINCT provider_id) 
            FROM work_opportunities 
            WHERE created_at >= NOW() - INTERVAL '30 days'
          ) AS active_providers_count
      `),
    ]);

    const fRow = funnelRes.rows[0] || {};
    const wfRow = workforceRes.rows[0] || {};

    const publishedJobs = parseInt(fRow.published_jobs || "0", 10);
    const totalJobs = parseInt(fRow.total_jobs || "0", 10);
    const cancelledJobs = parseInt(fRow.cancelled_jobs || "0", 10);
    const totalApplications = parseInt(fRow.total_applications || "0", 10);
    const totalAssignments = parseInt(fRow.total_assignments || "0", 10);
    const completedAssignments = parseInt(fRow.completed_assignments || "0", 10);

    const appToHireRate = totalApplications > 0
      ? Math.min(100, Math.round((totalAssignments / totalApplications) * 1000) / 10)
      : 0;

    const assignmentCompletionRate = totalAssignments > 0
      ? Math.min(100, Math.round((completedAssignments / totalAssignments) * 1000) / 10)
      : 0;

    const completionRatePercentage = totalJobs > 0
      ? Math.min(100, Math.round((completedAssignments / totalJobs) * 1000) / 10)
      : 0;

    const cancellationRatePercentage = totalJobs > 0
      ? Math.min(100, Math.round((cancelledJobs / totalJobs) * 1000) / 10)
      : 0;

    return {
      jobsByCategory: catRes.rows.map((r) => ({
        categoryId: r.category_id,
        categoryName: r.category_name,
        count: parseInt(r.count || "0", 10),
        avgWage: Number(r.avg_wage || 0),
      })),
      jobsByType: typeRes.rows.map((r) => ({
        workType: r.work_type,
        count: parseInt(r.count || "0", 10),
      })),
      jobsByStatus: statusRes.rows.map((r) => ({
        status: r.status,
        count: parseInt(r.count || "0", 10),
      })),
      conversionFunnel: {
        publishedJobs,
        totalApplications,
        totalAssignments,
        completedAssignments,
        applicationToHireRate: appToHireRate,
        assignmentCompletionRate,
      },
      completionRatePercentage,
      cancellationRatePercentage,
      activeWorkforceActivity: {
        onlineWorkersCount: parseInt(wfRow.online_workers_count || "0", 10),
        activeProvidersCount: parseInt(wfRow.active_providers_count || "0", 10),
      },
    };
  }

  /**
   * 3. Trust, Safety & Moderation Analytics (Item 3)
   * Privacy-preserving aggregates of verifications, reviews, reports, and disputes.
   * NEVER exposes private complaint descriptions or PII.
   */
  public async getTrustAndSafetyAnalytics(): Promise<AdminTrustSafetyAnalytics> {
    const [vRes, revRes, repReasonRes, repStatusRes, dispReasonRes, dispStatusRes] = await Promise.all([
      // Verifications status breakdown
      query<{ pending: string; approved: string; rejected: string; total: string }>(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
          COUNT(*) FILTER (WHERE status = 'VERIFIED') AS approved,
          COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected,
          COUNT(*) AS total
        FROM verifications
      `),
      // Ratings & Reviews overview
      query<{
        avg_rating: string;
        total_reviews: string;
        five_star: string;
        four_star: string;
        three_or_less: string;
      }>(`
        SELECT 
          COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS avg_rating,
          COUNT(*) AS total_reviews,
          COUNT(*) FILTER (WHERE rating = 5) AS five_star,
          COUNT(*) FILTER (WHERE rating = 4) AS four_star,
          COUNT(*) FILTER (WHERE rating <= 3) AS three_or_less
        FROM reviews
      `),
      // Reports by reason
      query<{ reason: string; count: string }>(`
        SELECT reason, COUNT(*) AS count
        FROM reports
        GROUP BY reason
        ORDER BY count DESC
        LIMIT 8
      `),
      // Reports by status
      query<{ status: string; count: string }>(`
        SELECT status, COUNT(*) AS count
        FROM reports
        GROUP BY status
      `),
      // Disputes by reason
      query<{ reason: string; count: string }>(`
        SELECT reason, COUNT(*) AS count
        FROM disputes
        GROUP BY reason
        ORDER BY count DESC
        LIMIT 8
      `),
      // Disputes by status
      query<{ status: string; count: string }>(`
        SELECT status, COUNT(*) AS count
        FROM disputes
        GROUP BY status
      `),
    ]);

    const vRow: any = vRes.rows[0] || {};
    const revRow: any = revRes.rows[0] || {};

    const pendingVerifications = parseInt(vRow.pending || "0", 10);
    const reportsByStatus = repStatusRes.rows.map((r) => ({
      status: r.status,
      count: parseInt(r.count || "0", 10),
    }));
    const disputesByStatus = dispStatusRes.rows.map((r) => ({
      status: r.status,
      count: parseInt(r.count || "0", 10),
    }));

    const openReports = reportsByStatus
      .filter((s) => s.status === "OPEN" || s.status === "UNDER_REVIEW")
      .reduce((acc, s) => acc + s.count, 0);

    const openDisputes = disputesByStatus
      .filter((s) => s.status === "OPEN" || s.status === "UNDER_REVIEW")
      .reduce((acc, s) => acc + s.count, 0);

    return {
      verifications: {
        pending: pendingVerifications,
        approved: parseInt(vRow.approved || "0", 10),
        rejected: parseInt(vRow.rejected || "0", 10),
        total: parseInt(vRow.total || "0", 10),
      },
      ratingsOverview: {
        averageRating: Number(revRow.avg_rating || 0),
        totalReviews: parseInt(revRow.total_reviews || "0", 10),
        fiveStarCount: parseInt(revRow.five_star || "0", 10),
        fourStarCount: parseInt(revRow.four_star || "0", 10),
        threeStarOrLessCount: parseInt(revRow.three_or_less || "0", 10),
      },
      reportsByReason: repReasonRes.rows.map((r) => ({
        reason: r.reason,
        count: parseInt(r.count || "0", 10),
      })),
      reportsByStatus,
      disputesByReason: dispReasonRes.rows.map((r) => ({
        reason: r.reason,
        count: parseInt(r.count || "0", 10),
      })),
      disputesByStatus,
      unresolvedIncidentsCount: openReports,
      moderationBacklogCount: pendingVerifications + openReports + openDisputes,
    };
  }

  /**
   * 4. Payment Analytics & Settlement Ledger (Item 4)
   * Authoritative separation of cash settlements vs sandbox online transactions.
   * Explicitly disclaims test sandbox money from real platform revenue.
   */
  public async getPaymentAnalytics(): Promise<AdminPaymentAnalytics> {
    const res = await query<{
      cash_paise: string;
      cash_count: string;
      sandbox_paise: string;
      sandbox_count: string;
      pending_paise: string;
      pending_count: string;
      disputed_paise: string;
      disputed_count: string;
      failed_count: string;
      total_count: string;
    }>(`
      SELECT 
        COALESCE(SUM(amount_paise) FILTER (WHERE status = 'CONFIRMED' AND payment_method = 'CASH'), 0) AS cash_paise,
        COUNT(*) FILTER (WHERE status = 'CONFIRMED' AND payment_method = 'CASH') AS cash_count,
        COALESCE(SUM(amount_paise) FILTER (WHERE status = 'CONFIRMED' AND (payment_method != 'CASH' OR payment_method IS NULL)), 0) AS sandbox_paise,
        COUNT(*) FILTER (WHERE status = 'CONFIRMED' AND (payment_method != 'CASH' OR payment_method IS NULL)) AS sandbox_count,
        COALESCE(SUM(amount_paise) FILTER (WHERE status = 'PENDING'), 0) AS pending_paise,
        COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_count,
        COALESCE(SUM(amount_paise) FILTER (WHERE status = 'DISPUTED'), 0) AS disputed_paise,
        COUNT(*) FILTER (WHERE status = 'DISPUTED') AS disputed_count,
        COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_count,
        COUNT(*) AS total_count
      FROM payment_records
    `);

    const row: any = res.rows[0] || {};
    const cashPaise = parseInt(row.cash_paise || "0", 10);
    const sandboxPaise = parseInt(row.sandbox_paise || "0", 10);
    const pendingPaise = parseInt(row.pending_paise || "0", 10);
    const disputedPaise = parseInt(row.disputed_paise || "0", 10);

    return {
      cashSettlements: {
        settledVolume: cashPaise / 100,
        settledVolumePaise: cashPaise,
        count: parseInt(row.cash_count || "0", 10),
      },
      sandboxOnlinePayments: {
        isSandbox: true,
        volume: sandboxPaise / 100,
        volumePaise: sandboxPaise,
        count: parseInt(row.sandbox_count || "0", 10),
        disclaimer: "All online transactions operate strictly in Razorpay Sandbox / Demo test mode. No real money or revenue is transacted.",
      },
      pendingSettlements: {
        count: parseInt(row.pending_count || "0", 10),
        pendingVolume: pendingPaise / 100,
      },
      disputedPayments: {
        count: parseInt(row.disputed_count || "0", 10),
        disputedVolume: disputedPaise / 100,
      },
      failedPaymentsCount: parseInt(row.failed_count || "0", 10),
      totalTransactionsCount: parseInt(row.total_count || "0", 10),
    };
  }

  /**
   * 5. Marketplace Health Key Ratios (Legacy Compatibility)
   */
  public async getMarketplaceHealth(): Promise<MarketplaceHealth> {
    const [jobsRes, asgRes, dispRes, repRes] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) AS total_jobs,
          COUNT(*) FILTER (WHERE workers_assigned >= workers_needed AND workers_needed > 0) AS filled_jobs,
          COUNT(*) FILTER (WHERE workers_assigned < workers_needed AND status = 'PUBLISHED') AS unfilled_jobs,
          COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_jobs,
          (SELECT COUNT(*) FROM applications) AS total_apps
        FROM work_opportunities
      `),
      query(`
        SELECT 
          COUNT(*) AS total_assignments,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_assignments,
          COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_assignments
        FROM assignments
      `),
      query(`
        SELECT 
          COUNT(*) AS total_disputes,
          COUNT(*) FILTER (WHERE status IN ('OPEN', 'UNDER_REVIEW')) AS active_disputes,
          COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved_disputes
        FROM disputes
      `),
      query(`
        SELECT 
          COUNT(*) AS total_reports,
          COUNT(*) FILTER (WHERE status IN ('OPEN', 'UNDER_REVIEW')) AS active_reports,
          COUNT(*) FILTER (WHERE status IN ('ACTION_TAKEN', 'DISMISSED')) AS resolved_reports
        FROM reports
      `),
    ]);

    const jRow = jobsRes.rows[0] || {};
    const aRow = asgRes.rows[0] || {};
    const dRow = dispRes.rows[0] || {};
    const rRow = repRes.rows[0] || {};

    const totalJobs = parseInt(jRow.total_jobs || "0", 10);
    const filledJobs = parseInt(jRow.filled_jobs || "0", 10);
    const unfilledJobs = parseInt(jRow.unfilled_jobs || "0", 10);
    const cancelledJobs = parseInt(jRow.cancelled_jobs || "0", 10);
    const totalApps = parseInt(jRow.total_apps || "0", 10);

    const totalAsg = parseInt(aRow.total_assignments || "0", 10);
    const completedAsg = parseInt(aRow.completed_assignments || "0", 10);
    const cancelledAsg = parseInt(aRow.cancelled_assignments || "0", 10);

    const totalDisputes = parseInt(dRow.total_disputes || "0", 10);
    const activeDisputes = parseInt(dRow.active_disputes || "0", 10);

    const totalReports = parseInt(rRow.total_reports || "0", 10);
    const resolvedReports = parseInt(rRow.resolved_reports || "0", 10);
    const activeReports = parseInt(rRow.active_reports || "0", 10);

    const fillRate = totalJobs > 0 ? Math.round((filledJobs / totalJobs) * 1000) / 10 : 0;
    const completionRate = totalAsg > 0 ? Math.round((completedAsg / totalAsg) * 1000) / 10 : 0;
    const cancellationRate = totalJobs > 0 ? Math.round((cancelledJobs / totalJobs) * 1000) / 10 : 0;
    const noShowRate = totalAsg > 0 ? Math.round((cancelledAsg / totalAsg) * 1000) / 10 : 0;
    const disputeRate = totalAsg > 0 ? Math.round((totalDisputes / totalAsg) * 1000) / 10 : 0;
    const reportResRate = totalReports > 0 ? Math.round((resolvedReports / totalReports) * 1000) / 10 : 100;
    const avgAppsPerJob = totalJobs > 0 ? Math.round((totalApps / totalJobs) * 10) / 10 : 0;

    return {
      jobsPosted: totalJobs,
      jobsFilled: filledJobs,
      jobsUnfilled: unfilledJobs,
      fillRatePercentage: fillRate,
      completionRatePercentage: completionRate,
      cancellationRatePercentage: cancellationRate,
      noShowRatePercentage: noShowRate,
      disputeRatePercentage: disputeRate,
      reportResolutionRatePercentage: reportResRate,
      averageApplicationsPerJob: avgAppsPerJob,
      activeDisputesCount: activeDisputes,
      activeReportsCount: activeReports,
    };
  }

  /**
   * 6. Paginated Platform Event Stream
   */
  public async getPlatformEvents(
    page = 1,
    limit = 25,
    eventType?: string,
    userId?: string
  ): Promise<{ events: any[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];

    if (eventType && eventType.trim()) {
      params.push(eventType.trim());
      conditions.push(`pe.event_type = $${params.length}`);
    }

    if (userId && userId.trim()) {
      params.push(userId.trim());
      conditions.push(`pe.user_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) FROM platform_events pe ${whereClause}`, params);
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    params.push(limit, offset);
    const res = await query(
      `SELECT 
        pe.id,
        pe.event_type,
        pe.user_id,
        pe.resource_type,
        pe.resource_id,
        pe.metadata,
        pe.ip_address,
        pe.created_at,
        u.full_name AS user_name,
        u.role AS user_role
       FROM platform_events pe
       LEFT JOIN users u ON pe.user_id = u.id
       ${whereClause}
       ORDER BY pe.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      events: res.rows.map((r) => ({
        id: r.id,
        eventType: r.event_type,
        userId: r.user_id,
        userName: r.user_name || "System Anonymous",
        userRole: r.user_role,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        metadata: r.metadata,
        ipAddress: r.ip_address,
        createdAt: r.created_at,
      })),
      total,
      page,
      limit,
    };
  }
}

export const analyticsService = new AnalyticsService();
