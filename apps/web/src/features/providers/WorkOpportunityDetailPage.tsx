import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Briefcase,
  ArrowLeft,
  Clock,
  MapPin,
  IndianRupee,
  Users,
  CheckCircle2,
  AlertCircle,
  Edit3,
  FileCheck2,
  XCircle,
  Sparkles,
  ShieldCheck,
  Check,
  Lock,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";
import {
  WorkOpportunityDetail,
  WorkOpportunityStatus,
  MatchExplanation,
  UserRole,
  GeoCoordinates,
} from "@nearvia/types";
import { ApplyModal } from "../applications/ApplyModal";
import { DirectionsModal } from "../discovery/DirectionsModal";
import {
  formatCurrencyINR,
  formatScheduleRange,
} from "../../utils";
import {
  calculateHaversineDistanceKm,
  formatDistance,
} from "@nearvia/shared";

export const WorkOpportunityDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [opportunity, setOpportunity] = useState<WorkOpportunityDetail | null>(null);
  const [matchExplanation, setMatchExplanation] = useState<MatchExplanation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [showDirectionsModal, setShowDirectionsModal] = useState<boolean>(false);
  const [hasApplied, setHasApplied] = useState<boolean>(false);
  const [workerLocation, setWorkerLocation] = useState<GeoCoordinates>({
    latitude: 12.9716,
    longitude: 77.5946,
  });

  useEffect(() => {
    if (id) {
      loadOpportunity(id);
      if (user?.role === UserRole.WORKER) {
        loadMatchExplanation(id);
        loadWorkerLocation();
      }
    }
  }, [id, token, user]);

  const loadWorkerLocation = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setWorkerLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        () => {},
      );
    }
  };

  const loadMatchExplanation = async (oppId: string) => {
    try {
      const res = await fetch(
        `${webConfig.apiBaseUrl}/matching/work/${oppId}/explain`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const json = await res.json();
        setMatchExplanation(json.data);
      }
    } catch {
      // Fallback
    }
  };

  const loadOpportunity = async (oppId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `${webConfig.apiBaseUrl}/work-opportunities/${oppId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        const json = await res.json();
        setOpportunity(json.data);
      }
    } catch {
      // Fallback
      setOpportunity(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!id) return;
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
          message: "Work opportunity published live to workers within 5 km.",
        });
        loadOpportunity(id);
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Failed to publish opportunity.",
      });
    }
  };

  const handleCancel = async () => {
    if (!id || !window.confirm("Are you sure you want to cancel this posting?")) return;
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
          message: "Work opportunity has been cancelled.",
        });
        loadOpportunity(id);
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Failed to cancel opportunity.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 w-full bg-[#FAFAF9] py-20 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading opportunity details...</p>
        </div>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="flex-1 w-full bg-[#FAFAF9] py-20">
        <div className="max-w-md mx-auto p-8 rounded-3xl bg-white border border-slate-200 shadow-card text-center space-y-4">
          <Briefcase className="w-10 h-10 text-slate-400 mx-auto" />
          <h2 className="text-lg font-black text-slate-900">Work Opportunity Not Found</h2>
          <p className="text-xs text-slate-500">The posting may have expired or been removed.</p>
          <Link
            to="/provider/work"
            className="inline-flex px-5 py-2.5 rounded-xl bg-orange-600 text-white font-bold text-xs shadow-xs"
          >
            Back to Postings
          </Link>
        </div>
      </div>
    );
  }

  const scheduleStr = formatScheduleRange(
    opportunity.workDate,
    opportunity.startTime,
    opportunity.endTime,
    opportunity.durationHours,
  );

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Back Navigation & Actions Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              to={user?.role === UserRole.WORKER ? "/worker/find-work" : "/provider/work"}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>
                {user?.role === UserRole.WORKER ? "Back to Find Work" : "Back to All Work Posts"}
              </span>
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
                {opportunity.title}
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black ${
                  opportunity.status === WorkOpportunityStatus.PUBLISHED ||
                  opportunity.status === WorkOpportunityStatus.MATCHING
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : opportunity.status === WorkOpportunityStatus.DRAFT
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {opportunity.status}
              </span>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center space-x-3">
            {user?.role === UserRole.WORKER && (
              <>
                {hasApplied ? (
                  <Link
                    to="/worker/applications"
                    className="px-5 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold flex items-center space-x-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Application Submitted (Track Status)</span>
                  </Link>
                ) : opportunity.workersAssigned >= opportunity.workersNeeded ||
                  opportunity.status === WorkOpportunityStatus.FILLED ? (
                  <div className="px-5 py-2.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>Position Filled</span>
                  </div>
                ) : opportunity.status === WorkOpportunityStatus.COMPLETED ||
                  opportunity.status === WorkOpportunityStatus.SETTLEMENT_PENDING ? (
                  <div className="px-5 py-2.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-slate-400" />
                    <span>Shift Completed</span>
                  </div>
                ) : opportunity.status === WorkOpportunityStatus.CANCELLED ? (
                  <div className="px-5 py-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center space-x-2">
                    <XCircle className="w-4 h-4 text-rose-500" />
                    <span>Posting Cancelled</span>
                  </div>
                ) : opportunity.status === WorkOpportunityStatus.EXPIRED ? (
                  <div className="px-5 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>Posting Expired</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowApplyModal(true)}
                    className="px-7 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-md shadow-orange-600/25 flex items-center space-x-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>1-Tap Instant Apply</span>
                  </button>
                )}
              </>
            )}

            {user?.role === UserRole.PROVIDER && (
              <>
                {opportunity.status === WorkOpportunityStatus.DRAFT && (
                  <>
                    <button
                      onClick={() => navigate(`/provider/work/${opportunity.id}/edit`)}
                      className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center space-x-1.5"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Edit Draft</span>
                    </button>
                    <button
                      onClick={handlePublish}
                      className="px-6 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-md shadow-orange-600/20 flex items-center space-x-1.5"
                    >
                      <FileCheck2 className="w-4 h-4" />
                      <span>Publish Live</span>
                    </button>
                  </>
                )}

                {(opportunity.status === WorkOpportunityStatus.PUBLISHED ||
                  opportunity.status === WorkOpportunityStatus.MATCHING ||
                  opportunity.status === WorkOpportunityStatus.PARTIALLY_FILLED) && (
                  <>
                    <Link
                      to={`/provider/work/${opportunity.id}/applicants`}
                      className="px-6 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-md shadow-orange-600/20 flex items-center space-x-2"
                    >
                      <Users className="w-4 h-4" />
                      <span>Review Applicants ({opportunity.workersNeeded} Needed)</span>
                    </Link>

                    <Link
                      to={`/provider/work/${opportunity.id}/applicants`}
                      className="px-5 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-black transition-all shadow-xs flex items-center space-x-2"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>Smart Matches</span>
                    </Link>

                    <button
                      onClick={handleCancel}
                      className="px-4 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors flex items-center space-x-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>
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

        {/* Match Compatibility Card for Worker */}
        {matchExplanation && (
          <div className="p-6 sm:p-7 rounded-3xl bg-white border border-emerald-200 shadow-card space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 font-display">
                    Why This Work Matches You
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    NEARVIA Multi-Factor Hyperlocal Compatibility Breakdown
                  </p>
                </div>
              </div>

              <div className="px-4 py-1.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-black flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{matchExplanation.score}% Match Score</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              {matchExplanation.reasons.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start space-x-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 font-medium"
                >
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Details & Logistics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Scope, Responsibilities, Instructions, Skills */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
                  <Briefcase className="w-4 h-4 text-orange-600" />
                  <span>Scope of Work & Objectives</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed mt-2">
                  {opportunity.description}
                </p>
              </div>

              {opportunity.responsibilities && (
                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Key Responsibilities
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                    {opportunity.responsibilities}
                  </p>
                </div>
              )}

              {opportunity.instructions && (
                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Arrival & Worker Instructions
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                    {opportunity.instructions}
                  </p>
                </div>
              )}
            </div>

            {/* Skills Capabilities Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
              <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
                <Sparkles className="w-4 h-4 text-orange-600" />
                <span>Required Skill Capabilities</span>
              </h2>

              {opportunity.skills && opportunity.skills.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {opportunity.skills.map((s) => (
                    <div
                      key={s.skillId}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-extrabold text-xs text-slate-900">
                          {s.skillName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-semibold">
                          {s.minExperienceYears} yrs required experience
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-black">
                        REQUIRED
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 font-medium italic">
                  Open to general assistance workers. No specialized trade certification required.
                </p>
              )}
            </div>

            {/* Workplace Location & Navigation Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
                  <MapPin className="w-4 h-4 text-orange-600" />
                  <span>Workplace Location & Directions</span>
                </h2>
                {opportunity.location && (
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                    Hyperlocal Zone • Within 5 KM
                  </span>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {opportunity.addressApproximate || "Workplace Address in Bengaluru"}
                    </div>
                    {opportunity.location && (
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Approx. {formatDistance(calculateHaversineDistanceKm(workerLocation, opportunity.location))} from your location
                      </div>
                    )}
                  </div>

                  {opportunity.location && (
                    <button
                      type="button"
                      onClick={() => setShowDirectionsModal(true)}
                      className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition shadow-xs flex items-center space-x-1.5 shrink-0"
                    >
                      <span>Get Directions</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Key Logistics Card */}
          <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-card space-y-5 h-fit">
            <h3 className="font-black text-slate-900 text-base font-display">
              Logistics & Payout
            </h3>

            <div className="space-y-4 text-xs font-semibold text-slate-600">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 flex items-center space-x-1.5 font-medium">
                  <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Compensation</span>
                </span>
                <span className="font-black text-emerald-600 text-base font-display">
                  {formatCurrencyINR(opportunity.paymentAmount)}
                  <span className="text-xs text-slate-400 font-normal ml-1">
                    ({opportunity.paymentType})
                  </span>
                </span>
              </div>

              <div className="flex items-start justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 flex items-center space-x-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-orange-600" />
                  <span>Schedule</span>
                </span>
                <span className="font-bold text-slate-900 text-right">
                  {scheduleStr}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 flex items-center space-x-1.5 font-medium">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>Workers</span>
                </span>
                <span className="font-black text-slate-900">
                  {opportunity.workersAssigned} / {opportunity.workersNeeded} Assigned
                </span>
              </div>

              <div className="flex items-start justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 flex items-center space-x-1.5 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-orange-600" />
                  <span>Location</span>
                </span>
                <span className="font-bold text-slate-900 text-right max-w-[170px]">
                  {opportunity.addressApproximate || "Indiranagar, Bangalore"}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Tools Provided</span>
                <span className="font-bold text-slate-900">
                  {opportunity.toolsProvided ? "Yes (Provided on-site)" : "Worker brings own"}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 font-medium">Orientation</span>
                <span className="font-bold text-slate-900">
                  {opportunity.orientationProvided ? "10-min briefing" : "Direct start"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Apply Modal */}
        {showApplyModal && opportunity && (
          <ApplyModal
            opportunity={opportunity}
            isOpen={showApplyModal}
            onClose={() => setShowApplyModal(false)}
            onSuccess={() => {
              setHasApplied(true);
              setShowApplyModal(false);
            }}
          />
        )}

        {/* Directions Modal */}
        {showDirectionsModal && opportunity && opportunity.location && (
          <DirectionsModal
            isOpen={showDirectionsModal}
            onClose={() => setShowDirectionsModal(false)}
            origin={workerLocation}
            destination={opportunity.location}
            destinationTitle={opportunity.title}
            destinationAddress={opportunity.addressApproximate || "Workplace Address in Bengaluru"}
            originLabel="Your Detected Position"
          />
        )}
      </div>
    </div>
  );
};
