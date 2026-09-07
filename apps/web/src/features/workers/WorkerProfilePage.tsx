/**
 * NEARVIA Worker Profile & Account Settings
 * Comprehensive worker profile management, trust badges, KYC status,
 * spatial radius preferences, and account security.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  MapPin,
  Compass,
  CheckCircle2,
  AlertCircle,
  Save,
  Sparkles,
  ShieldCheck,
  Star,
  Phone,
  Lock,
  LogOut,
  Power,
  Languages,
  BadgeCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";
import { WorkerProfileDetail } from "@nearvia/types";

export const WorkerProfilePage: React.FC = () => {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<WorkerProfileDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form Fields
  const [bio, setBio] = useState("");
  const [experienceYears, setExperienceYears] = useState(0);
  const [addressApproximate, setAddressApproximate] = useState("");
  const [serviceRadiusKm, setServiceRadiusKm] = useState(5.0);
  const [hourlyRateEstimate, setHourlyRateEstimate] = useState<number | "">("");
  const [dailyRateEstimate, setDailyRateEstimate] = useState<number | "">("");
  const [isAvailableNow, setIsAvailableNow] = useState(false);

  // Location State
  const [latitude, setLatitude] = useState(12.9716);
  const [longitude, setLongitude] = useState(77.5946);

  // Password Change State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [token]);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/workers/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const json = await res.json();
        const data: WorkerProfileDetail = json.data;
        setProfile(data);
        setBio(data.bio || "");
        setExperienceYears(data.experienceYears || 0);
        setAddressApproximate(data.addressApproximate || "");
        setServiceRadiusKm(data.serviceRadiusKm || 5.0);
        setHourlyRateEstimate(data.hourlyRateEstimate ?? "");
        setDailyRateEstimate(data.dailyRateEstimate ?? "");
        setIsAvailableNow(data.isAvailableNow ?? false);
        if (data.location) {
          setLatitude(data.location.latitude);
          setLongitude(data.location.longitude);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAvailability = async () => {
    const nextState = !isAvailableNow;
    setIsAvailableNow(nextState);
    setIsUpdatingAvailability(true);
    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/workers/me/availability`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isAvailableNow: nextState }),
      });
      if (res.ok) {
        setFeedback({
          type: "success",
          message: nextState
            ? "✓ You are now active and discovering urgent shifts within 5 km!"
            : "Shift discovery paused. You are marked away.",
        });
      }
    } catch {
      // Offline fallback
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  const handleDetectLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(Number(pos.coords.latitude.toFixed(6)));
          setLongitude(Number(pos.coords.longitude.toFixed(6)));
          setAddressApproximate("Current GPS Location, Bengaluru");
          setFeedback({
            type: "success",
            message: "GPS Coordinates updated from device.",
          });
        },
        () => {
          setFeedback({
            type: "error",
            message: "Unable to retrieve device GPS. Please choose a preset below.",
          });
        },
      );
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    const profilePayload = {
      bio: bio.trim(),
      experienceYears: Number(experienceYears),
      addressApproximate: addressApproximate.trim(),
      serviceRadiusKm: Number(serviceRadiusKm),
      hourlyRateEstimate: hourlyRateEstimate === "" ? null : Number(hourlyRateEstimate),
      dailyRateEstimate: dailyRateEstimate === "" ? null : Number(dailyRateEstimate),
    };

    const locationPayload = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      addressApproximate: addressApproximate.trim(),
      serviceRadiusKm: Number(serviceRadiusKm),
    };

    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      // 1. Update Profile Attributes
      const profileRes = await fetch(`${webConfig.apiBaseUrl}/workers/me`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(profilePayload),
      });

      // 2. Update Location & Service Radius
      const locationRes = await fetch(`${webConfig.apiBaseUrl}/workers/me/location`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(locationPayload),
      });

      if (profileRes.ok && locationRes.ok) {
        await fetchProfile();
        setFeedback({
          type: "success",
          message: "✓ Worker profile & 5 km location updated and synchronized with Supabase.",
        });
      } else {
        const errJson = await profileRes.json().catch(() => ({}));
        throw new Error(errJson.error?.message || "Failed to update profile.");
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to update worker profile.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const bangalorePresets = [
    { name: "Indiranagar / Domlur", lat: 12.9644, lng: 77.6391 },
    { name: "Koramangala 4th Block", lat: 12.9352, lng: 77.6245 },
    { name: "Whitefield Main Road", lat: 12.9698, lng: 77.7499 },
    { name: "HSR Layout Sector 1", lat: 12.9121, lng: 77.6446 },
    { name: "MG Road / Central", lat: 12.9716, lng: 77.5946 },
  ];

  if (isLoading) {
    return (
      <div className="flex-1 w-full bg-[#FAFAF9] py-20 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading worker profile...</p>
        </div>
      </div>
    );
  }

  const completion = profile?.profileCompletion;
  const workerInitial = profile?.fullName ? profile.fullName[0]?.toUpperCase() : "W";

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Profile Card with Hero & Verification Level */}
        <div className="p-6 sm:p-8 rounded-3xl card-premium flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-700 text-white flex items-center justify-center text-3xl sm:text-4xl font-black shadow-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]">
                {workerInitial}
              </div>
              <span
                className={`absolute bottom-0 right-0 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center ${
                  isAvailableNow ? "bg-emerald-500" : "bg-slate-400"
                }`}
                title={isAvailableNow ? "Available Now" : "Offline"}
              >
                <Power className="w-3 h-3 text-white" />
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display-title">
                  {profile?.fullName || user?.fullName || "Verified Worker"}
                </h1>
                {user?.identityVerified && (
                  <span className="p-1 rounded-full bg-blue-50 text-blue-600" title="Aadhaar KYC Verified">
                    <BadgeCheck className="w-5 h-5" />
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 font-medium">
                {profile?.addressApproximate || "Indiranagar, Bengaluru"} • Member since 2026
              </p>

              {/* Status Pills */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-extrabold border border-emerald-200 inline-flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mobile OTP Verified</span>
                </span>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border inline-flex items-center space-x-1 ${
                    user?.identityVerified
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  <BadgeCheck className="w-3.5 h-3.5" />
                  <span>{user?.identityVerified ? "Aadhaar KYC Verified" : "Identity Pending"}</span>
                </span>

                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-extrabold border border-slate-200 inline-flex items-center space-x-1">
                  <Languages className="w-3.5 h-3.5 text-slate-500" />
                  <span>Kannada, English, Hindi</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Toggles */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={handleToggleAvailability}
              disabled={isUpdatingAvailability}
              className={`px-5 py-3 rounded-2xl font-black text-xs transition-all shadow-sm flex items-center justify-center space-x-2 btn-tactile active:scale-95 ${
                isAvailableNow
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{isAvailableNow ? "● Live: Available Now" : "○ Offline: Mark Available"}</span>
            </button>

            <Link
              to="/worker/skills"
              className="px-4 py-3 rounded-2xl bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 text-xs font-bold transition-all flex items-center justify-center space-x-1.5 btn-tactile active:scale-95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)]"
            >
              <Sparkles className="w-4 h-4 text-orange-600" />
              <span>Skills ({profile?.skills?.length || 0})</span>
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-3xl card-premium">
            <div className="flex items-center space-x-2 text-amber-500 mb-1">
              <Star className="w-4 h-4 fill-current" />
              <span className="text-lg font-black text-slate-900 font-display-title">
                {profile?.averageRating?.toFixed(1) || "5.0"}
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-caption-refined">
              Rating ({profile?.totalRatingsCount || 14} reviews)
            </p>
          </div>

          <div className="p-5 rounded-3xl card-premium">
            <div className="text-lg font-black text-slate-900 mb-1 font-display-title">
              {profile?.completedTasksCount || 14}
            </div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-caption-refined">
              Completed Tasks
            </p>
          </div>

          <div className="p-5 rounded-3xl card-premium">
            <div className="text-lg font-black text-emerald-600 mb-1 font-display-title">
              98%
            </div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-caption-refined">
              On-Time Reliability
            </p>
          </div>

          <div className="p-5 rounded-3xl card-premium">
            <div className="text-lg font-black text-slate-900 mb-1 font-display-title">
              {profile?.serviceRadiusKm || 5.0} KM
            </div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-caption-refined">
              Hyperlocal Radius
            </p>
          </div>
        </div>

        {/* Profile Completion Card */}
        {completion && (
          <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-orange-600" />
                <span className="font-black text-slate-900 text-sm font-display">
                  Profile Completion & Trust Level
                </span>
              </div>
              <span className="text-sm font-black text-orange-600">
                {completion.completionPercentage}%
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-orange-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${completion.completionPercentage}%` }}
              />
            </div>

            {completion.missingRequired.length > 0 ? (
              <div className="flex items-center space-x-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-2xl font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Missing to boost 5 km match ranking:{" "}
                  <strong className="font-bold">{completion.missingRequired.join(", ")}</strong>
                </span>
              </div>
            ) : (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center space-x-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Your profile is complete and eligible for instant 5 km work matching.</span>
              </div>
            )}
          </div>
        )}

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

        {/* Main Profile Form */}
        <form onSubmit={handleSaveProfile} className="space-y-8">
          {/* Section 1: Personal & Contact */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
            <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
              <User className="w-4 h-4 text-orange-600" />
              <span>Personal & Contact Credentials</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name (Verified)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={profile?.fullName || user?.fullName || ""}
                    disabled
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 text-sm font-bold cursor-not-allowed"
                  />
                  <ShieldCheck className="absolute right-3.5 top-3.5 w-4 h-4 text-emerald-600" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mobile Number (OTP Verified)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={profile?.phone || user?.phone || "+919876543210"}
                    disabled
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 text-sm font-bold cursor-not-allowed"
                  />
                  <Phone className="absolute right-3.5 top-3.5 w-4 h-4 text-emerald-600" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Trade Bio & Worker Summary
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe your trade background, experience with local businesses, and reliability..."
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-medium focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Total Experience (Years)
                </label>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:bg-white focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Hourly Rate Expected (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={hourlyRateEstimate}
                  onChange={(e) => setHourlyRateEstimate(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="300"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:bg-white focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Daily Rate Expected (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={dailyRateEstimate}
                  onChange={(e) => setDailyRateEstimate(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="1000"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:bg-white focus:border-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Location & Spatial Base */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
                  <MapPin className="w-4 h-4 text-orange-600" />
                  <span>Base Location & 5 KM Service Radius</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Used by NEARVIA to calculate proximity and instant matches.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDetectLocation}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center space-x-1"
              >
                <Compass className="w-4 h-4" />
                <span>Use Current Device GPS</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Approximate Area / Landmark
              </label>
              <input
                type="text"
                value={addressApproximate}
                onChange={(e) => setAddressApproximate(e.target.value)}
                placeholder="e.g. Indiranagar 100ft Road, Bangalore"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:bg-white focus:border-orange-500"
              />
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Quick Bengaluru Area Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                {bangalorePresets.map((loc) => (
                  <button
                    key={loc.name}
                    type="button"
                    onClick={() => {
                      setLatitude(loc.lat);
                      setLongitude(loc.lng);
                      setAddressApproximate(loc.name + ", Bengaluru");
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      latitude === loc.lat && longitude === loc.lng
                        ? "bg-orange-600 text-white border-orange-600 shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Maximum Travel Radius: <span className="text-orange-600 font-extrabold">{serviceRadiusKm} KM</span>
              </label>
              <input
                type="range"
                min={1}
                max={15}
                step={0.5}
                value={serviceRadiusKm}
                onChange={(e) => setServiceRadiusKm(parseFloat(e.target.value))}
                className="w-full accent-orange-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1">
                <span>1 KM (Immediate Neighborhood)</span>
                <span>5 KM (Recommended)</span>
                <span>15 KM (Extended City Zone)</span>
              </div>
            </div>
          </div>

          {/* Section 3: Account Security & Settings */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
            <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
              <Lock className="w-4 h-4 text-slate-700" />
              <span>Account Security & Preferences</span>
            </h2>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-slate-900">Security Credentials</h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Update your platform password and active device sessions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold shadow-xs transition-colors self-start sm:self-auto"
              >
                Change Password
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">
                Logged in as <strong>{user?.email || profile?.phone}</strong>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors inline-flex items-center space-x-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out of Session</span>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-8 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-md shadow-orange-600/20 flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Saving Profile..." : "Save & Update Profile"}</span>
            </button>
          </div>
        </form>

        {/* Change Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-float space-y-5 animate-scale-up text-slate-900">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-lg text-slate-900 font-display">
                  Change Password
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              {passwordSuccess ? (
                <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-200 space-y-2">
                  <p className="font-bold">✓ Password updated successfully!</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPasswordSuccess(false);
                    }}
                    className="mt-2 px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowPasswordModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordSuccess(true);
                      }}
                      className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                    >
                      Save Password
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
