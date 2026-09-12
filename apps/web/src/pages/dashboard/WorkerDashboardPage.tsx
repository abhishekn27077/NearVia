import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Zap,
  ShieldCheck,
  ArrowRight,
  Compass,
  IndianRupee,
  CheckCircle2,
  Phone,
  Mail,
  Shield,
  Sliders,
  Sparkles,
  MapPin,
  Navigation,
  Award,
  Star,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";

interface RecommendedJob {
  id: string;
  title: string;
  categoryName: string;
  providerName: string;
  paymentAmount: number;
  paymentType: string;
  workType: string;
  urgency: string;
  addressApproximate: string;
  workDate: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  distanceKm: number;
  scheduleType: string;
  isInstant: boolean;
  matchScore: number;
  explanationReasons: string[];
  verifiedProvider: boolean;
}

interface ActiveAssignment {
  assignment_id: string;
  assignment_status: string;
  agreed_wage: number;
  opportunity_id: string;
  title: string;
  work_type: string;
  urgency: string;
  address_approximate: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  provider_name: string;
}

interface DashboardStats {
  todayEarnings: number;
  monthEarnings: number;
  totalEarnings: number;
  activeAssignment: ActiveAssignment | null;
  upcomingJob: ActiveAssignment | null;
  nearbyJobsCount: number;
  recommendedJobs: RecommendedJob[];
  reliability: {
    score: number | null;
    label: string;
    isNew: boolean;
    totalAssigned: number;
    completedCount: number;
    noShowCount: number;
    cancellationCount: number;
  };
  averageRating: number;
  totalRatingsCount: number;
  profileCompletionPercentage: number;
  isAvailableNow: boolean;
  availableUntil: string | null;
  serviceRadiusKm: number;
  verification: {
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean;
  };
}

