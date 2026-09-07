import { query } from "../../db";

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
  financials: {
    totalSettledVolumePaise: number;
    totalSettledVolume: number;
    totalSettledCount: number;
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
   * 1. Overview Business & Platform Analytics
   */
  public async getOverviewAnalytics(): Promise<OverviewAnalytics> {
    const [uRes, wRes, funRes, finRes] = await Promise.all([
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
          (SELECT COUNT(*) FROM work_opportunities WHERE status IN ('PUBLISHED', 'COMPLETED', 'CANCELLED')) AS published_jobs,
          (SELECT COUNT(*) FROM applications) AS total_applications,
          (SELECT COUNT(*) FROM assignments) AS total_assignments,
          (SELECT COUNT(*) FROM assignments WHERE status = 'COMPLETED') AS completed_shifts
      `),
      query(`
        SELECT 
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'CONFIRMED'), 0) AS settled_paise,
          COUNT(*) FILTER (WHERE status = 'CONFIRMED') AS settled_count
        FROM payment_records
      `),
    ]);

    const uRow = uRes.rows[0] || {};
    const wRow = wRes.rows[0] || {};
    const fRow = funRes.rows[0] || {};
    const pRow = finRes.rows[0] || {};

    const totalApplications = parseInt(fRow.total_applications || "0", 10);
    const totalAssignments = parseInt(fRow.total_assignments || "0", 10);
    const completedShifts = parseInt(fRow.completed_shifts || "0", 10);
    const settledPaise = parseInt(pRow.settled_paise || "0", 10);

    const appToAsgRate = totalApplications > 0
      ? Math.round((totalAssignments / totalApplications) * 1000) / 10
      : 0;

    const workCompRate = totalAssignments > 0
      ? Math.round((completedShifts / totalAssignments) * 1000) / 10
      : 0;

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
      financials: {
        totalSettledVolumePaise: settledPaise,
        totalSettledVolume: settledPaise / 100,
        totalSettledCount: parseInt(pRow.settled_count || "0", 10),
        averageJobWage: Math.round(Number(wRow.avg_wage || 0)),
      },
    };
  }

  /**
   * 2. Marketplace Health Key Ratios
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
          COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved_reports
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
   * 3. Paginated Platform Event Stream
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
