import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  TrendingUp,
  Zap,
  Database,
  Layers,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";

export const AdminAnalyticsTab: React.FC = () => {
  const [overview, setOverview] = useState<any | null>(null);
  const [health, setHealth] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // System Readiness Telemetry
  const [dbStatus, setDbStatus] = useState<any | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("nearvia_auth_token");
      const headers = { Authorization: token ? `Bearer ${token}` : "" };

      const [overRes, healthRes, evRes, readyRes] = await Promise.all([
        fetch("/api/v1/admin/analytics/overview", { headers }),
        fetch("/api/v1/admin/analytics/marketplace", { headers }),
        fetch(`/api/v1/admin/analytics/events?page=${eventsPage}&limit=10`, { headers }),
        fetch("/ready"),
      ]);

      const [overData, healthData, evData, readyData] = await Promise.all([
        overRes.json(),
        healthRes.json(),
        evRes.json(),
        readyRes.json().catch(() => ({ status: "unknown" })),
      ]);

      if (overRes.ok && overData.success) setOverview(overData.data);
      if (healthRes.ok && healthData.success) setHealth(healthData.data);
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

        <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>Real-time authoritative database metrics</span>
        </div>
      </div>

      {/* 1. Marketplace Health Scorecard */}
      {health && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Marketplace Health & Fulfillment Ratios
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Job Fill Rate</div>
              <div className="text-xl font-black text-emerald-400">{health.fillRatePercentage}%</div>
              <div className="text-[10px] text-slate-500">{health.jobsFilled} of {health.jobsPosted} jobs filled</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Completion Rate</div>
              <div className="text-xl font-black text-teal-400">{health.completionRatePercentage}%</div>
              <div className="text-[10px] text-slate-500">Completed assignments</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">No-Show / Cancel</div>
              <div className={`text-xl font-black ${health.noShowRatePercentage > 15 ? "text-rose-400" : "text-slate-300"}`}>
                {health.noShowRatePercentage}%
              </div>
              <div className="text-[10px] text-slate-500">Cancellation ratio</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Dispute Rate</div>
              <div className={`text-xl font-black ${health.disputeRatePercentage > 5 ? "text-amber-400" : "text-slate-300"}`}>
                {health.disputeRatePercentage}%
              </div>
              <div className="text-[10px] text-slate-500">{health.activeDisputesCount} active disputes</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Resolution Rate</div>
              <div className="text-xl font-black text-emerald-400">{health.reportResolutionRatePercentage}%</div>
              <div className="text-[10px] text-slate-500">Incident resolution</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Apps / Job</div>
              <div className="text-xl font-black text-white">{health.averageApplicationsPerJob}</div>
              <div className="text-[10px] text-slate-500">Average candidate density</div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Conversion Funnel & Financials */}
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

          {/* User & Financial Composition */}
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Community & Financial Settlement Metrics
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[10px]">Settled Wage Volume</div>
                <div className="text-lg font-black text-white">
                  ₹{overview.financials.totalSettledVolume.toLocaleString("en-IN")}
                </div>
                <div className="text-[10px] text-slate-500">{overview.financials.totalSettledCount} paid shifts</div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[10px]">Average Job Compensation</div>
                <div className="text-lg font-black text-emerald-400">
                  ₹{overview.financials.averageJobWage}
                </div>
                <div className="text-[10px] text-slate-500">Per work opportunity</div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[10px]">Worker vs Provider Ratio</div>
                <div className="text-base font-bold text-slate-200">
                  {overview.users.workers} Workers : {overview.users.providers} Providers
                </div>
                <div className="text-[10px] text-slate-500">{overview.users.agents} registered agents</div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[10px]">Account Integrity</div>
                <div className="text-base font-bold text-slate-200">
                  {overview.users.activeCount} Active / {overview.users.suspendedCount} Suspended
                </div>
                <div className="text-[10px] text-slate-500">
                  {Math.round((overview.users.activeCount / Math.max(1, overview.users.total)) * 100)}% active accounts
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Meaningful Platform Event Stream */}
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
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {eventsPage} of {Math.max(1, Math.ceil(eventsTotal / 10))}</span>
            <button
              onClick={() => setEventsPage((p) => p + 1)}
              disabled={eventsPage >= Math.ceil(eventsTotal / 10) || loading}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