export const WorkerDashboardPage: React.FC = () => {
  const { user, token, verifyMobile, verifyIdentity, refreshProfile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [preferredRadius, setPreferredRadius] = useState<number>(5.0);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>(["HOURLY", "TASK"]);
  const [availableHours, setAvailableHours] = useState<number>(8);
  const [isVerifying, setIsVerifying] = useState(false);

  const fetchDashboardStats = useCallback(() => {
    if (!token) return;
    setIsLoading(true);
    fetch(`${webConfig.apiBaseUrl}/workers/dashboard-stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) {
          setStats(json.data);
          setPreferredRadius(json.data.serviceRadiusKm || 5.0);
        }
      })
      .catch((err) => console.error("Failed to load worker stats:", err))
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  const handleToggleOnline = async (overrideOnline?: boolean) => {
    if (!token || !stats) return;
    setIsTogglingAvailability(true);
    const targetStatus = overrideOnline !== undefined ? overrideOnline : !stats.isAvailableNow;

    try {
      // Get current location if available in browser for one-shot check-in
      let lat = 12.9716;
      let lng = 77.5946;

      if (navigator.geolocation && targetStatus) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch {
          // Fallback to existing or default location
        }
      }

      const availableUntilDate = new Date(Date.now() + availableHours * 60 * 60 * 1000).toISOString();

      const res = await fetch(`${webConfig.apiBaseUrl}/availability/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isAvailableNow: targetStatus,
          serviceRadiusKm: preferredRadius,
          latitude: lat,
          longitude: lng,
          availableUntil: targetStatus ? availableUntilDate : undefined,
          preferredJobTypes: selectedJobTypes,
        }),
      });

      if (res.ok) {
        setShowConfigModal(false);
        fetchDashboardStats();
      }
    } catch (err) {
      console.error("Failed to toggle availability:", err);
    } finally {
      setIsTogglingAvailability(false);
    }
  };

  const handleQuickVerifyMobile = async () => {
    if (!user) return;
    setIsVerifying(true);
    try {
      await verifyMobile(user.phone || "+919876543211");
      await refreshProfile();
      fetchDashboardStats();
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleQuickVerifyIdentity = async () => {
    setIsVerifying(true);
    try {
      await verifyIdentity(`DEMO_KYC_${Date.now()}`);
      await refreshProfile();
      fetchDashboardStats();
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const isOnline = stats?.isAvailableNow || false;

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 bg-[#FAFAF9]">
      {/* 1. Real-Time Availability & Welcome Hero Banner */}
      <div className="p-6 sm:p-8 rounded-3xl card-premium flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Background ambient glow when online */}
        {isOnline && (
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        )}

        <div className="space-y-2 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                isOnline
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-xs"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? "bg-emerald-500 animate-ping" : "bg-slate-400"
                }`}
              />
              <span className="font-extrabold font-caption-refined">
                {isOnline ? "YOU ARE ONLINE & AVAILABLE" : "STATUS: OFFLINE"}
              </span>
            </span>

            <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-orange-50 text-orange-800 text-xs font-bold border border-orange-200">
              <MapPin className="w-3 h-3 text-orange-600" />
              <span>{stats?.serviceRadiusKm || 5.0} KM Service Radius</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display-title">
            Welcome back, {user?.fullName || "Partner"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
            {isOnline
              ? `Nearby providers can discover your trade for immediate tasks and scheduled shifts within ${stats?.serviceRadiusKm || 5.0} km.`
              : "Go online to receive instant nearby job notifications and enable hyperlocal discovery."}
          </p>

          <p className="text-[11px] text-slate-400 flex items-center space-x-1 pt-1 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Zero Continuous Background GPS: Location refreshed only on status change & application.</span>
          </p>
        </div>

        {/* Hero Actions: Go Online Toggle & Settings with Beacon Ring */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10">
          <button
            type="button"
            onClick={() => handleToggleOnline()}
            disabled={isTogglingAvailability || isLoading}
            className={`px-6 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center space-x-2 transition-transform duration-100 ease-out shadow-md active:scale-95 btn-tactile cursor-pointer ${
              isOnline
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 ring-4 ring-emerald-500/20"
                : "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20"
            }`}
          >
            <Zap
              className={`w-4 h-4 ${isOnline ? "text-amber-300 fill-amber-300 animate-pulse" : "text-slate-400"}`}
            />
            <span>
              {isTogglingAvailability
                ? "Updating Status..."
                : isOnline
                ? "Go Offline"
                : "Go Online Now ⚡"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="px-4 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors"
            title="Availability & Radius Preferences"
          >
            <Sliders className="w-4 h-4 text-slate-500" />
            <span>Preferences</span>
          </button>

          <Link
            to="/worker/find-work"
            className="px-4 py-3.5 rounded-2xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-800 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors"
          >
            <Compass className="w-4 h-4 text-orange-600" />
            <span>Explore Map</span>
          </Link>
        </div>
      </div>

      {/* 2. Four Real-Time KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Earnings with Daily Target Radial Ring */}
        <div className="p-5 rounded-3xl card-premium flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-caption-refined">
              Today's Earnings
            </div>
            <div className="text-2xl font-black text-slate-900 font-display-title flex items-center">
              <span className="text-lg text-slate-400 mr-0.5">₹</span>
              {stats?.todayEarnings.toLocaleString("en-IN") || "0"}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center space-x-1">
              <span>Goal: ₹1,200</span>
              <span className="text-slate-400">•</span>
              <span>{Math.min(100, Math.round(((stats?.todayEarnings || 0) / 1200) * 100))}% reached</span>
            </div>
          </div>
          {/* Apple-style SVG Radial Progress Ring */}
          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-emerald-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-600 transition-all duration-1000 ease-out"
                strokeDasharray={`${Math.min(100, Math.max(8, Math.round(((stats?.todayEarnings || 0) / 1200) * 100)))}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <IndianRupee className="w-4 h-4 text-emerald-700 absolute" />
          </div>
        </div>

        {/* Card 2: Open Nearby Jobs Count */}
        <Link
          to="/worker/find-work"
          className="p-5 rounded-3xl card-premium hover:border-orange-300 transition-all flex items-center justify-between group btn-tactile active:scale-95"
        >
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-caption-refined">
              Nearby Open Jobs
            </div>
            <div className="text-2xl font-black text-orange-600 font-display-title flex items-center space-x-1.5">
              <span>{stats?.nearbyJobsCount || 0}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                In 5 KM
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1 group-hover:text-orange-600 flex items-center space-x-1">
              <span>Explore on Map</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100 group-hover:scale-105 transition-transform shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)]">
            <Compass className="w-6 h-6" />
          </div>
        </Link>

        {/* Card 3: Worker Reliability Score */}
        <div className="p-5 rounded-3xl card-premium flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-caption-refined">
              Reliability Score
            </div>
            <div className="text-xl font-black text-slate-900 font-display-title">
              {stats?.reliability?.isNew ? (
                <span className="text-sm px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                  ✨ Building History
                </span>
              ) : (
                <span className="text-emerald-700 flex items-center space-x-1">
                  <span>{stats?.reliability?.label}</span>
                  <Award className="w-4 h-4 text-emerald-600" />
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {stats?.reliability?.completedCount || 0} Completed • {stats?.reliability?.noShowCount || 0} No-Shows
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)]">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Partner Rating & Badges */}
        <div className="p-5 rounded-3xl card-premium flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-caption-refined">
              Customer Rating
            </div>
            <div className="text-2xl font-black text-slate-900 font-display-title flex items-center space-x-1.5">
              <span>
                {stats?.totalRatingsCount && stats.totalRatingsCount > 0
                  ? `★ ${Number(stats.averageRating).toFixed(1)}`
                  : "★ New"}
              </span>
              <span className="text-xs font-medium text-slate-400">
                ({stats?.totalRatingsCount || 0})
              </span>
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Verified Partner</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)]">
            <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
          </div>
        </div>
      </div>

      {/* 3. Active / In-Progress Assignment Immediate Action Banner */}
      {stats?.activeAssignment && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-700/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-black backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
                <span>ACTIVE SHIFT IN PROGRESS</span>
              </div>
              <h2 className="text-xl font-black font-display">{stats.activeAssignment.title}</h2>
              <p className="text-xs text-emerald-100 font-medium">
                Provider: <span className="font-bold text-white">{stats.activeAssignment.provider_name}</span> •{" "}
                {stats.activeAssignment.address_approximate}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="text-right pr-3 border-r border-white/20">
                <div className="text-[11px] text-emerald-200 font-bold uppercase">Agreed Wage</div>
                <div className="text-lg font-black font-display text-white">
                  ₹{stats.activeAssignment.agreed_wage}
                </div>
              </div>
              <Link
                to={`/worker/assignments`}
                className="px-5 py-3 rounded-2xl bg-white hover:bg-emerald-50 text-emerald-800 font-black text-xs transition-all shadow-md flex items-center space-x-1.5"
              >
                <Navigation className="w-4 h-4 text-emerald-600" />
                <span>Open Shift Dashboard</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 4. Recommended Opportunities Feed with Deterministic Explanation Tags */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2 font-display">
              <Sparkles className="w-5 h-5 text-orange-600" />
              <span>Recommended For You Right Now</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Matched using transparent trade skill compatibility, travel distance, and availability window.
            </p>
          </div>
          <Link
            to="/worker/find-work"
            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center space-x-1"
          >
            <span>View all {stats?.nearbyJobsCount || 0} jobs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {stats?.recommendedJobs && stats.recommendedJobs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.recommendedJobs.map((job) => (
              <div
                key={job.id}
                className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-orange-300 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[11px] font-black">
                          {job.categoryName}
                        </span>
                        {job.isInstant && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-900 text-[10px] font-black flex items-center space-x-1">
                            <span>⚡ Instant</span>
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                          {job.matchScore}% Match
                        </span>
                      </div>
                      <h3 className="font-black text-slate-900 text-sm font-display">{job.title}</h3>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black text-slate-900 font-display">
                        ₹{job.paymentAmount}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{job.paymentType}</div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{job.addressApproximate}</span>
                    <span className="text-slate-300">•</span>
                    <span className="font-bold text-slate-700">{job.distanceKm} km away</span>
                  </p>

                  {/* Explanation Tag Badges */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {job.explanationReasons.map((reason, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 text-[10px] font-semibold"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                  <div className="text-[11px] text-slate-500 font-medium">
                    By <span className="font-semibold text-slate-800">{job.providerName}</span>
                  </div>
                  <Link
                    to={`/worker/find-work`}
                    className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors shadow-xs"
                  >
                    Quick Apply
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 space-y-3">
            <Compass className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-medium">
              No matching open jobs right now in your immediate 5 km radius.
            </p>
            <Link
              to="/worker/find-work"
              className="inline-flex items-center space-x-1 px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700"
            >
              <span>Expand Search Radius</span>
            </Link>
          </div>
        )}
      </div>

      {/* 5. Trust & Verification Status Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
              <Shield className="w-4 h-4 text-orange-600" />
              <span>Trust & Verification Profile</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified worker accounts receive priority matching and higher same-day payouts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-bold text-slate-500">Profile Completion</div>
              <div className="text-sm font-black text-orange-600">
                {stats?.profileCompletionPercentage || 60}%
              </div>
            </div>
            <div className="w-20 sm:w-24 h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-600 transition-all duration-500"
                style={{ width: `${stats?.profileCompletionPercentage || 60}%` }}
              />
            </div>
            <Link
              to="/worker/verification"
              className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-bold border border-orange-200 transition-colors"
            >
              Verification Center
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Email Verification */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Email Verification</div>
                <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                  {user?.email || "No email"}
                </div>
              </div>
            </div>
            {stats?.verification?.emailVerified ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Verified</span>
              </span>
            ) : (
              <span className="text-xs text-amber-600 font-semibold">Pending</span>
            )}
          </div>

          {/* Mobile Verification */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Mobile OTP</div>
                <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                  {user?.phone || "No phone"}
                </div>
              </div>
            </div>
            {stats?.verification?.phoneVerified ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Verified</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleQuickVerifyMobile}
                disabled={isVerifying}
                className="px-3 py-1 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-bold transition-all shadow-xs"
              >
                Verify Now
              </button>
            )}
          </div>

          {/* Identity Verification */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Identity KYC</div>
                <div className="text-[11px] text-slate-500">
                  {stats?.verification?.identityVerified ? "KYC Verified" : "Simulated ID"}
                </div>
              </div>
            </div>
            {stats?.verification?.identityVerified ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Verified</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleQuickVerifyIdentity}
                disabled={isVerifying}
                className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition-all shadow-xs"
              >
                Verify ID (Demo)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preferences & Availability Drawer / Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-orange-600" />
                <h3 className="font-black text-slate-900 text-base font-display">
                  Availability & Radar Preferences
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Radius Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Service Radius
                </label>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800">
                  {preferredRadius} KM
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                step="0.5"
                value={preferredRadius}
                onChange={(e) => setPreferredRadius(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                <span>1 KM (Hyperlocal)</span>
                <span>5 KM (Standard)</span>
                <span>15 KM (Max)</span>
              </div>
            </div>

            {/* Time Window Duration */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Stay Available For
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[2, 4, 8, 12].map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => setAvailableHours(hrs)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                      availableHours === hrs
                        ? "bg-orange-600 text-white border-orange-600"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {hrs} Hours
                  </button>
                ))}
              </div>
            </div>

            {/* Job Types Multi-select */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Preferred Opportunity Types
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "HOURLY", label: "Hourly Help" },
                  { id: "TASK", label: "Fixed-Price Task" },
                  { id: "SHIFT", label: "Scheduled Shift" },
                  { id: "DAILY", label: "Full Day Work" },
                ].map((t) => {
                  const isChecked = selectedJobTypes.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedJobTypes((prev) =>
                          isChecked ? prev.filter((item) => item !== t.id) : [...prev, t.id],
                        );
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-colors ${
                        isChecked
                          ? "bg-orange-50 border-orange-300 text-orange-900"
                          : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      <span>{t.label}</span>
                      {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-orange-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleToggleOnline(true)}
                disabled={isTogglingAvailability}
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-md shadow-orange-600/20"
              >
                Save & Go Online
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
