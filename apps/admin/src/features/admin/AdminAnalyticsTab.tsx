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
        fetch("/api/v1/admin/analytics/overview", { headers }),
        fetch("/api/v1/admin/analytics/marketplace", { headers }),
        fetch("/api/v1/admin/analytics/trust-safety", { headers }),
        fetch("/api/v1/admin/analytics/payments", { headers }),
        fetch(`/api/v1/admin/analytics/events?page=${eventsPage}&limit=10`, { headers }),
        fetch("/ready"),
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
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-white">API Service: Active</span>
          </div>
          <span className="text-slate-600">•</span>
          <div className="flex items-center space-x-1.5">
            <Database className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-slate-300">
              Database: {dbStatus?.database === "connected" ? "Connected (Healthy)" : "Checking..."}
            </span>
            {dbStatus?.latencyMs && (
              <span className="text-slate-500 font-mono text-[10px]">({dbStatus.latencyMs}ms ping)</span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3 text-slate-400 text-[11px]">
          <Link
            to="/radar"
            className="px-3 py-1.5 rounded-xl bg-orange-600 text-white font-black text-xs hover:bg-orange-700 transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Open Spatial Radar</span>
          </Link>
          <div className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Authoritative DB metrics</span>
          </div>
        </div>
      </div>

      {/* 1. Marketplace Health Scorecard & Conversion Ratios */}
      {marketplace && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Marketplace Health & Fulfillment Ratios
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Application → Hire</div>
              <div className="text-xl font-black text-emerald-400">
                {marketplace.conversionFunnel.applicationToHireRate}%
              </div>
              <div className="text-[10px] text-slate-500">Applications hired</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Completion Rate</div>
              <div className="text-xl font-black text-teal-400">
                {marketplace.conversionFunnel.assignmentCompletionRate}%
              </div>
              <div className="text-[10px] text-slate-500">Shifts finished</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Cancellation Rate</div>
              <div className={`text-xl font-black ${marketplace.cancellationRatePercentage > 15 ? "text-rose-400" : "text-slate-300"}`}>
                {marketplace.cancellationRatePercentage}%
              </div>
              <div className="text-[10px] text-slate-500">Cancelled postings</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Online Workforce</div>
              <div className="text-xl font-black text-blue-400">
                {marketplace.activeWorkforceActivity.onlineWorkersCount}
              </div>
              <div className="text-[10px] text-slate-500">Workers online (&lt;12h)</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Active Employers</div>
              <div className="text-xl font-black text-purple-400">
                {marketplace.activeWorkforceActivity.activeProvidersCount}
              </div>
              <div className="text-[10px] text-slate-500">Posted gigs (30d)</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total Applications</div>
              <div className="text-xl font-black text-white">
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
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-4 h-4 text-orange-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Jobs & Demand by Category
                </h3>
              </div>
              <span className="text-[10px] text-slate-500">Authoritative Work Opportunities</span>
            </div>

            {marketplace.jobsByCategory.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">No category postings recorded.</div>
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {marketplace.jobsByCategory.map((cat) => (
                  <div key={cat.categoryId} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-300 font-medium">
                      <span className="font-bold text-white">{cat.categoryName}</span>
                      <span className="text-slate-400">
                        {cat.count} listings · Avg ₹{cat.avgWage}/day
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
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
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-teal-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Work Models & Status
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1.5">By Work Type</div>
                <div className="grid grid-cols-3 gap-2">
                  {marketplace.jobsByType.map((t) => (
                    <div key={t.workType} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <div className="text-base font-black text-white">{t.count}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{t.workType}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1.5">By Lifecycle Status</div>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {marketplace.jobsByStatus.map((s) => (
                    <div key={s.status} className="flex justify-between items-center py-1 px-2 rounded-lg bg-slate-950/60 text-xs">
                      <span className="text-slate-400 font-mono text-[11px]">{s.status}</span>
                      <span className="font-bold text-white">{s.count}</span>
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
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-teal-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Work Execution & Conversion Funnel
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>1. Published Work Postings</span>
                  <span className="font-bold text-white">{overview.funnel.publishedJobs}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-teal-500 w-full" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>2. Candidate Applications Received</span>
                  <span className="font-bold text-white">{overview.funnel.totalApplications}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${Math.min(100, (overview.funnel.totalApplications / Math.max(1, overview.funnel.publishedJobs)) * 25)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>3. Accepted Assignments</span>
                  <span className="font-bold text-white">
                    {overview.funnel.totalAssignments} ({overview.funnel.applicationToAssignmentRate}% conversion)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${Math.min(100, overview.funnel.applicationToAssignmentRate)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>4. Successfully Completed Shifts</span>
                  <span className="font-bold text-white">
                    {overview.funnel.completedShifts} ({overview.funnel.workCompletionRate}% completion)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-rose-500"
                    style={{ width: `${Math.min(100, overview.funnel.workCompletionRate)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* User & Community Breakdown */}
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Community & Role Breakdown
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[10px]">Total Workers</div>
                <div className="text-lg font-black text-white">
                  {overview.users.workers}
                </div>
                <div className="text-[10px] text-slate-500">Service providers & crew</div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[10px]">Total Employers</div>
                <div className="text-lg font-black text-orange-400">
                  {overview.users.providers}
                </div>
                <div className="text-[10px] text-slate-500">Hiring businesses & households</div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[10px]">Field Agents</div>
                <div className="text-base font-bold text-purple-300">
                  {overview.users.agents}
                </div>
                <div className="text-[10px] text-slate-500">Assisted digital onboarders</div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[10px]">Account Health</div>
                <div className="text-base font-bold text-emerald-400">
                  {overview.users.activeCount} Active
                </div>
                <div className="text-[10px] text-slate-500">{overview.users.suspendedCount} suspended</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Trust & Safety Analytics & Moderation Backlog */}
      {trustSafety && (
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Trust, Safety & Moderation Intelligence
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                trustSafety.moderationBacklogCount > 0 ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : "bg-emerald-500/20 text-emerald-300"
              }`}>
                Moderation Backlog: {trustSafety.moderationBacklogCount} pending items
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* KYC Verifications Pipeline */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">KYC Verification Pipeline</div>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-black text-amber-400">{trustSafety.verifications.pending} Pending</span>
                <span className="text-xs text-slate-500">of {trustSafety.verifications.total} total</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center space-x-2 pt-1">
                <span className="text-emerald-400 font-bold flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{trustSafety.verifications.approved} approved</span>
                </span>
                <span>•</span>
                <span className="text-rose-400 font-bold flex items-center space-x-1">
                  <XCircle className="w-3 h-3" />
                  <span>{trustSafety.verifications.rejected} rejected</span>
                </span>
              </div>
            </div>

            {/* Ratings Overview */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Community Ratings</div>
              <div className="flex items-center space-x-1.5">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <span className="text-xl font-black text-white">{trustSafety.ratingsOverview.averageRating}</span>
                <span className="text-xs text-slate-500">/ 5.0</span>
              </div>
              <div className="text-[11px] text-slate-400">
                {trustSafety.ratingsOverview.totalReviews} reviews · {trustSafety.ratingsOverview.fiveStarCount} 5-star · {trustSafety.ratingsOverview.threeStarOrLessCount} &lt;=3 star
              </div>
            </div>

            {/* Safety Reports by Reason */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Incident Categories</div>
              {trustSafety.reportsByReason.length === 0 ? (
                <div className="text-xs text-slate-500 pt-1">Zero safety incidents reported</div>
              ) : (
                <div className="space-y-1">
                  {trustSafety.reportsByReason.slice(0, 2).map((r) => (
                    <div key={r.reason} className="flex justify-between text-[11px]">
                      <span className="text-slate-300 truncate max-w-[120px]">{r.reason}</span>
                      <span className="font-bold text-orange-400">{r.count} reports</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-slate-500 pt-0.5">
                {trustSafety.unresolvedIncidentsCount} unresolved safety reports
              </div>
            </div>

            {/* Disputes by Reason */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wage / Attendance Disputes</div>
              {trustSafety.disputesByReason.length === 0 ? (
                <div className="text-xs text-slate-500 pt-1">Zero unresolved disputes</div>
              ) : (
                <div className="space-y-1">
                  {trustSafety.disputesByReason.slice(0, 2).map((d) => (
                    <div key={d.reason} className="flex justify-between text-[11px]">
                      <span className="text-slate-300 truncate max-w-[120px]">{d.reason}</span>
                      <span className="font-bold text-rose-400">{d.count} open</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-slate-500 pt-0.5">
                Privacy protected (aggregates only)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Payment Analytics & Settlement Ledger */}
      {payments && (
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <IndianRupee className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Payment Analytics & Settlement Vault
              </h3>
            </div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>TEST / SANDBOX GATEWAY MODE ACTIVE</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Real Cash Settlements */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-900/40 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Verified Cash Settled</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-black">REAL</span>
              </div>
              <div className="text-xl font-black text-emerald-400">
                ₹{payments.cashSettlements.settledVolume.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-slate-400">
                {payments.cashSettlements.count} dual-verified cash PIN handovers
              </div>
            </div>

            {/* Sandbox Online Payments */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-amber-900/40 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Online Payments (Test)</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black">SANDBOX</span>
              </div>
              <div className="text-xl font-black text-slate-300">
                ₹{payments.sandboxOnlinePayments.volume.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-amber-400/80">
                {payments.sandboxOnlinePayments.count} test transactions (not real revenue)
              </div>
            </div>

            {/* Pending Settlements */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Settlements</div>
              <div className="text-xl font-black text-blue-400">
                ₹{payments.pendingSettlements.pendingVolume.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-slate-400">
                {payments.pendingSettlements.count} disbursements awaiting check-out
              </div>
            </div>

            {/* Disputed & Failed Payments */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Disputed & Failed</div>
              <div className="text-xl font-black text-rose-400">
                ₹{payments.disputedPayments.disputedVolume.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-slate-400">
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
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Recent Product Event Stream ({eventsTotal} total)
            </h3>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Initiator</th>
                <th className="py-3 px-4">Resource Target</th>
                <th className="py-3 px-4 text-right">Event Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                    Loading platform events...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                    No product events recorded yet.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(ev.createdAt).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30 font-sans">
                        {ev.eventType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-200 font-sans">
                      {ev.userName} {ev.userRole && <span className="text-[10px] text-slate-500">({ev.userRole})</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {ev.resourceType ? `${ev.resourceType}: ${ev.resourceId?.substring(0, 8)}...` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400 text-[10px] max-w-xs truncate">
                      {JSON.stringify(ev.metadata || {})}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <div>Showing {events.length} of {eventsTotal} product events</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
              disabled={eventsPage <= 1 || loading}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-white cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {eventsPage} of {Math.max(1, Math.ceil(eventsTotal / 10))}</span>
            <button
              onClick={() => setEventsPage((p) => p + 1)}
              disabled={eventsPage >= Math.ceil(eventsTotal / 10) || loading}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-white cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
