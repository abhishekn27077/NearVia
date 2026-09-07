import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Users,
  Star,
  MapPin,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  UserCheck,
  MessageSquare,
} from "lucide-react";
import {
  ApplicantListItem,
  ApplicationStatus,
  WorkOpportunityDetail,
} from "@nearvia/types";
import { formatDistanceKm } from "../../utils";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";
import { MessageModal } from "../messages/MessageModal";
import { RecommendedCandidatesTab } from "../intelligence";

export const OpportunityApplicantsPage: React.FC = () => {
  const { id: opportunityId } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<"APPLICANTS" | "RECOMMENDED">("APPLICANTS");
  const [opportunity, setOpportunity] = useState<WorkOpportunityDetail | null>(null);
  const [applicants, setApplicants] = useState<ApplicantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [activeChatCandidate, setActiveChatCandidate] = useState<{
    workerUserId: string;
    workerFullName: string;
  } | null>(null);

  const fetchOpportunityAndApplicants = async () => {
    if (!opportunityId) return;
    try {
      setLoading(true);
      setError(null);

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Fetch opportunity details
      const oppRes = await fetch(
        `${webConfig.apiBaseUrl}/work-opportunities/${opportunityId}`,
        { headers },
      );
      const oppData = await oppRes.json();
      if (!oppRes.ok || !oppData.success) {
        throw new Error(oppData.error?.message || "Failed to load opportunity.");
      }
      setOpportunity(oppData.data);

      // Fetch applicants
      const appRes = await fetch(
        `${webConfig.apiBaseUrl}/work-opportunities/${opportunityId}/applicants`,
        { headers },
      );
      const appData = await appRes.json();
      if (!appRes.ok || !appData.success) {
        throw new Error(appData.error?.message || "Failed to load applicants.");
      }
      setApplicants(appData.data || []);
    } catch (err: any) {
      setError(err.message || "Error loading applicants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunityAndApplicants();
  }, [opportunityId, token]);

  const handleShortlist = async (applicationId: string) => {
    setActionLoadingId(applicationId);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(
        `${webConfig.apiBaseUrl}/applications/${applicationId}/shortlist`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ decisionNotes: "Shortlisted for consideration" }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to shortlist candidate.");
      }
      await fetchOpportunityAndApplicants();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (applicationId: string) => {
    if (!window.confirm("Are you sure you want to decline this applicant?")) {
      return;
    }
    setActionLoadingId(applicationId);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(
        `${webConfig.apiBaseUrl}/applications/${applicationId}/reject`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ decisionNotes: "Declined for this role" }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to decline candidate.");
      }
      await fetchOpportunityAndApplicants();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAccept = async (applicationId: string, workerName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to select and hire ${workerName}? This will lock the shift assignment and generate the verification check-in pass.`,
      )
    ) {
      return;
    }

    setActionLoadingId(applicationId);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(
        `${webConfig.apiBaseUrl}/applications/${applicationId}/accept`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ decisionNotes: "Selected and hired" }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to accept candidate.");
      }
      alert(`🎉 Successfully hired ${workerName}! Assignment locked.`);
      await fetchOpportunityAndApplicants();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const isFull = Boolean(
    opportunity &&
      (opportunity.workersAssigned || 0) >= (opportunity.workersNeeded || 1),
  );

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation & Header */}
        <div>
          <Link
            to={`/provider/work/${opportunityId}`}
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Work Details</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
                Candidate Applicants
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                Review verified worker applications matched within 5 km.
              </p>
            </div>

            {opportunity && (
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center space-x-4">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Hiring Status</div>
                  <div className="text-sm font-black text-slate-900">
                    {opportunity.workersAssigned || 0} / {opportunity.workersNeeded} Hired
                  </div>
                </div>
                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-600 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (((opportunity.workersAssigned || 0) / (opportunity.workersNeeded || 1)) * 100),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Capacity Full Banner */}
        {isFull && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>All required worker positions ({opportunity?.workersNeeded}) have been filled!</span>
          </div>
        )}

        {/* Dual Tab Switcher: Direct Applicants vs AI Recommended Workers */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 max-w-md">
          <button
            type="button"
            onClick={() => setActiveTab("APPLICANTS")}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === "APPLICANTS"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Applied Candidates ({applicants.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("RECOMMENDED")}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === "RECOMMENDED"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Recommended</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "RECOMMENDED" ? (
          <RecommendedCandidatesTab workOpportunityId={opportunityId || ""} />
        ) : loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading candidate applications...</p>
          </div>
        ) : applicants.length === 0 ? (
          <div className="text-center py-16 p-8 rounded-3xl bg-white border border-slate-200 shadow-card max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto text-orange-600">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="font-black text-lg text-slate-900 font-display">No applicants yet</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Your opportunity is broadcast to verified workers within 5 km. You will see candidate profiles and AI match scores here as soon as workers apply.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider px-2">
              <span>{applicants.length} Candidates (Sorted by Match Score)</span>
              <span className="flex items-center space-x-1 text-orange-600">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Explainable AI Match</span>
              </span>
            </div>

            {applicants.map((cand) => (
              <div
                key={cand.applicationId}
                className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 hover:border-orange-300 transition-all space-y-5 shadow-card"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-800 text-base font-black flex items-center justify-center shrink-0">
                      {cand.workerAvatarUrl ? (
                        <img
                          src={cand.workerAvatarUrl}
                          alt={cand.workerFullName}
                          className="w-full h-full rounded-2xl object-cover"
                        />
                      ) : (
                        cand.workerFullName.charAt(0)
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h3 className="text-base font-black text-slate-900 font-display">
                          {cand.workerFullName}
                        </h3>
                        {cand.workerIsAvailableNow && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Available Now
                          </span>
                        )}
                        {cand.workerIdentityVerified ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200">
                            ID ✓
                          </span>
                        ) : cand.workerPhoneVerified ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Phone ✓
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                            Email ✓
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {cand.status}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 text-xs text-slate-500 font-semibold flex-wrap gap-y-1">
                        <span className="flex items-center space-x-1 text-amber-600 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          <span>{cand.workerRating.toFixed(1)}</span>
                          <span className="text-slate-400 font-normal">
                            ({cand.workerCompletedTasks} tasks)
                          </span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-blue-600" />
                          <span>{formatDistanceKm(cand.workerDistanceKm)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Match Score Badge */}
                  <div className="flex items-center space-x-3 sm:self-center">
                    <button
                      onClick={() =>
                        setExpandedMatchId(
                          expandedMatchId === cand.applicationId ? null : cand.applicationId,
                        )
                      }
                      className="px-3.5 py-1.5 rounded-xl bg-orange-50 text-orange-900 border border-orange-200 text-xs font-bold flex items-center space-x-1.5 hover:bg-orange-100 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                      <span>{cand.matchScore}% Match</span>
                      {expandedMatchId === cand.applicationId ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Candidate Pitch / Note */}
                {cand.workerNotes && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-medium text-slate-700 leading-relaxed">
                    <span className="font-bold text-slate-900 block mb-1">Applicant Note:</span>
                    "{cand.workerNotes}"
                  </div>
                )}

                {/* Expanded Match Explanation */}
                {expandedMatchId === cand.applicationId && cand.matchReasons && cand.matchReasons.length > 0 && (
                  <div className="p-5 rounded-2xl bg-orange-50/60 border border-orange-200/80 space-y-3">
                    <div className="text-xs font-bold text-orange-900">
                      Why {cand.workerFullName} is a strong match:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {cand.matchReasons.map((r: string, idx: number) => (
                        <div key={idx} className="flex items-center space-x-2 text-slate-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-400">
                    Applied on {new Date(cand.appliedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveChatCandidate({
                          workerUserId: cand.workerUserId,
                          workerFullName: cand.workerFullName,
                        })
                      }
                      className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-colors flex items-center space-x-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Message</span>
                    </button>

                    {cand.status === ApplicationStatus.PENDING && (
                      <button
                        onClick={() => handleShortlist(cand.applicationId)}
                        disabled={actionLoadingId === cand.applicationId}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        Shortlist
                      </button>
                    )}

                    {cand.status !== ApplicationStatus.ACCEPTED &&
                      cand.status !== ApplicationStatus.REJECTED && (
                        <>
                          <button
                            onClick={() => handleReject(cand.applicationId)}
                            disabled={actionLoadingId === cand.applicationId}
                            className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors disabled:opacity-50"
                          >
                            Decline
                          </button>

                          <button
                            onClick={() => handleAccept(cand.applicationId, cand.workerFullName)}
                            disabled={isFull || actionLoadingId === cand.applicationId}
                            className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-md shadow-orange-600/20 flex items-center space-x-1.5 disabled:opacity-50"
                          >
                            <UserCheck className="w-4 h-4" />
                            <span>Select & Hire</span>
                          </button>
                        </>
                      )}

                    {cand.status === ApplicationStatus.ACCEPTED && (
                      <span className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Hired & Assigned</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Message Modal */}
        {activeChatCandidate && opportunity && (
          <MessageModal
            isOpen={!!activeChatCandidate}
            onClose={() => setActiveChatCandidate(null)}
            workOpportunityId={opportunity.id}
            opportunityTitle={opportunity.title}
            counterpartyName={activeChatCandidate.workerFullName}
            targetWorkerUserId={activeChatCandidate.workerUserId}
          />
        )}
      </div>
    </div>
  );
};
