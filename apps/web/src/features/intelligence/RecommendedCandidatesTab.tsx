import React, { useEffect, useState } from "react";
import {
  Sparkles,
  CheckCircle,
  Star,
  MapPin,
  Clock,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { CandidateRecommendation } from "@nearvia/types";
import { RecommendationFeedback } from "./RecommendationFeedback";

interface RecommendedCandidatesTabProps {
  workOpportunityId: string;
  onSelectCandidate?: (candidate: CandidateRecommendation) => void;
}

export const RecommendedCandidatesTab: React.FC<RecommendedCandidatesTabProps> = ({
  workOpportunityId,
  onSelectCandidate,
}) => {
  const [candidates, setCandidates] = useState<CandidateRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/v1/intelligence/jobs/${workOpportunityId}/candidates`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (data.success && data.data?.candidates) {
        setCandidates(data.data.candidates);
      }
    } catch (err) {
      console.error("Failed to load recommended candidates", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [workOpportunityId]);

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="text-sm font-medium">Analyzing candidate trade skills & availability...</span>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-500">
        <Sparkles className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">No Active Nearby Candidates</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          We couldn't find available workers with matching trade profiles in your immediate radius right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            Top Matched Candidates ({candidates.length})
          </span>
        </div>
        <button
          onClick={fetchCandidates}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh Matches
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3.5">
        {candidates.map((cand) => {
          const isExpanded = expandedId === cand.workerId;
          const score = cand.match.score;
          const scoreColor =
            score >= 85
              ? "bg-emerald-500 text-white"
              : score >= 70
              ? "bg-indigo-500 text-white"
              : "bg-amber-500 text-white";

          return (
            <div
              key={cand.workerId}
              className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4.5 shadow-sm hover:shadow-md transition"
            >
              {/* Top Row: Worker Bio & Match Badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-inner">
                      {cand.fullName.charAt(0)}
                    </div>
                    {cand.verifiedBadge && (
                      <div className="absolute -bottom-1 -right-1 p-0.5 bg-white dark:bg-slate-800 rounded-full">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        {cand.fullName}
                      </h4>
                      {cand.verifiedBadge && (
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold px-1.5 py-0.2 rounded-full">
                          KYC Verified
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <strong>{cand.averageRating.toFixed(1)}</strong> ({cand.totalRatingsCount})
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {cand.distanceFormatted}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {cand.onTimeArrivalRate}% On-Time
                      </span>
                    </div>
                  </div>
                </div>

                {/* Match Score Badge */}
                <div className="flex flex-col items-end">
                  <div
                    className={`px-2.5 py-1 rounded-xl text-xs font-black tracking-wide shadow-sm ${scoreColor}`}
                  >
                    {score}% MATCH
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">
                    {cand.isAvailableNow ? "⚡ Available Now" : "Available on Shift Date"}
                  </span>
                </div>
              </div>

              {/* Skills Tag Pills */}
              {cand.skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cand.skills.map((s, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-lg font-medium"
                    >
                      {s.skillName} {s.yearsExperience > 0 ? `(${s.yearsExperience}y)` : ""}
                    </span>
                  ))}
                </div>
              )}

              {/* Explainable Reasons Summary */}
              <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                {cand.match.reasons.slice(0, 2).map((reason, idx) => (
                  <div key={idx} className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>

              {/* Collapsible Factor Breakdown & Limitations */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs space-y-2.5 animate-in fade-in duration-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Score Breakdown (Explainable Multi-Factor)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-slate-700 dark:text-slate-300">
                    <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                      <span className="text-slate-400 block text-[10px]">Skills (35%)</span>
                      <span className="font-bold">{cand.match.breakdown.skillScore}%</span>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                      <span className="text-slate-400 block text-[10px]">Availability (25%)</span>
                      <span className="font-bold">{cand.match.breakdown.availabilityScore}%</span>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                      <span className="text-slate-400 block text-[10px]">Proximity (20%)</span>
                      <span className="font-bold">{cand.match.breakdown.distanceScore}%</span>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                      <span className="text-slate-400 block text-[10px]">Reliability (10%)</span>
                      <span className="font-bold">{cand.match.breakdown.reliabilityScore}%</span>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                      <span className="text-slate-400 block text-[10px]">Rating (5%)</span>
                      <span className="font-bold">{cand.match.breakdown.ratingScore}%</span>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                      <span className="text-slate-400 block text-[10px]">Verification (5%)</span>
                      <span className="font-bold">{cand.match.breakdown.verificationBonus}%</span>
                    </div>
                  </div>

                  {cand.match.limitations.length > 0 && (
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300">
                      <span className="font-bold flex items-center gap-1 mb-0.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Limitations:
                      </span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {cand.match.limitations.map((lim, idx) => (
                          <li key={idx}>{lim}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <RecommendationFeedback
                    recommendationId={cand.workerId}
                    type="PROVIDER"
                    className="mt-2.5"
                  />
                </div>
              )}

              {/* Bottom Actions */}
              <div className="mt-3.5 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : cand.workerId)}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 font-medium"
                >
                  {isExpanded ? (
                    <>
                      <span>Hide Breakdown</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>View Factor Breakdown</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                {onSelectCandidate && (
                  <button
                    type="button"
                    onClick={() => onSelectCandidate(cand)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Invite Candidate</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
