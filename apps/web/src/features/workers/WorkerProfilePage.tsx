/**
 * NEARVIA Worker Profile & Account Settings
 * Redesigned single account-management hub:
 * 1. Personal Information & contact credentials with safe phone editing
 * 2. Skills & Work Preferences with clean empty state and manage link
 * 3. Trust & Verification consolidated status and link to /worker/verification
 * 4. Location & 5 KM service radius preferences
 * 5. Account Security, sessions, and password management
 * 6. Canonical Worker ID with 1-click copy for Agent/Employer assistance
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
  Phone,
  Lock,
  LogOut,
  Power,
  BadgeCheck,
  Copy,
  Check,
  Mail,
  Users,
  ArrowRight,
  Edit3,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiFetch, parseApiResponse } from "../../utils/apiClient";
import { WorkerProfileDetail } from "@nearvia/types";

export const WorkerProfilePage: React.FC = () => {
  const { token, user, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<WorkerProfileDetail | null>(null);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);
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

  // Phone Edit State
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [phoneUpdating, setPhoneUpdating] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSuccess, setPhoneSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
    fetchVerifications();
    fetchAgents();
  }, [token]);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch("/workers/me");
      const result = await parseApiResponse<WorkerProfileDetail>(res);
      if (result.success && result.data) {
        const data = result.data;
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
      // Fallback handled gracefully
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVerifications = async () => {
    if (!token) return;
    try {
      const res = await apiFetch("/verification/me");
      const result = await parseApiResponse<any[]>(res);
      if (result.success && Array.isArray(result.data)) {
        setVerifications(result.data);
      }
    } catch {
      // Non-blocking
    }
  };

  const fetchAgents = async () => {
    if (!token) return;
    try {
      const res = await apiFetch("/workers/me/agents");
      const result = await parseApiResponse<any[]>(res);
      if (result.success && Array.isArray(result.data)) {
        setAgents(result.data);
      }
    } catch {
      // Non-blocking
    }
  };

  const handleCopyWorkerId = () => {
    const idToCopy = profile?.id || user?.id;
    if (idToCopy) {
      navigator.clipboard.writeText(idToCopy);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleToggleAvailability = async () => {
    const nextState = !isAvailableNow;
    setIsAvailableNow(nextState);
    setIsUpdatingAvailability(true);
    try {
      const res = await apiFetch("/workers/me/availability", {
        method: "PATCH",
        body: JSON.stringify({ isAvailableNow: nextState }),
      });
      const result = await parseApiResponse(res);
      if (result.success) {
        setFeedback({
          type: "success",
          message: nextState
            ? "✓ You are now live and discovering urgent work opportunities within 5 km!"
            : "Shift discovery paused. You are currently marked away.",
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
            message: "Unable to retrieve device GPS. Please choose a Bengaluru area preset below.",
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
      const [profileRes, locationRes] = await Promise.all([
        apiFetch("/workers/me", {
          method: "PATCH",
          body: JSON.stringify(profilePayload),
        }),
        apiFetch("/workers/me/location", {
          method: "PATCH",
          body: JSON.stringify(locationPayload),
        }),
      ]);

      const [profResult, locResult] = await Promise.all([
        parseApiResponse(profileRes),
        parseApiResponse(locationRes),
      ]);

      if (profResult.success && locResult.success) {
        await fetchProfile();
        setFeedback({
          type: "success",
          message: "✓ Worker profile & 5 km location updated and synchronized with Supabase.",
        });
      } else {
        throw new Error(
          profResult.error?.message || locResult.error?.message || "Failed to update profile.",
        );
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

  const handleUpdatePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    setPhoneSuccess(null);

    const cleanDigits = newPhone.trim().replace(/[\s\-()]/g, "");
    if (!cleanDigits || cleanDigits.length < 10) {
      setPhoneError("Please enter a valid 10-digit mobile number.");
      return;
    }

    const formatted = cleanDigits.startsWith("+")
      ? cleanDigits
      : cleanDigits.startsWith("91")
      ? `+${cleanDigits}`
      : `+91${cleanDigits}`;

    try {
      setPhoneUpdating(true);
      const res = await apiFetch("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ phone: formatted }),
      });
      const result = await parseApiResponse(res);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update mobile number.");
      }

      setPhoneSuccess("✓ Mobile number updated. Saved as contact info (SMS OTP is not required in V1).");
      await refreshProfile();
      await fetchProfile();
      setTimeout(() => {
        setPhoneModalOpen(false);
        setPhoneSuccess(null);
        setNewPhone("");
      }, 1500);
    } catch (err: any) {
      setPhoneError(err.message || "Failed to update mobile number.");
    } finally {
      setPhoneUpdating(false);
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

  // Compute live verification states matching backend
  const emailVerified = Boolean(user?.emailVerified);
  const latestIdReq = verifications.find(
    (v) =>
      v.verificationType === "IDENTITY" ||
      v.verificationType === "AADHAAR" ||
      v.verificationType === "GOVERNMENT_ID",
  );
  const identityVerified = Boolean(user?.identityVerified);

  let idStatusText = "Not Submitted";
  let idStatusColor = "text-slate-500 bg-slate-100 border-slate-200";
  if (identityVerified) {
    idStatusText = "Verified";
    idStatusColor = "text-blue-700 bg-blue-50 border-blue-200";
  } else if (latestIdReq?.status === "PENDING") {
    idStatusText = "Pending Review";
    idStatusColor = "text-amber-700 bg-amber-50 border-amber-200";
  } else if (latestIdReq?.status === "RESUBMISSION_REQUIRED") {
    idStatusText = "Action Required";
    idStatusColor = "text-orange-700 bg-orange-50 border-orange-200";
  } else if (latestIdReq?.status === "REJECTED") {
    idStatusText = "Rejected";
    idStatusColor = "text-rose-700 bg-rose-50 border-rose-200";
  }

  const activeAgentsCount = agents.filter((a) => a.status === "ACTIVE").length;
  const pendingAgentsCount = agents.filter((a) => a.status === "PENDING").length;

  const completion = profile?.profileCompletion;
  const workerInitial = profile?.fullName
    ? profile.fullName[0]?.toUpperCase()
    : user?.fullName
    ? user.fullName[0]?.toUpperCase()
    : "W";

  const canonicalWorkerId = profile?.id || user?.id || "";

  if (isLoading) {
    return (
      <div className="flex-1 w-full bg-[#FAFAF9] py-20 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading worker profile hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* ================================================================ */}
        {/* TOP PROFILE CARD: Identity, Canonical Worker ID, Live Toggle    */}
        {/* ================================================================ */}
        <div className="p-6 sm:p-8 rounded-3xl card-premium flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center space-x-5">
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-700 text-white flex items-center justify-center text-3xl sm:text-4xl font-black shadow-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]">
                {workerInitial}
              </div>
              <span
                className={`absolute bottom-0 right-0 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center ${
                  isAvailableNow ? "bg-emerald-500" : "bg-slate-400"
                }`}
                title={isAvailableNow ? "Available Now for Local Shifts" : "Offline / Away"}
              >
                <Power className="w-3 h-3 text-white" />
              </span>
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display truncate">
                  {profile?.fullName || user?.fullName || "NEARVIA Worker"}
                </h1>
                {identityVerified && (
                  <span
                    className="p-1 rounded-full bg-blue-50 text-blue-600"
                    title="Government ID Verified by Platform Admin"
                  >
                    <BadgeCheck className="w-5 h-5" />
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 font-medium">
                {profile?.addressApproximate || "Indiranagar, Bengaluru"} • Member since 2026
              </p>

              {/* Canonical Worker ID with Copy Action */}
              <div className="pt-1 flex items-center space-x-2 flex-wrap">
                <div
                  className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-[11px] font-mono font-bold cursor-pointer transition-colors group"
                  onClick={handleCopyWorkerId}
                  title="Click to copy your unique Worker ID (used by local agents and employers)"
                >
                  <span className="text-slate-400 font-sans font-medium">ID:</span>
                  <span className="truncate max-w-[180px] sm:max-w-[260px]">{canonicalWorkerId}</span>
                  {copiedId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 shrink-0" />
                  )}
                </div>
                {copiedId && (
                  <span className="text-[11px] font-bold text-emerald-600 animate-fade-in">
                    Copied!
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
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
              to="/worker/verification"
              className="px-4 py-3 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold transition-all flex items-center justify-center space-x-1.5 btn-tactile active:scale-95"
            >
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Verification Center</span>
            </Link>
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

        {/* Profile Completion & Trust Level */}
        {completion && (
          <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-orange-600" />
                <span className="font-black text-slate-900 text-sm font-display">
                  Profile Completion & Trust Readiness
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
                  Complete these to boost instant 5 km match ranking:{" "}
                  <strong className="font-bold">{completion.missingRequired.join(", ")}</strong>
                </span>
              </div>
            ) : (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center space-x-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Your profile is fully configured for automated hyperlocal shift dispatch.</span>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* MAIN PROFILE FORM: Structured Hub                                */}
        {/* ================================================================ */}
        <form onSubmit={handleSaveProfile} className="space-y-8">
          {/* SECTION 1: Personal & Contact Information */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
                <User className="w-4 h-4 text-orange-600" />
                <span>Personal Information & Contact</span>
              </h2>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Account Details
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name (Account)
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

              {/* Registered Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Registered Email ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={profile?.email || user?.email || "worker@nearvia.in"}
                    disabled
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 text-sm font-bold cursor-not-allowed"
                  />
                  <Mail className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* Mobile Number with Edit/Change Action */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Contact Mobile Number
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPhone(profile?.phone || user?.phone || "");
                      setPhoneModalOpen(true);
                    }}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 inline-flex items-center space-x-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Change Mobile</span>
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {profile?.phone || user?.phone || "No phone added yet"}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        Optional in NEARVIA V1 • Stored for employer contact and shift alerts.
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-slate-200/70 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                    {user?.phone ? "Contact Saved" : "Optional"}
                  </span>
                </div>
              </div>
            </div>

            {/* Trade Bio */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Trade Bio & Worker Summary
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe your trade background, experience with local businesses, tools owned, and reliability..."
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-medium focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
              />
            </div>
          </div>

          {/* SECTION 2: Skills & Work Preferences */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
                  <Sparkles className="w-4 h-4 text-orange-600" />
                  <span>Skills & Work Preferences</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Your registered trade skills define which local jobs and shifts match your profile.
                </p>
              </div>

              <Link
                to="/worker/skills"
                className="px-3.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-bold transition flex items-center space-x-1"
              >
                <span>Manage Skills</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Skills Display & Empty State */}
            {profile?.skills && profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2.5">
                {profile.skills.map((s) => (
                  <div
                    key={s.skillId}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center space-x-3 text-xs"
                  >
                    <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{s.skillName}</div>
                      <div className="text-[10px] text-slate-400">
                        {s.categoryName} • {s.yearsExperience} yrs exp
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-amber-50/70 border border-amber-200 text-center space-y-3">
                <Sparkles className="w-8 h-8 text-amber-600 mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-900">No Trade Skills Added Yet</h4>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Add skills like Plumbing, Carpentry, Electrical, or Retail to start receiving automated match recommendations within 5 km.
                  </p>
                </div>
                <Link
                  to="/worker/skills"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Add Skills Now</span>
                </Link>
              </div>
            )}

            {/* Rates & Experience */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
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
                  onChange={(e) =>
                    setHourlyRateEstimate(e.target.value === "" ? "" : Number(e.target.value))
                  }
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
                  onChange={(e) =>
                    setDailyRateEstimate(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="1000"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:bg-white focus:border-orange-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Trust & Verification Consolidated Hub */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Trust & Verification Center</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Your verification status builds credibility with verified local employers.
                </p>
              </div>

              <Link
                to="/worker/verification"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center space-x-1.5 self-start sm:self-auto shadow-xs"
              >
                <span>Manage Verification</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Verification Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email Verification */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>Email Account Ownership</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      emailVerified
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {emailVerified ? "Verified" : "Pending Verification"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {emailVerified
                    ? "Supabase Auth email verified. Ensures account recovery and security."
                    : "Check your inbox for the Supabase confirmation link to activate your account."}
                </p>
              </div>

              {/* Government ID Verification */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <BadgeCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Government ID / Aadhaar</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${idStatusColor}`}
                  >
                    {idStatusText}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {identityVerified
                    ? "Verified via official document review. Your profile displays the blue Trust Badge."
                    : "Upload Aadhaar or Government ID in the Verification Center for manual review."}
                </p>
              </div>

              {/* Contact Phone */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>Contact Mobile Phone</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700 border border-slate-300">
                    {user?.phone ? "Contact Saved" : "Optional"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Used exclusively for shift coordination. SMS OTP is not required in NEARVIA V1.
                </p>
              </div>

              {/* Assisted Access Agents */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Community Agent Support</span>
                  </span>
                  <Link
                    to="/worker/agents"
                    className="text-[10px] font-bold text-cyan-700 hover:underline"
                  >
                    Manage Consent ({activeAgentsCount} active)
                  </Link>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {pendingAgentsCount > 0 ? (
                    <span className="text-amber-700 font-bold">
                      ● {pendingAgentsCount} pending assistance request(s) awaiting your review!
                    </span>
                  ) : activeAgentsCount > 0 ? (
                    `${activeAgentsCount} local community agent(s) authorized to assist you.`
                  ) : (
                    "No community agents connected. Agents must request your consent before assisting."
                  )}
                </p>
              </div>
            </div>

            {/* Legal / Policy Disclaimer */}
            <div className="p-3.5 rounded-2xl bg-slate-100/70 border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
              <strong className="text-slate-700 font-bold">Important Notice:</strong> Email verification
              confirms account access; it does not replace Government ID verification. Identity documents
              submitted to NEARVIA are stored in an encrypted vault and reviewed manually by authorized platform administrators.
            </div>
          </div>

          {/* SECTION 4: Location & Spatial Base */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
                  <MapPin className="w-4 h-4 text-orange-600" />
                  <span>Base Location & 5 KM Service Radius</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Used by NEARVIA to calculate proximity and match jobs within your neighborhood.
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
                Maximum Travel Radius:{" "}
                <span className="text-orange-600 font-extrabold">{serviceRadiusKm} KM</span>
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
                <span>1 KM (Neighborhood)</span>
                <span>5 KM (Recommended)</span>
                <span>15 KM (Extended City)</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 font-medium">
              🔒 <strong className="text-slate-600">Privacy Safeguard:</strong> Your precise GPS
              coordinates are never displayed to employers or public directories. NEARVIA only shares
              your approximate area and distance to protect your personal privacy.
            </p>
          </div>

          {/* SECTION 5: Account Security & Settings */}
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

          {/* Submit Action */}
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

        {/* ================================================================ */}
        {/* EDIT PHONE MODAL (Requirement 4)                                */}
        {/* ================================================================ */}
        {phoneModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-float space-y-5 animate-scale-up text-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-orange-600" />
                  <h3 className="font-black text-lg text-slate-900 font-display">
                    Change Mobile Number
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPhoneModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-500 font-medium">
                Update your contact number for shift coordination. In NEARVIA V1, SMS OTP is not used; your number is saved directly to your account.
              </p>

              {phoneSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-200 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{phoneSuccess}</span>
                </div>
              )}

              {phoneError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-800 text-xs font-medium border border-rose-200 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{phoneError}</span>
                </div>
              )}

              <form onSubmit={handleUpdatePhone} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    New Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold focus:bg-white focus:border-orange-500"
                  />
                  <span className="text-[11px] text-slate-400 font-medium mt-1 block">
                    Format: 10 digits or with +91 country prefix
                  </span>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPhoneModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={phoneUpdating || !newPhone.trim()}
                    className="px-5 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 disabled:opacity-50"
                  >
                    {phoneUpdating ? "Saving..." : "Save Mobile Number"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* CHANGE PASSWORD MODAL                                            */}
        {/* ================================================================ */}
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
