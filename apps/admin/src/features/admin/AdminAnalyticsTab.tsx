import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  TrendingUp,
  Zap,
  Database,
  Layers,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  ShieldCheck,
  AlertTriangle,
  IndianRupee,
  Star,
  CheckCircle2,
  XCircle,
  Briefcase,
} from "lucide-react";
import {
  AdminMarketplaceAnalytics,
  AdminTrustSafetyAnalytics,
  AdminPaymentAnalytics,
} from "@nearvia/types";
import { adminConfig } from "../../config";

export const AdminAnalyticsTab: React.FC = () => {
  const [overview, setOverview] = useState<any | null>(null);
  const [marketplace, setMarketplace] = useState<AdminMarketplaceAnalytics | null>(null);
  const [trustSafety, setTrustSafety] = useState<AdminTrustSafetyAnalytics | null>(null);
  const [payments, setPayments] = useState<AdminPaymentAnalytics | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // System Readiness Telemetry
  const [dbStatus, setDbStatus] = useState<any | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const token =
        localStorage.getItem("nearvia_admin_auth_token") ||
        localStorage.getItem("nearvia_auth_token");
      const headers = { Authorization: token ? `Bearer ${token}` : "" };

      const [overRes, mktRes, tsRes, payRes, evRes, readyRes] = await Promise.all([
        fetch(`${adminConfig.apiBaseUrl}/admin/analytics/overview`, { headers }),
        fetch(`${adminConfig.apiBaseUrl}/admin/analytics/marketplace`, { headers }),
        fetch(`${adminConfig.apiBaseUrl}/admin/analytics/trust-safety`, { headers }),
        fetch(`${adminConfig.apiBaseUrl}/admin/analytics/payments`, { headers }),
        fetch(`${adminConfig.apiBaseUrl}/admin/analytics/events?page=${eventsPage}&limit=10`, { headers }),
        fetch(`${adminConfig.apiBaseUrl}/ready`),
      ]);

      const [overData, mktData, tsData, payData, evData, readyData] = await Promise.all([
        overRes.json().catch(() => ({})),
        mktRes.json().catch(() => ({})),
        tsRes.json().catch(() => ({})),
        payRes.json().catch(() => ({})),
        evRes.json().catch(() => ({})),
        readyRes.json().catch(() => ({ status: "unknown" })),
      ]);

      if (overRes.ok && overData.success) setOverview(overData.data);
      if (mktRes.ok && mktData.success) setMarketplace(mktData.data);
      if (tsRes.ok && tsData.success) setTrustSafety(tsData.data);
      if (payRes.ok && payData.success) setPayments(payData.data);
      if (evRes.ok && evData.success) {
        setEvents(evData.events || []);
        setEventsTotal(evData.total || 0);
      }
      setDbStatus(readyData);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [eventsPage]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div className="space-y-6">
      {/* Telemetry & System Health Pill */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-card flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-900">API Service: Active</span>
          </div>
          <span className="text-slate-300">•</span>
          <div className="flex items-center space-x-1.5">
            <Database className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-slate-700 font-medium">
              Database: {dbStatus?.database === "connected" ? "Connected (Healthy)" : "Checking..."}
            </span>
            {dbStatus?.latencyMs && (
              <span className="text-slate-500 font-mono text-[10px]">({dbStatus.latencyMs}ms ping)</span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3 text-slate-500 text-[11px]">
          <Link
            to="/radar"
            className="px-3.5 py-1.5 rounded-xl bg-orange-600 text-white font-black text-xs hover:bg-orange-700 transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer btn-tactile active:scale-95"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Open Spatial Radar</span>
          </Link>
          <div className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Authoritative DB metrics</span>
          </div>
        </div>
      </div>

      {/* 1. Marketplace Health Scorecard & Conversion Ratios */}
      {marketplace && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Marketplace Health & Fulfillment Ratios
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-card space-y-1">
              <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Application → Hire</div>
              <div className="text-xl font-black text-emerald-600">
                {marketplace.conversionFunnel.applicationToHireRate}%
              </div>
              <div className="text-[10px] text-slate-500">Applications hired</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-card space-y-1">
              <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Completion Rate</div>
              <div className="text-xl font-black text-teal-600">
                {marketplace.conversionFunnel.assignmentCompletionRate}%
              </div>
              <div className="text-[10px] text-slate-500">Shifts finished</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-card space-y-1">
              <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Cancellation Rate</div>
              <div className={`text-xl font-black ${marketplace.cancellationRatePercentage > 15 ? "text-rose-600" : "text-slate-900"}`}>
                {marketplace.cancellationRatePercentage}%
              </div>
              <div className="text-[10px] text-slate-500">Cancelled postings</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-card space-y-1">
              <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Online Workforce</div>
              <div className="text-xl font-black text-blue-600">
                {marketplace.activeWorkforceActivity.onlineWorkersCount}
              </div>
              <div className="text-[10px] text-slate-500">Workers online (&lt;12h)</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-card space-y-1">
              <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Active Employers</div>
              <div className="text-xl font-black text-purple-600">
                {marketplace.activeWorkforceActivity.activeProvidersCount}
              </div>
              <div className="text-[10px] text-slate-500">Posted gigs (30d)</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-card space-y-1">
              <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Total Applications</div>
              <div className="text-xl font-black text-slate-900">
                {marketplace.conversionFunnel.totalApplications}
              </div>
              <div className="text-[10px] text-slate-500">Candidate responses</div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Marketplace Analytics: Category Demand & Work Types */}
      {marketplace && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Jobs by Category */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-4 h-4 text-orange-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Jobs & Demand by Category
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">Authoritative Work Opportunities</span>
            </div>

            {marketplace.jobsByCategory.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">No category postings recorded.</div>
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {marketplace.jobsByCategory.map((cat) => (
                  <div key={cat.categoryId} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-700 font-medium">
                      <span className="font-bold text-slate-900">{cat.categoryName}</span>
                      <span className="text-slate-500">
                        {cat.count} listings · Avg ₹{cat.avgWage}/day
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full"
                        style={{
                          width: `${Math.min(100, (cat.count / Math.max(1, marketplace.conversionFunnel.publishedJobs)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Jobs by Work Type & Status */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-teal-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Work Models & Status
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">By Work Type</div>
                <div className="grid grid-cols-3 gap-2">
                  {marketplace.jobsByType.map((t) => (
                    <div key={t.workType} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <div className="text-base font-black text-slate-900">{t.count}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{t.workType}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">By Lifecycle Status</div>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {marketplace.jobsByStatus.map((s) => (
                    <div key={s.status} className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <span className="text-slate-700 font-mono text-[11px]">{s.status}</span>
                      <span className="font-bold text-slate-900">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Conversion Funnel & Community Composition */}
      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Conversion Funnel */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-teal-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Work Execution & Conversion Funnel
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>1. Published Work Postings</span>
                  <span className="font-bold text-slate-900">{overview.funnel.publishedJobs}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-teal-500 w-full" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>2. Candidate Applications Received</span>
                  <span className="font-bold text-slate-900">{overview.funnel.totalApplications}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${Math.min(100, (overview.funnel.totalApplications / Math.max(1, overview.funnel.publishedJobs)) * 25)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>3. Accepted Assignments</span>
                  <span className="font-bold text-slate-900">
                    {overview.funnel.totalAssignments} ({overview.funnel.applicationToAssignmentRate}% conversion)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${Math.min(100, overview.funnel.applicationToAssignmentRate)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>4. Successfully Completed Shifts</span>
                  <span className="font-bold text-slate-900">
                    {overview.funnel.completedShifts} ({overview.funnel.workCompletionRate}% completion)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-rose-500"
                    style={{ width: `${Math.min(100, overview.funnel.workCompletionRate)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* User & Community Breakdown */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-rose-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Community & Role Breakdown
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-slate-500 text-[10px] font-bold uppercase">Total Workers</div>
                <div className="text-lg font-black text-slate-900">
                  {overview.users.workers}
                </div>
                <div className="text-[10px] text-slate-400">Service providers & crew</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-slate-500 text-[10px] font-bold uppercase">Total Employers</div>
                <div className="text-lg font-black text-orange-600">
                  {overview.users.providers}
                </div>
                <div className="text-[10px] text-slate-400">Hiring businesses & households</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-slate-500 text-[10px] font-bold uppercase">Field Agents</div>
                <div className="text-base font-bold text-purple-700">
                  {overview.users.agents}
                </div>
                <div className="text-[10px] text-slate-400">Assisted digital onboarders</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-slate-500 text-[10px] font-bold uppercase">Account Health</div>
                <div className="text-base font-bold text-emerald-700">
                  {overview.users.activeCount} Active
                </div>
                <div className="text-[10px] text-slate-400">{overview.users.suspendedCount} suspended</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Trust & Safety Analytics & Moderation Backlog */}
      {trustSafety && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Trust, Safety & Moderation Intelligence
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                trustSafety.moderationBacklogCount > 0 ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}>
                Moderation Backlog: {trustSafety.moderationBacklogCount} pending items
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* KYC Verifications Pipeline */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">KYC Verification Pipeline</div>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-black text-amber-700">{trustSafety.verifications.pending} Pending</span>
                <span className="text-xs text-slate-400">of {trustSafety.verifications.total} total</span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center space-x-2 pt-1">
                <span className="text-emerald-700 font-bold flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{trustSafety.verifications.approved} approved</span>
                </span>
                <span>•</span>
                <span className="text-rose-700 font-bold flex items-center space-x-1">
                  <XCircle className="w-3 h-3 text-rose-600" />
                  <span>{trustSafety.verifications.rejected} rejected</span>
                </span>
              </div>
            </div>

            {/* Ratings Overview */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Community Ratings</div>
              <div className="flex items-center space-x-1.5">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <span className="text-xl font-black text-slate-900">{trustSafety.ratingsOverview.averageRating}</span>
                <span className="text-xs text-slate-400">/ 5.0</span>
              </div>
              <div className="text-[11px] text-slate-500">
                {trustSafety.ratingsOverview.totalReviews} reviews · {trustSafety.ratingsOverview.fiveStarCount} 5-star · {trustSafety.ratingsOverview.threeStarOrLessCount} &lt;=3 star
              </div>
            </div>

            {/* Safety Reports by Reason */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Top Incident Categories</div>
              {trustSafety.reportsByReason.length === 0 ? (
                <div className="text-xs text-slate-400 pt-1">Zero safety incidents reported</div>
              ) : (
                <div className="space-y-1">
                  {trustSafety.reportsByReason.slice(0, 2).map((r) => (
                    <div key={r.reason} className="flex justify-between text-[11px]">
                      <span className="text-slate-700 truncate max-w-[120px]">{r.reason}</span>
                      <span className="font-bold text-orange-600">{r.count} reports</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-slate-400 pt-0.5">
                {trustSafety.unresolvedIncidentsCount} unresolved safety reports
              </div>
            </div>

            {/* Disputes by Reason */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Wage / Attendance Disputes</div>
              {trustSafety.disputesByReason.length === 0 ? (
                <div className="text-xs text-slate-400 pt-1">Zero unresolved disputes</div>
              ) : (
                <div className="space-y-1">
                  {trustSafety.disputesByReason.slice(0, 2).map((d) => (
                    <div key={d.reason} className="flex justify-between text-[11px]">
                      <span className="text-slate-700 truncate max-w-[120px]">{d.reason}</span>
                      <span className="font-bold text-rose-600">{d.count} open</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-slate-400 pt-0.5">
                Privacy protected (aggregates only)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Payment Analytics & Settlement Ledger */}
      {payments && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <IndianRupee className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Payment Analytics & Settlement Vault
              </h3>
            </div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>TEST / SANDBOX GATEWAY MODE ACTIVE</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Real Cash Settlements */}
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Verified Cash Settled</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black">REAL</span>
              </div>
              <div className="text-xl font-black text-emerald-700">
                ₹{payments.cashSettlements.settledVolume.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-slate-500">
                {payments.cashSettlements.count} dual-verified cash PIN handovers
              </div>
            </div>

            {/* Sandbox Online Payments */}
            <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Online Payments (Test)</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-black">SANDBOX</span>
              </div>
              <div className="text-xl font-black text-slate-800">
                ₹{payments.sandboxOnlinePayments.volume.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-amber-700">
                {payments.sandboxOnlinePayments.count} test transactions (not real revenue)
              </div>
            </div>

            {/* Pending Settlements */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pending Settlements</div>
              <div className="text-xl font-black text-blue-600">
                ₹{payments.pendingSettlements.pendingVolume.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-slate-500">
                {payments.pendingSettlements.count} disbursements awaiting check-out
              </div>
            </div>

            {/* Disputed & Failed Payments */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Disputed & Failed</div>
              <div className="text-xl font-black text-rose-600">
                ₹{payments.disputedPayments.disputedVolume.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-slate-500">
                {payments.disputedPayments.count} disputed · {payments.failedPaymentsCount} failed attempts
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Meaningful Platform Event Stream */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recent Product Event Stream ({eventsTotal} total)
            </h3>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-card">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-5">Timestamp</th>
                <th className="py-3.5 px-5">Event Type</th>
                <th className="py-3.5 px-5">Initiator</th>
                <th className="py-3.5 px-5">Resource Target</th>
                <th className="py-3.5 px-5 text-right">Event Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                    Loading platform events...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                    No product events recorded yet.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-5 text-slate-500 font-mono text-[11px]">
                      {new Date(ev.createdAt).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 font-sans">
                        {ev.eventType}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-800 font-medium font-sans">
                      {ev.userName} {ev.userRole && <span className="text-[10px] text-slate-400">({ev.userRole})</span>}
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 font-mono text-[11px]">
                      {ev.resourceType ? `${ev.resourceType}: ${ev.resourceId?.substring(0, 8)}...` : "—"}
                    </td>
                    <td className="py-3.5 px-5 text-right text-slate-500 text-[10px] max-w-xs truncate font-mono">
                      {JSON.stringify(ev.metadata || {})}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-1">
          <div>Showing {events.length} of {eventsTotal} product events</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
              disabled={eventsPage <= 1 || loading}
              className="p-1.5 rounded-xl bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50 text-slate-700 cursor-pointer shadow-xs transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-700">Page {eventsPage} of {Math.max(1, Math.ceil(eventsTotal / 10))}</span>
            <button
              onClick={() => setEventsPage((p) => p + 1)}
              disabled={eventsPage >= Math.ceil(eventsTotal / 10) || loading}
              className="p-1.5 rounded-xl bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50 text-slate-700 cursor-pointer shadow-xs transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
