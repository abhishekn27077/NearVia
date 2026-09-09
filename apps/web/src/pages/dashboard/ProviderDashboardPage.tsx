import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Building,
  PlusCircle,
  Briefcase,
  ArrowRight,
  MapPin,
  CreditCard,
  Users,
  Shield,
  CheckCircle2,
  Mail,
  Phone,
  ShieldCheck,
  Zap,
  Star,
  Clock,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";
import { apiFetch } from "../../utils/apiClient";

interface CategoryStat {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  availableWorkersCount: number;
}

interface LocalityCluster {
  id: string;
  approximateAreaName: string;
  centerCoordinates: { latitude: number; longitude: number };
  availableWorkersCount: number;
  categories: { categoryId: string; categoryName: string }[];
}

export interface AvailableTalent {
  id: string;
  primarySkill: string;
  rating: number;
  totalRatings: number;
  completedTasks: number;
  verifiedBadge: boolean;
  phoneVerified: boolean;
  distanceKm: number;
  areaName: string;
  isAvailableNow: boolean;
}

interface WorkforceRadarData {
  totalAvailableWorkers: number;
  searchCenter: { latitude: number; longitude: number };
  radiusKm: number;
  categoryCounts: CategoryStat[];
  clusters: LocalityCluster[];
  availableTalent?: AvailableTalent[];
}

interface PreferredWorker {
  id: string;
  workerId: string;
  workerName: string;
  workerPhoneMasked: string;
  workerRating: number;
  totalRatingsCount: number;
  completedTasksCount: number;
  skills: string[];
  notes?: string;
  createdAt: string;
}

interface ProviderReputation {
  providerId: string;
  businessName: string;
  providerType: string;
  averageRating: number;
  totalRatingsCount: number;
  postedJobsCount: number;
  completedJobsCount: number;
  completionRatePercentage: number;
  verification: {
    emailVerified: boolean;
    phoneVerified: boolean;
    businessVerified: boolean;
    identityVerified: boolean;
  };
}

