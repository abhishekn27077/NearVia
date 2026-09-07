import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  MapPin,
  Users,
  Sparkles,
  Eye,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";
import {
  WorkOpportunityDetail,
  WorkOpportunityStatus,
} from "@nearvia/types";
import { formatCurrencyINR, formatScheduleRange } from "../../utils";

export const ProviderWorkListPage: React.FC = () => {
  const { token } = useAuth();

  const [opportunities, setOpportunities] = useState<WorkOpportunityDetail[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    loadOpportunities();
  }, [token, selectedStatus]);

  const loadOpportunities = async () => {
    setIsLoading(true);
    try {
      const url =
        selectedStatus === "ALL"
          ? `${webConfig.apiBaseUrl}/work-opportunities/mine`
          : `${webConfig.apiBaseUrl}/work-opportunities/mine?status=${selectedStatus}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        setOpportunities(json.data || []);
      }
    } catch {
      // Fallback
      setOpportunities([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const res = await fetch(
        `${webConfig.apiBaseUrl}/work-opportunities/${id}/publish`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        setFeedback({
          type: "success",
          message: "Work opportunity published live to nearby workers within 5 km.",
        });
        loadOpportunities();
      } else {
        setFeedback({
          type: "error",
          message: "Failed to publish work opportunity.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Network error occurred while publishing.",
      });
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this work opportunity?")) {
      return;
    }

    try {
      const res = await fetch(
        `${webConfig.apiBaseUrl}/work-opportunities/${id}/cancel`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        setFeedback({
          type: "success",
          message: "Work opportunity cancelled.",
        });
        loadOpportunities();
      } else {
        setFeedback({
          type: "error",
          message: "Failed to cancel work opportunity.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Network error occurred while cancelling.",
      });
    }
  };

  const statuses = [
    { label: "All Opportunities", value: "ALL" },
    { label: "Drafts", value: WorkOpportunityStatus.DRAFT },
    { label: "Published", value: WorkOpportunityStatus.PUBLISHED },
    { label: "Matching", value: WorkOpportunityStatus.MATCHING },
    { label: "Active Shifts", value: WorkOpportunityStatus.IN_PROGRESS },
    { label: "Completed", value: WorkOpportunityStatus.COMPLETED },
    { label: "Cancelled", value: WorkOpportunityStatus.CANCELLED },
  ];

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header & Quick Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold border border-orange-100 mb-1">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Provider Work Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              Your Posted Work Opportunities
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
              Track tasks, shifts, applicants, and assignments posted within your 5 km radius.
            </p>
          </div>

          <Link
            to="/provider/work/new"
            className="px-6 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-md shadow-orange-600/20 flex items-center space-x-2 self-start sm:self-auto shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Post New Opportunity</span>
          </Link>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl text-xs font-medium flex items-center space-x-3 shadow-xs ${
              feedback.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
          {statuses.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedStatus(tab.value)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedStatus === tab.value
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Opportunities List */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading work opportunities...</p>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="text-center py-16 p-8 rounded-3xl bg-white border border-slate-200 shadow-card max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto text-orange-600">
              <Briefcase className="w-7 h-7" />
            </div>
            <h3 className="font-black text-lg text-slate-900 font-display">
              No work opportunities found
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              {selectedStatus === "ALL"
                ? "You haven't posted any micro-tasks or shifts yet. Publish your first opportunity to discover local workers."
                : `No opportunities currently match the "${selectedStatus}" filter.`}
            </p>
            <div className="pt-2">
              <Link
                to="/provider/work/new"
                className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs shadow-md shadow-orange-600/20"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Post First Opportunity</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {opportunities.map((opp) => {
              const scheduleStr = formatScheduleRange(
                opp.workDate,
                opp.startTime,
                opp.endTime,
                opp.durationHours,
              );

              return (
                <div
                  key={opp.id}
                  className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 hover:border-orange-300 hover:shadow-card-hover transition-all space-y-4 shadow-card"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-xs font-black">
                        {opp.workType}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                        {opp.categoryName || "General Services"}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                          opp.status === WorkOpportunityStatus.PUBLISHED ||
                          opp.status === WorkOpportunityStatus.MATCHING
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : opp.status === WorkOpportunityStatus.DRAFT
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : opp.status === WorkOpportunityStatus.CANCELLED
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {opp.status}
                      </span>
                    </div>

                    <div className="sm:text-right">
                      <div className="font-black text-xl text-emerald-600 font-display">
                        {formatCurrencyINR(opp.paymentAmount)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        {opp.paymentType} Payout
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 hover:text-orange-600 transition-colors font-display">
                      <Link to={`/provider/work/${opp.id}`}>{opp.title}</Link>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1 line-clamp-2 leading-relaxed">
                      {opp.description}
                    </p>
                  </div>

                  {/* Schedule, Location & Worker Count Row */}
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 pt-3 border-t border-slate-100">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-4 h-4 text-orange-600" />
                      <span>{scheduleStr}</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <span>{opp.addressApproximate || "Indiranagar, Bangalore"}</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <Users className="w-4 h-4 text-emerald-600" />
                      <span>
                        {opp.workersAssigned || 0} / {opp.workersNeeded} Workers Assigned
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center space-x-2">
                      {opp.status === WorkOpportunityStatus.DRAFT && (
                        <button
                          type="button"
                          onClick={() => handlePublish(opp.id)}
                          className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-xs flex items-center space-x-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Publish Now</span>
                        </button>
                      )}

                      {opp.status === WorkOpportunityStatus.PUBLISHED && (
                        <button
                          type="button"
                          onClick={() => handleCancel(opp.id)}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-bold transition-colors"
                        >
                          Cancel Listing
                        </button>
                      )}
                    </div>

                    <Link
                      to={`/provider/work/${opp.id}`}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition-all flex items-center space-x-1.5 shadow-xs"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View & Manage Applicants</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
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
