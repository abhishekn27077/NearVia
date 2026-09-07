import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Users,
  Briefcase,
  AlertTriangle,
  Flag,
  IndianRupee,
  Activity,
  Search,
  Shield,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import {
  AdminUsersTab,
  AdminWorkTab,
  AdminVerificationsTab,
  AdminReportsTab,
  AdminDisputesTab,
  AdminPaymentsTab,
  AdminAuditLogsTab,
  AdminAnalyticsTab,
} from "../../features/admin";
import { formatCurrencyINR } from "../../utils";

type TabKey =
  | "OVERVIEW"
  | "ANALYTICS"
  | "USERS"
  | "WORK"
  | "VERIFICATIONS"
  | "REPORTS"
  | "DISPUTES"
  | "PAYMENTS"
  | "AUDIT";

export const AdminDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("OVERVIEW");
  const [metrics, setMetrics] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchMetrics = useCallback(async () => {
    try {
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch("/api/v1/admin/dashboard", {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMetrics(data.data);
      }
    } catch (err: any) {
      console.error("Network error:", err);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setActiveTab("USERS");
  };

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "OVERVIEW", label: "Overview", icon: Activity },
    { key: "ANALYTICS", label: "Live Pulse", icon: TrendingUp },
    { key: "USERS", label: "Users & Accounts", icon: Users },
    { key: "WORK", label: "Work Marketplace", icon: Briefcase },
    { key: "VERIFICATIONS", label: "Trust & KYC", icon: ShieldCheck },
    { key: "REPORTS", label: "Trust & Safety", icon: Flag },
    { key: "DISPUTES", label: "Escalations", icon: AlertTriangle },
    { key: "PAYMENTS", label: "Settlement Vault", icon: IndianRupee },
    { key: "AUDIT", label: "Audit Trails", icon: Shield },
  ];

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header Banner */}
        <div className="p-6 sm:p-8 rounded-3xl card-premium flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold border border-orange-100 mb-1">
              <Shield className="w-3.5 h-3.5" />
              <span>Platform Operations Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display-title">
              NEARVIA Master Admin Command Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
              Real-time monitoring, multi-role management, dispute resolution, and security oversight.
            </p>
          </div>

          {/* Quick Search */}
          <form onSubmit={handleSearch} className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user, job, ref ID..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:bg-white focus:border-orange-500"
            />
          </form>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center space-x-2 whitespace-nowrap btn-tactile active:scale-95 transition-all ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]"
                    : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === "OVERVIEW" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-6 rounded-3xl card-premium">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-caption-refined">Total Users</div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-display-title">
                  {metrics?.totalUsers ?? metrics?.users?.totalUsers ?? 0}
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">
                  Workers: {metrics?.totalWorkers ?? metrics?.users?.workersCount ?? 0} • Employers: {metrics?.totalProviders ?? metrics?.users?.providersCount ?? 0}
                </div>
              </div>

              <div className="p-6 rounded-3xl card-premium">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-caption-refined">Active Work Listings</div>
                <div className="text-2xl font-black text-orange-600 mt-1 font-display-title">
                  {metrics?.publishedWorkCount ?? metrics?.work?.openOpportunities ?? 0}
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">
                  Active Shifts: {metrics?.activeAssignmentsCount ?? 0} • Completed: {metrics?.completedAssignmentsCount ?? 0}
                </div>
              </div>

              <div className={`p-6 rounded-3xl card-premium transition-all ${
                (metrics?.openDisputesCount ?? metrics?.disputes?.openDisputes ?? 0) > 0
                  ? "ring-2 ring-rose-500/20 bg-rose-50/20"
                  : ""
              }`}>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-caption-refined">Active Disputes</div>
                  {(metrics?.openDisputesCount ?? metrics?.disputes?.openDisputes ?? 0) > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  )}
                </div>
                <div className="text-2xl font-black text-rose-600 mt-1 font-display-title">
                  {metrics?.openDisputesCount ?? metrics?.disputes?.openDisputes ?? 0}
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">
                  {(metrics?.openDisputesCount ?? metrics?.disputes?.openDisputes ?? 0) > 0 ? "Requires immediate arbitration" : "Zero open disputes"}
                </div>
              </div>

              <div className="p-6 rounded-3xl card-premium">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-caption-refined">Total Settlement Volume</div>
                <div className="text-2xl font-black text-emerald-600 mt-1 font-display-title">
                  {formatCurrencyINR(
                    metrics?.confirmedPaymentsVolume ??
                      (metrics?.payments?.totalVolumePaise ? metrics.payments.totalVolumePaise / 100 : 0)
                  )}
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">Direct instant disbursements</div>
              </div>
            </div>

            {/* WHAT NEEDS ATTENTION NOW? — Priority Operational Action Hub */}
            <div className="p-6 sm:p-8 rounded-3xl card-premium space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>
                  <h3 className="text-base font-black text-slate-900 font-display-title">
                    What Needs Attention Now? (Live Operational Alerts)
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Pilot Incident SLA: &lt; 15 Mins
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Pending Verifications */}
                <button
                  type="button"
                  onClick={() => setActiveTab("VERIFICATIONS")}
                  className={`p-4 rounded-2xl border text-left transition-all group ${
                    (metrics?.pendingVerificationsCount || 0) > 0
                      ? "bg-amber-50/70 border-amber-200 hover:bg-amber-100/70"
                      : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">KYC Verifications</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                        (metrics?.pendingVerificationsCount || 0) > 0
                          ? "bg-amber-200 text-amber-900"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {metrics?.pendingVerificationsCount || 0}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-1">
                    {(metrics?.pendingVerificationsCount || 0) > 0
                      ? "Pending identity / business reviews"
                      : "Queue is all caught up"}
                  </p>
                </button>

                {/* 2. Open Disputes */}
                <button
                  type="button"
                  onClick={() => setActiveTab("DISPUTES")}
                  className={`p-4 rounded-2xl border text-left transition-all group ${
                    (metrics?.openDisputesCount || 0) > 0
                      ? "bg-rose-50/70 border-rose-200 hover:bg-rose-100/70"
                      : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">Active Disputes</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                        (metrics?.openDisputesCount || 0) > 0
                          ? "bg-rose-200 text-rose-900 animate-bounce"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {metrics?.openDisputesCount || 0}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-1">
                    {(metrics?.openDisputesCount || 0) > 0
                      ? "Escalations needing mediation"
                      : "Zero unresolved disputes"}
                  </p>
                </button>

                {/* 3. Safety Reports */}
                <button
                  type="button"
                  onClick={() => setActiveTab("REPORTS")}
                  className={`p-4 rounded-2xl border text-left transition-all group ${
                    (metrics?.openReportsCount || 0) > 0
                      ? "bg-orange-50/70 border-orange-200 hover:bg-orange-100/70"
                      : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">Safety Reports</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                        (metrics?.openReportsCount || 0) > 0
                          ? "bg-orange-200 text-orange-900"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {metrics?.openReportsCount || 0}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-1">
                    {(metrics?.openReportsCount || 0) > 0
                      ? "Incidents flagged by users"
                      : "No active safety incidents"}
                  </p>
                </button>

                {/* 4. Pending Settlements */}
                <button
                  type="button"
                  onClick={() => setActiveTab("PAYMENTS")}
                  className={`p-4 rounded-2xl border text-left transition-all group ${
                    (metrics?.pendingPaymentsCount || 0) > 0
                      ? "bg-blue-50/70 border-blue-200 hover:bg-blue-100/70"
                      : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">Pending Settlements</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                        (metrics?.pendingPaymentsCount || 0) > 0
                          ? "bg-blue-200 text-blue-900"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {metrics?.pendingPaymentsCount || 0}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-1">
                    {(metrics?.pendingPaymentsCount || 0) > 0
                      ? "Disbursements awaiting verification"
                      : "All settlements confirmed"}
                  </p>
                </button>
              </div>
            </div>

            {/* Quick Action Hub */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
              <h3 className="text-base font-black text-slate-900 font-display">Platform Operations Fast-Track</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => setActiveTab("USERS")}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-orange-50/50 hover:border-orange-200 border border-slate-200 text-left transition-all group"
                >
                  <div className="font-extrabold text-xs text-slate-900 group-hover:text-orange-900 flex items-center justify-between">
                    <span>Manage User Accounts</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-orange-600" />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Block, verify, or review user roles</div>
                </button>

                <button
                  onClick={() => setActiveTab("DISPUTES")}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-orange-50/50 hover:border-orange-200 border border-slate-200 text-left transition-all group"
                >
                  <div className="font-extrabold text-xs text-slate-900 group-hover:text-orange-900 flex items-center justify-between">
                    <span>Resolve Open Disputes</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-orange-600" />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Mediate wage and attendance conflicts</div>
                </button>

                <button
                  onClick={() => setActiveTab("PAYMENTS")}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-orange-50/50 hover:border-orange-200 border border-slate-200 text-left transition-all group"
                >
                  <div className="font-extrabold text-xs text-slate-900 group-hover:text-orange-900 flex items-center justify-between">
                    <span>Platform Settlements</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-orange-600" />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Inspect disbursements and gateway logs</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "ANALYTICS" && <AdminAnalyticsTab />}
        {activeTab === "USERS" && <AdminUsersTab />}
        {activeTab === "WORK" && <AdminWorkTab />}
        {activeTab === "VERIFICATIONS" && <AdminVerificationsTab />}
        {activeTab === "REPORTS" && <AdminReportsTab />}
        {activeTab === "DISPUTES" && <AdminDisputesTab />}
        {activeTab === "PAYMENTS" && <AdminPaymentsTab />}
        {activeTab === "AUDIT" && <AdminAuditLogsTab />}
      </div>
    </div>
  );
};