export const ProviderDashboardPage: React.FC = () => {
  const { user, verifyMobile, verifyIdentity, refreshProfile } = useAuth();
  const [radar, setRadar] = useState<WorkforceRadarData | null>(null);
  const [preferredWorkers, setPreferredWorkers] = useState<PreferredWorker[]>([]);
  const [reputation, setReputation] = useState<ProviderReputation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState<number>(5.0);

  // Instant Job Modal State
  const [showInstantJobModal, setShowInstantJobModal] = useState(false);
  const [instantTitle, setInstantTitle] = useState("");
  const [instantCategory, setInstantCategory] = useState("");
  const [instantWage, setInstantWage] = useState<number>(600);
  const [instantDuration, setInstantDuration] = useState<number>(2);
  const [instantAddress, setInstantAddress] = useState("");
  const [isSubmittingInstant, setIsSubmittingInstant] = useState(false);
  const [instantCreatedSuccess, setInstantCreatedSuccess] = useState<string | null>(null);
  const [instantError, setInstantError] = useState<string | null>(null);

  // Categories list for instant job dropdown
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const fetchDashboardData = useCallback(() => {
    setIsLoading(true);

    // 1. Fetch Radar
    apiFetch(`/providers/workforce-radar?radius=${selectedRadius}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) setRadar(json.data);
      })
      .catch((err) => console.error("Failed to load workforce radar:", err));

    // 2. Fetch Preferred Workers
    apiFetch(`/providers/preferred-workers`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) setPreferredWorkers(json.data);
      })
      .catch((err) => console.error("Failed to load preferred workers:", err));

    // 3. Fetch Reputation
    if (user?.id) {
      apiFetch(`/providers/${user.id}/reputation`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.data) setReputation(json.data);
        })
        .catch((err) => console.error("Failed to load provider reputation:", err));
    }

    // 4. Fetch Categories
    fetch(`${webConfig.apiBaseUrl}/categories`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data && Array.isArray(json.data)) {
          setCategories(json.data.map((c: any) => ({ id: c.id, name: c.name })));
          if (json.data.length > 0 && !instantCategory) {
            setInstantCategory(json.data[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user?.id, selectedRadius, instantCategory]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleCreateInstantJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instantTitle || !instantCategory) return;
    setIsSubmittingInstant(true);
    setInstantCreatedSuccess(null);
    setInstantError(null);

    try {
      const res = await apiFetch("/work-opportunities/instant", {
        method: "POST",
        body: JSON.stringify({
          categoryId: instantCategory,
          title: instantTitle,
          description: `Urgent instant requirement starting within 45 mins.`,
          paymentAmount: instantWage,
          paymentType: "FIXED",
          durationHours: instantDuration,
          addressApproximate: instantAddress || "Central Area (5 km radius)",
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setInstantCreatedSuccess(
          `Instant job posted! Notified ${json.meta?.notifiedWorkersCount || 0} nearby online workers.`,
        );
        setTimeout(() => {
          setShowInstantJobModal(false);
          setInstantTitle("");
          setInstantCreatedSuccess(null);
          fetchDashboardData();
        }, 2000);
      } else {
        setInstantError(json.error?.message || "Failed to post instant job. Please check authentication.");
      }
    } catch (err: any) {
      console.error("Failed to create instant job:", err);
      setInstantError(err.message || "Network error. Please try again.");
    } finally {
      setIsSubmittingInstant(false);
    }
  };

  const handleQuickVerifyMobile = async () => {
    if (!user) return;
    setIsVerifying(true);
    try {
      await verifyMobile(user.phone || "+919876543210");
      await refreshProfile();
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleQuickVerifyIdentity = async () => {
    setIsVerifying(true);
    try {
      await verifyIdentity(`DEMO_PROVIDER_KYC_${Date.now()}`);
      await refreshProfile();
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemovePreferred = async (workerId: string) => {
    try {
      const res = await apiFetch(`/providers/preferred-workers/${workerId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPreferredWorkers((prev) => prev.filter((p) => p.workerId !== workerId));
      }
    } catch (err) {
      console.error("Failed to remove preferred worker:", err);
    }
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 bg-[#FAFAF9]">
      {/* 1. Hero Welcome & Instant Action Banner */}
      <div className="p-6 sm:p-8 rounded-3xl card-premium flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-800 text-xs font-bold border border-orange-200">
              <Building className="w-3.5 h-3.5" />
              <span>Provider Enterprise Portal</span>
            </span>

            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>{radar?.totalAvailableWorkers || 0} Workers Online in {selectedRadius} KM</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display-title">
            Welcome, {reputation?.businessName || user?.fullName || "Employer"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
            Hyperlocal workforce radar connects you directly to available talent for immediate tasks, replacement staffing, and scheduled shifts.
          </p>
        </div>

        {/* Hero Actions: Instant Job & Normal Post */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10">
          <button
            type="button"
            onClick={() => setShowInstantJobModal(true)}
            className="px-5 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-black transition-all shadow-md shadow-amber-500/20 flex items-center justify-center space-x-1.5 btn-tactile active:scale-95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3)]"
          >
            <Zap className="w-4 h-4 text-slate-900 fill-slate-900" />
            <span>Need Someone Now ⚡</span>
          </button>

          <Link
            to="/provider/work/new"
            className="px-5 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-md shadow-orange-600/20 flex items-center justify-center space-x-1.5 btn-tactile active:scale-95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Post Opportunity</span>
          </Link>
        </div>
      </div>

      {/* 2. Workforce Radar Live Widget (Privacy-Safe Talent Aggregation) */}
      <div className="p-6 sm:p-8 rounded-3xl card-premium space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3.5">
            <div className="relative w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-200 overflow-hidden flex items-center justify-center shrink-0">
              <div className="absolute inset-0 radar-sweep-anim pointer-events-none rounded-2xl" />
              <div className="w-2 h-2 rounded-full bg-orange-600 z-10 animate-ping" />
              <div className="w-1.5 h-1.5 rounded-full bg-orange-600 z-10" />
            </div>
            <div className="space-y-0.5">
              <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2 font-display-title">
                <span>Live Workforce Radar</span>
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {radar?.totalAvailableWorkers || 0} Available Now
                </span>
                {isLoading && (
                  <span className="text-[11px] text-slate-400 font-semibold animate-pulse">
                    Updating...
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Aggregated live availability within {selectedRadius} km. Zero exact personal GPS tracking is exposed.
              </p>
            </div>
          </div>

          {/* Radius Selector Pills */}
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-2xl">
            {[3, 5, 10, 15].map((rad) => (
              <button
                key={rad}
                type="button"
                onClick={() => setSelectedRadius(rad)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all btn-tactile active:scale-95 ${
                  selectedRadius === rad
                    ? "bg-white text-orange-700 shadow-xs shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)]"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {rad} KM
              </button>
            ))}
          </div>
        </div>

        {/* Radar Category Breakdown Cards */}
        {radar && radar.categoryCounts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {radar.categoryCounts.map((cat) => (
              <div
                key={cat.categoryId}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-orange-300 transition-all space-y-1"
              >
                <div className="text-xs font-bold text-slate-500 truncate">{cat.categoryName}</div>
                <div className="text-xl font-black text-slate-900 font-display flex items-center space-x-1.5">
                  <span>{cat.availableWorkersCount}</span>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Online
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-xs font-medium">
            No online workers currently available within {selectedRadius} km. Try expanding the radius.
          </div>
        )}

        {/* Approximate Locality Clusters */}
        {radar && radar.clusters.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              High Availability Localities
            </div>
            <div className="flex flex-wrap gap-2">
              {radar.clusters.map((cl) => (
                <div
                  key={cl.id}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center space-x-1.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-orange-600" />
                  <span>{cl.approximateAreaName}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px]">
                    {cl.availableWorkersCount} workers
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Real-World Anonymized Talent Cards (Privacy-Preserving) */}
        {radar && radar.availableTalent && radar.availableTalent.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-orange-600" />
                <span>Available Nearby Talent ({radar.availableTalent.length})</span>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">
                Privacy-Protected • Exact GPS Hidden
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {radar.availableTalent.map((talent) => (
                <div
                  key={talent.id}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2 hover:border-orange-300 transition-all card-premium"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-black text-slate-900 line-clamp-1 font-display-title">
                        {talent.primarySkill}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-orange-500 shrink-0" />
                        <span className="truncate">{talent.areaName}</span>
                        <span className="font-bold text-slate-700 shrink-0">· {talent.distanceKm} km</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-extrabold shrink-0 border border-emerald-100">
                      ★ {Number(talent.rating).toFixed(1)}
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-1.5 pt-2 border-t border-slate-100 text-[10px]">
                    {talent.verifiedBadge && (
                      <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-100">
                        <ShieldCheck className="w-2.5 h-2.5 text-blue-600" />
                        <span>ID Verified</span>
                      </span>
                    )}
                    {talent.phoneVerified && (
                      <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                        <span>✓ Phone</span>
                      </span>
                    )}
                    <span className="inline-flex items-center space-x-1 ml-auto text-emerald-600 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Online</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Provider Reputation & 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Posted Jobs */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-card flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Total Opportunities
            </div>
            <div className="text-2xl font-black text-slate-900 font-display">
              {reputation?.postedJobsCount || 0}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {reputation?.completedJobsCount || 0} Successfully Completed
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
            <Briefcase className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Completion Rate */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-card flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Completion Rate
            </div>
            <div className="text-2xl font-black text-emerald-600 font-display">
              {reputation?.completionRatePercentage || 100}%
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              High Reliability Partner
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Employer Rating */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-card flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Employer Rating
            </div>
            <div className="text-2xl font-black text-slate-900 font-display flex items-center space-x-1.5">
              <span>★ {Number(reputation?.averageRating || 5.0).toFixed(1)}</span>
              <span className="text-xs font-medium text-slate-400">
                ({reputation?.totalRatingsCount || 0})
              </span>
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Employer</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Star className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Preferred Workers */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-card flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Preferred Workers
            </div>
            <div className="text-2xl font-black text-purple-600 font-display">
              {preferredWorkers.length}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              Saved for Fast Direct Re-hire
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Trust & Business Verification Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
              <Shield className="w-4 h-4 text-orange-600" />
              <span>Business Verification & Trust Profile</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified business accounts attract 3x more qualified worker applicants.
            </p>
          </div>
          <Link
            to="/provider/verification"
            className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-bold border border-orange-200 transition-colors self-start sm:self-auto"
          >
            Verification Center
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Email Verification */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Email Address</div>
                <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                  {user?.email || "No email"}
                </div>
              </div>
            </div>
            {reputation?.verification?.emailVerified ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Verified</span>
              </span>
            ) : (
              <span className="text-xs text-amber-600 font-semibold">Pending</span>
            )}
          </div>

          {/* Mobile Phone Verification */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Contact Mobile</div>
                <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                  {user?.phone || "No phone"}
                </div>
              </div>
            </div>
            {reputation?.verification?.phoneVerified ? (
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

          {/* Business Entity KYC */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Business KYC</div>
                <div className="text-[11px] text-slate-500">
                  {reputation?.verification?.businessVerified ? "KYC Verified" : "Simulated Business"}
                </div>
              </div>
            </div>
            {reputation?.verification?.businessVerified ? (
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
                Verify (Demo)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Preferred Workers List Section */}
      {preferredWorkers.length > 0 && (
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>Your Preferred Workers (⭐ Favorites)</span>
              </h2>
              <p className="text-xs text-slate-500">
                Workers you've favorited for punctuality, quality work, and instant re-hiring.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {preferredWorkers.map((pw) => (
              <div
                key={pw.id}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900">{pw.workerName}</h4>
                    <span className="text-xs font-bold text-amber-600 flex items-center">
                      ★ {pw.workerRating.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {pw.workerPhoneMasked} • {pw.completedTasksCount} completed shifts
                  </div>
                  {pw.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {pw.skills.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 text-[10px] font-semibold"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {pw.notes && (
                    <div className="text-[11px] text-slate-400 italic mt-1.5">"{pw.notes}"</div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleRemovePreferred(pw.workerId)}
                    className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 transition-colors"
                  >
                    Remove
                  </button>
                  <Link
                    to={`/provider/work/new`}
                    className="px-3 py-1 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors"
                  >
                    Direct Offer
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Navigation & Management Quick Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Post Work */}
        <Link
          to="/provider/work/new"
          className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card hover:border-orange-300 transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 mb-4 group-hover:scale-105 transition-transform">
              <PlusCircle className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-900 text-base mb-1 font-display">Post Opportunity</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Create task, shift, or instant jobs in 5 simple steps.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center space-x-1 text-xs font-bold text-orange-600">
            <span>Create New</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        {/* My Postings */}
        <Link
          to="/provider/work"
          className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card hover:border-blue-300 transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 group-hover:scale-105 transition-transform">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-900 text-base mb-1 font-display">My Postings</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Review applicants, shortlist candidates, and manage listings.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center space-x-1 text-xs font-bold text-blue-600">
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        {/* Active Assignments */}
        <Link
          to="/provider/assignments"
          className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card hover:border-emerald-300 transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-105 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-900 text-base mb-1 font-display">Active Workers</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Check in verification, grace timer, no-show reporting, and replacement.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center space-x-1 text-xs font-bold text-emerald-600">
            <span>Supervise</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        {/* Payments */}
        <Link
          to="/provider/payments"
          className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card hover:border-purple-300 transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 mb-4 group-hover:scale-105 transition-transform">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-900 text-base mb-1 font-display">Settlement Ledger</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Direct UPI transfers, transaction receipts, and payment history.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center space-x-1 text-xs font-bold text-purple-600">
            <span>Settlements</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </div>

      {/* 6. Instant Job ("Need Someone Now") Quick Modal */}
      {showInstantJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                <h3 className="font-black text-slate-900 text-base font-display">
                  Post Instant Job (Need Someone Now ⚡)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInstantJobModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {instantError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center space-x-2">
                <span>⚠️ {instantError}</span>
              </div>
            )}

            {instantCreatedSuccess ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <div className="font-black text-base">Success!</div>
                <div className="text-xs">{instantCreatedSuccess}</div>
              </div>
            ) : (
              <form onSubmit={handleCreateInstantJob} className="space-y-4">
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Starts in 45 minutes. {radar?.totalAvailableWorkers || 0} online workers in your 5 km radius will receive immediate notifications.
                  </span>
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">What needs to be done?</label>
                  <input
                    type="text"
                    required
                    value={instantTitle}
                    onChange={(e) => setInstantTitle(e.target.value)}
                    placeholder="e.g. Urgent Warehouse Cartons Moving"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                {/* Category Dropdown */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Category / Trade</label>
                  <select
                    value={instantCategory}
                    onChange={(e) => setInstantCategory(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Wage & Duration */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Fixed Wage (₹)</label>
                    <input
                      type="number"
                      required
                      min="100"
                      value={instantWage}
                      onChange={(e) => setInstantWage(parseInt(e.target.value, 10))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Duration (Hours)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="12"
                      value={instantDuration}
                      onChange={(e) => setInstantDuration(parseInt(e.target.value, 10))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Locality */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Approximate Location</label>
                  <input
                    type="text"
                    required
                    value={instantAddress}
                    onChange={(e) => setInstantAddress(e.target.value)}
                    placeholder="e.g. Indiranagar 100ft Road"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowInstantJobModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingInstant}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-black transition-all shadow-md shadow-amber-500/20"
                  >
                    {isSubmittingInstant ? "Broadcasting..." : "Broadcast Instant Job ⚡"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
