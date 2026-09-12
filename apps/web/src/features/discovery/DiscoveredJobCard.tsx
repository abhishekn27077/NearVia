import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  Clock,
  Sparkles,
  Zap,
  Check,
  ChevronDown,
  ChevronUp,
  Map,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { DiscoveredOpportunity, GeoCoordinates } from "@nearvia/types";
import { formatDistance } from "@nearvia/shared";
import { ApplyModal } from "../applications/ApplyModal";
import { DirectionsModal } from "./DirectionsModal";
import { useLanguage } from "../../context/LanguageContext";
import { RecommendationFeedback } from "../intelligence/RecommendationFeedback";
import { ReadAloudButton } from "../../components/common/ReadAloudButton";

interface DiscoveredJobCardProps {
  opportunity: DiscoveredOpportunity;
  isSelected?: boolean;
  userLocation?: GeoCoordinates;
  onFocusOnMap?: () => void;
}

export const DiscoveredJobCard: React.FC<DiscoveredJobCardProps> = ({
  opportunity,
  isSelected = false,
  userLocation = { latitude: 12.9716, longitude: 77.5946 },
  onFocusOnMap,
}) => {
  const { t } = useLanguage();
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showDirectionsModal, setShowDirectionsModal] = useState(false);
  const [applied, setApplied] = useState(false);

  const match = opportunity.match;
  const matchScore = match ? match.score : null;

  return (
    <article
      aria-label={opportunity.title}
      className={`p-5 sm:p-6 rounded-3xl card-premium transition-all space-y-4 ${
        isSelected
          ? "border-blue-600 ring-4 ring-blue-100 bg-blue-50/10 scale-[1.012] shadow-lg shadow-blue-500/10"
          : "border-slate-200/85 hover:border-slate-300"
      }`}
    >
      {/* 1. Top Tags: Work Type, Category, Urgency */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-slate-100 text-slate-800 uppercase tracking-wider font-caption-refined">
            {opportunity.workType}
          </span>
          <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
            {opportunity.categoryName || "General Work"}
          </span>
          {opportunity.urgency !== "NORMAL" && (
            <span className="px-2.5 py-0.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-700 text-xs font-black flex items-center space-x-1 shadow-[0_0_12px_-2px_rgba(225,29,72,0.22)]">
              <Zap className="w-3 h-3 text-rose-600 animate-pulse" />
              <span>{t.urgent}</span>
            </span>
          )}
          {opportunity.isStartingSoon && (
            <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black animate-pulse">
              {t.startingSoon}
            </span>
          )}
        </div>

        {/* Match Compatibility Badge */}
        {matchScore !== null && (
          <button
            type="button"
            onClick={() => setShowMatchDetails(!showMatchDetails)}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all btn-tactile active:scale-95"
            title="Match explanation"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>{matchScore}% {t.match}</span>
            {showMatchDetails ? (
              <ChevronUp className="w-3 h-3 text-emerald-600" />
            ) : (
              <ChevronDown className="w-3 h-3 text-emerald-600" />
            )}
          </button>
        )}
      </div>

      {/* 2. Main Title & WHAT & PAY */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 font-display-title tracking-tight leading-snug">
              {opportunity.title}
            </h3>
            <ReadAloudButton
              job={{
                title: opportunity.title,
                description: opportunity.description,
                paymentAmount: opportunity.paymentAmount,
                durationHours: opportunity.durationHours,
                distanceKm: opportunity.distanceKm,
              }}
              variant="icon"
              size="sm"
            />
          </div>
          <p className="text-xs text-slate-500 font-medium line-clamp-2">
            {opportunity.description}
          </p>
        </div>

        {/* Big Bold Pay Amount */}
        <div className="flex-shrink-0 sm:text-right bg-emerald-50/60 sm:bg-transparent p-2.5 sm:p-0 rounded-2xl border sm:border-0 border-emerald-100">
          <div className="text-2xl font-black text-emerald-700 font-mono tracking-tight">
            ₹{opportunity.paymentAmount}
          </div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {opportunity.paymentType === "FIXED" ? t.fixedPayout : t.perHour}
          </div>
        </div>
      </div>

      {/* 3. 4-Question Quick Answer Grid: Duration, Schedule, Distance, Trust */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
        {/* Duration */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center space-x-1.5 text-slate-400 font-bold text-[10px] uppercase">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{t.duration}</span>
          </div>
          <div className="font-extrabold text-slate-900 mt-0.5">
            {opportunity.durationHours} {t.hours}
          </div>
        </div>

        {/* Schedule / Time */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center space-x-1.5 text-slate-400 font-bold text-[10px] uppercase">
            <Calendar className="w-3 h-3 text-slate-500" />
            <span>{t.schedule}</span>
          </div>
          <div className="font-extrabold text-slate-900 mt-0.5 truncate">
            {opportunity.workDate}
          </div>
        </div>

        {/* Distance */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center space-x-1.5 text-slate-400 font-bold text-[10px] uppercase">
            <MapPin className="w-3 h-3 text-blue-600" />
            <span>{t.distance}</span>
          </div>
          <div className="font-extrabold text-blue-600 mt-0.5">
            {formatDistance(opportunity.distanceKm)} {t.distanceAway}
          </div>
        </div>

        {/* Trust / Employer */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center space-x-1.5 text-slate-400 font-bold text-[10px] uppercase">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>{t.employer}</span>
          </div>
          <div className="font-extrabold text-slate-900 mt-0.5 truncate flex items-center space-x-1.5">
            <span className="truncate">{opportunity.businessName || opportunity.providerName || t.employer}</span>
            {opportunity.providerIdentityVerified ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-800 shrink-0" title="Identity Verified">
                ID ✓
              </span>
            ) : opportunity.providerPhoneVerified ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 shrink-0" title="Phone Verified">
                Phone ✓
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-700 shrink-0" title="Email Verified">
                Email ✓
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Match Breakdown Dropdown */}
      {showMatchDetails && match && (
        <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs space-y-3">
          <div className="font-black text-blue-900 flex items-center justify-between">
            <span>Why this is a match for you</span>
            <span className="font-mono">{match.score}% Score</span>
          </div>
          <div className="space-y-1 text-slate-600 font-medium">
            {match.reasons?.map((reason: string, idx: number) => (
              <div key={idx} className="flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-slate-400 font-semibold border-t border-blue-100/60 pt-2">
            Recommended match based on location and trade skills • Not a guaranteed placement
          </div>
          <RecommendationFeedback
            recommendationId={opportunity.id}
            type="WORKER"
            className="mt-2"
          />
        </div>
      )}

      {/* 5. Bottom Action Controls */}
      <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
        <div className="flex items-center space-x-2">
          {onFocusOnMap && (
            <button
              type="button"
              onClick={onFocusOnMap}
              className="inline-flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <Map className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">{t.locateOnMap}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowDirectionsModal(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            {t.directions}
          </button>

          <Link
            to={`/provider/work/${opportunity.id}`}
            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            {t.viewDetails}
          </Link>
        </div>

        {/* 1-Click Quick Apply Button */}
        {applied ? (
          <span className="px-4 py-2.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-black flex items-center space-x-1.5">
            <Check className="w-4 h-4" />
            <span>{t.applied}</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setShowApplyModal(true)}
            className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition-all shadow-md shadow-orange-600/25 btn-tactile active:scale-95"
          >
            {t.applyNow}
          </button>
        )}
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <ApplyModal
          opportunity={opportunity as any}
          isOpen={showApplyModal}
          userLocation={userLocation}
          onClose={() => setShowApplyModal(false)}
          onSuccess={() => {
            setApplied(true);
            setShowApplyModal(false);
          }}
        />
      )}

      {/* Directions Modal */}
      {showDirectionsModal && opportunity.location && (
        <DirectionsModal
          isOpen={showDirectionsModal}
          onClose={() => setShowDirectionsModal(false)}
          origin={userLocation}
          destination={opportunity.location}
          destinationTitle={opportunity.title}
          destinationAddress={opportunity.addressApproximate || "Workplace Address in Bengaluru"}
          originLabel="Your Location"
        />
      )}
    </article>
  );
};
