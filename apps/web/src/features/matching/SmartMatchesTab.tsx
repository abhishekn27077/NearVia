import React, { useEffect, useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  MapPin,
  Clock,
  ShieldCheck,
  Heart,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Users,
  Award,
} from "lucide-react";
import { SmartMatchCandidate, JobMatchesResponse } from "@nearvia/types";
import { webConfig } from "../../config";
import { useAuth } from "../../context/AuthContext";

interface SmartMatchesTabProps {
  workOpportunityId: string;
  onContactWorker?: (worker: { workerId: string; fullName: string }) => void;
}

export const SmartMatchesTab: React.FC<SmartMatchesTabProps> = ({
  workOpportunityId,
  onContactWorker,
}) => {
  const { token } = useAuth();
  const [matches, setMatches] = useState<SmartMatchCandidate[]>([]);
  const [jobTitle, setJobTitle] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchMatches = async (radius: number = radiusKm) => {
    setLoading(true);
    setError(null);
    try {
      const authToken = token || localStorage.getItem("nearvia_auth_token") || "";
      const res = await fetch(
        `${webConfig.apiBaseUrl}/jobs/${workOpportunityId}/matches?radiusKm=${radius}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || "Failed to load smart matches.");
      }

      if (json.success && json.data) {
        const data: JobMatchesResponse = json.data;
        setMatches(data.matches || []);
        if (data.jobTitle) {
          setJobTitle(data.jobTitle);
        }
      }
    } catch (err: any) {
      setError(err.message || "Error connecting to smart matching service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workOpportunityId) {
      fetchMatches(radiusKm);
    }
  }, [workOpportunityId, radiusKm]);

  const toggleExpand = (workerId: string) => {
    setExpandedId((prev) => (prev === workerId ? null : workerId));
  };

  const handleTogglePreferred = async (workerId: string, currentStatus: boolean) => {
    try {
      const authToken = token || localStorage.getItem("nearvia_auth_token") || "";
      const url = `${webConfig.apiBaseUrl}/providers/me/preferred-workers/${workerId}`;
      const res = await fetch(url, {
        method: currentStatus ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        setMatches((prev) =>
          prev.map((c) =>
            c.workerId === workerId
              ? {
                  ...c,
                  isPreferredWorker: !currentStatus,
                  matchScore: !currentStatus ? Math.min(100, c.matchScore + 5) : Math.max(0, c.matchScore - 5),
                }
              : c
          )
        );
      }
    } catch (e) {
      console.error("Failed to toggle preferred status", e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-slate-200 shadow-card">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
              <Award className="w-4 h-4" />
            </div>
            <h3 className="text-base font-black text-slate-900 font-display">
              Smart Matches
            </h3>
            {!loading && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-100 text-orange-800">
                {matches.length} Eligible
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Deterministic ranking based on trade skills, live availability, and proximity • Recommended match (not guaranteed).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Radius Selector */}
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <MapPin className="w-3.5 h-3.5 text-orange-600" />
            <span>Radius:</span>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="bg-transparent font-black text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value={3}>3 KM</option>
              <option value={5}>5 KM (Default)</option>
              <option value={10}>10 KM</option>
              <option value={15}>15 KM</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => fetchMatches(radiusKm)}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition shadow-xs flex items-center space-x-1 text-xs font-bold"
            title="Refresh Matches"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-orange-600" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-5 rounded-3xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between shadow-card">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchMatches(radiusKm)}
            className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="py-20 text-center space-y-4">
          <div className="w-10 h-10 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <p className="text-xs font-black text-slate-800 font-display">
              Finding Best Matches for {jobTitle || "Job"}
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              Evaluating trade skills, calendar availability, and 5 km proximity...
            </p>
          </div>
        </div>
      ) : matches.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 p-8 rounded-3xl bg-white border border-slate-200 shadow-card max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="font-black text-lg text-slate-900 font-display">
            No matching workers found
          </h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            No available workers with the required skills were found within {radiusKm} km of the job site right now.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setRadiusKm(10)}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-xs"
            >
              Expand Radius to 10 KM
            </button>
          </div>
        </div>
      ) : (
        /* Matches List */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider px-2">
            <span>Best Matches ({matches.length} Candidates)</span>
            <span className="text-emerald-700 font-bold">100% Real Database Data</span>
          </div>

          {matches.map((cand) => {
            const isExpanded = expandedId === cand.workerId;
            const isHighMatch = cand.matchScore >= 90;
            const isMediumMatch = cand.matchScore >= 75;

            const scoreBadgeClass = isHighMatch
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : isMediumMatch
              ? "bg-amber-50 text-amber-800 border-amber-200"
              : "bg-slate-100 text-slate-700 border-slate-200";

            return (
              <div
                key={cand.workerId}
                className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 hover:border-orange-300 transition-all shadow-card space-y-5"
              >
                {/* Top Row: Rank, Worker Info & Score */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-4">
                    {/* Rank Pill */}
                    <div className="w-8 h-8 rounded-xl bg-slate-900 text-white text-xs font-black flex items-center justify-center shrink-0 font-display">
                      #{cand.rank}
                    </div>

                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-800 text-base font-black flex items-center justify-center shrink-0 overflow-hidden">
                      {cand.avatarUrl ? (
                        <img
                          src={cand.avatarUrl}
                          alt={cand.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        cand.fullName.charAt(0)
                      )}
                    </div>

                    {/* Name & Badges */}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h4 className="text-base font-black text-slate-900 font-display">
                          {cand.fullName}
                        </h4>

                        {/* Preferred Worker Badge */}
                        {cand.isPreferredWorker && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
                            <Heart className="w-2.5 h-2.5 fill-rose-600 text-rose-600" />
                            <span>Preferred Worker</span>
                          </span>
                        )}

                        {/* Verified Badge */}
                        {cand.isVerified && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200 flex items-center space-x-1">
                            <ShieldCheck className="w-2.5 h-2.5 text-blue-600" />
                            <span>Verified</span>
                          </span>
                        )}

                        {/* New Worker Badge */}
                        {cand.isNewWorker && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            New Worker • Building Track Record
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 text-xs text-slate-500 font-medium flex-wrap gap-y-1">
                        {cand.experienceYears > 0 && (
                          <span>{cand.experienceYears} yrs trade experience</span>
                        )}
                        {cand.averageRating !== undefined && cand.tasksCompletedCount !== undefined && (
                          <span className="text-amber-600 font-bold flex items-center space-x-1">
                            <span>⭐ {cand.averageRating}</span>
                            <span className="text-slate-400 font-normal">
                              ({cand.tasksCompletedCount} shifts)
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Match Score Pill & Contact Action */}
                  <div className="flex items-center space-x-3 shrink-0 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleTogglePreferred(cand.workerId, !!cand.isPreferredWorker)}
                      className={`p-2 rounded-xl border transition-all ${
                        cand.isPreferredWorker
                          ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                          : "bg-white border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200"
                      }`}
                      title={cand.isPreferredWorker ? "Remove from Preferred" : "Mark as Preferred Worker"}
                    >
                      <Heart className={`w-4 h-4 ${cand.isPreferredWorker ? "fill-rose-600" : ""}`} />
                    </button>

                    <div className={`px-3.5 py-1.5 rounded-2xl border text-xs font-black flex items-center space-x-1.5 shadow-2xs ${scoreBadgeClass}`}>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{cand.matchScore}% Match</span>
                    </div>

                    {onContactWorker && (
                      <button
                        type="button"
                        onClick={() => onContactWorker({ workerId: cand.workerId, fullName: cand.fullName })}
                        className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition shadow-xs flex items-center space-x-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Message</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Middle: Why Matched Highlight Box */}
                <div className="p-3.5 rounded-2xl bg-[#FAFAF9] border border-slate-200 flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-slate-800">
                      {cand.whyMatched}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {cand.matchHighlights.map((hl, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-0.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700"
                        >
                          {hl}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Matched Skills & Logistics Chips */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-400 font-bold text-[11px] uppercase tracking-wider">
                      Matched Skills:
                    </span>
                    {cand.matchedSkills.length > 0 ? (
                      cand.matchedSkills.map((sk, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-[11px]"
                        >
                          ✓ {sk}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500 font-medium italic text-[11px]">
                        General trade capabilities
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 text-slate-600 text-xs font-semibold">
                    <span className="flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-orange-600" />
                      <span>{cand.approximateDistanceFormatted}</span>
                    </span>

                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        {cand.isAvailableNow ? "Available Now" : "Scheduled"}
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleExpand(cand.workerId)}
                      className="text-slate-400 hover:text-slate-700 p-1"
                      title="Toggle details"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Card */}
                {isExpanded && (
                  <div className="pt-3 border-t border-slate-100 space-y-3 text-xs">
                    {cand.bio && (
                      <div>
                        <span className="font-bold text-slate-700">Worker Bio: </span>
                        <span className="text-slate-600">{cand.bio}</span>
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-slate-700">All Registered Trade Skills: </span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {cand.allSkills.map((s, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
