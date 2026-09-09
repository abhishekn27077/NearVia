import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Clock,
  MapPin,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  Calendar,
} from "lucide-react";
import { ApplicationDetail, ApplicationStatus } from "@nearvia/types";
import { formatCurrencyINR, formatScheduleRange } from "../../utils";

export const WorkerApplicationsPage: React.FC = () => {
  const [applications, setApplications] = useState<ApplicationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch("/api/v1/applications/mine", {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to load your applications.");
      }
      setApplications(data.data || []);
    } catch (err: any) {
      setError(err.message || "Error fetching applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleWithdraw = async (applicationId: string) => {
    if (!window.confirm("Are you sure you want to withdraw this application?")) {
      return;
    }
    setWithdrawingId(applicationId);
    try {
      const res = await fetch(
        `/api/v1/applications/${applicationId}/withdraw`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Withdrawn by worker" }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to withdraw application.");
      }
      await fetchApplications();
    } catch (err: any) {
      alert(err.message || "Error withdrawing application");
    } finally {
      setWithdrawingId(null);
    }
  };

  const filteredApps = applications.filter((app) => {
    if (activeFilter === "ALL") return true;
    return app.status === activeFilter;
  });

  const getStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case ApplicationStatus.PENDING:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Review</span>
          </span>
        );
      case ApplicationStatus.SHORTLISTED:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Shortlisted ✨</span>
          </span>
        );
      case ApplicationStatus.ACCEPTED:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Hired & Assigned 🎉</span>
          </span>
        );
      case ApplicationStatus.REJECTED:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
            <XCircle className="w-3.5 h-3.5" />
            <span>Declined</span>
          </span>
        );
      case ApplicationStatus.WITHDRAWN:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 flex items-center space-x-1">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Withdrawn</span>
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold border border-orange-100 mb-1">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Application Tracker</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              Your Work Applications
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
              Track status, shortlisted notifications, and employer selections in real-time.
            </p>
          </div>

          <Link
            to="/worker/find-work"
            className="px-5 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-md shadow-orange-600/20 flex items-center space-x-2 self-start sm:self-auto shrink-0"
          >
            <span>Explore 5 KM Work</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
          {[
            { label: "All Applications", value: "ALL" },
            { label: "Pending", value: ApplicationStatus.PENDING },
            { label: "Shortlisted", value: ApplicationStatus.SHORTLISTED },
            { label: "Hired 🎉", value: ApplicationStatus.ACCEPTED },
            { label: "Declined", value: ApplicationStatus.REJECTED },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeFilter === tab.value
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading your applications...</p>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="text-center py-16 p-8 rounded-3xl bg-white border border-slate-200 shadow-card max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto text-orange-600">
              <Briefcase className="w-7 h-7" />
            </div>
            <h3 className="font-black text-lg text-slate-900 font-display">No applications found</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              {activeFilter === "ALL"
                ? "You have not applied to any micro-tasks or shifts yet. Find nearby opportunities within 5 km to get hired today."
                : `No applications with "${activeFilter}" status.`}
            </p>
            <div className="pt-2">
              <Link
                to="/worker/find-work"
                className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs shadow-md shadow-orange-600/20"
              >
                <span>Find Nearby Work</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApps.map((app) => {
              const scheduleStr = formatScheduleRange(
                app.workDate,
                app.startTime,
                app.endTime,
                app.durationHours,
              );

              return (
                <div
                  key={app.id}
                  className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 hover:border-orange-300 hover:shadow-card-hover transition-all space-y-5 shadow-card"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-xs font-black">
                        {app.workType || "TASK"}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                        {app.categoryName || "General Services"}
                      </span>
                      {app.isAgentAssisted && (
                        <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black">
                          🤝 Agent-Assisted
                        </span>
                      )}
                      {getStatusBadge(app.status)}
                    </div>

                    <div className="sm:text-right">
                      <div className="font-black text-xl text-emerald-600 font-display">
                        {formatCurrencyINR(app.paymentAmount)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">
                        {app.paymentType} Payout
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 hover:text-orange-600 transition-colors font-display">
                      <Link to={`/provider/work/${app.workOpportunityId}`}>
                        {app.opportunityTitle || "Work Opportunity"}
                      </Link>
                    </h3>
                    {app.opportunityDescription && (
                      <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1 line-clamp-2 leading-relaxed">
                        {app.opportunityDescription}
                      </p>
                    )}
                  </div>

                  {/* Schedule & Location */}
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 pt-3 border-t border-slate-100">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-4 h-4 text-orange-600" />
                      <span>{scheduleStr}</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <span>{app.addressApproximate || "Indiranagar, Bangalore"}</span>
                    </div>
                  </div>

                  {/* Pitch Note & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-slate-400 font-semibold">
                      Applied on {new Date(app.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </div>

                    <div className="flex items-center space-x-2">
                      {app.status === ApplicationStatus.ACCEPTED ? (
                        <Link
                          to="/worker/assignments"
                          className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-md shadow-orange-600/20 flex items-center space-x-1.5"
                        >
                          <span>Go to Live Assignment</span>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      ) : app.status === ApplicationStatus.PENDING ||
                        app.status === ApplicationStatus.SHORTLISTED ? (
                        <button
                          type="button"
                          onClick={() => handleWithdraw(app.id)}
                          disabled={withdrawingId === app.id}
                          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {withdrawingId === app.id ? "Withdrawing..." : "Withdraw Application"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
