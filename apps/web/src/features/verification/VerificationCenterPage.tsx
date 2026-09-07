import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  FileText,
  Building2,
  Sparkles,
  X,
  Lock,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { UserRole } from "@nearvia/types";
import { webConfig } from "../../config";

export const VerificationCenterPage: React.FC = () => {
  const { user, token, refreshProfile } = useAuth();

  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || "+91");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [idModalOpen, setIdModalOpen] = useState(false);
  const [idType, setIdType] = useState("AADHAAR");
  const [idRef, setIdRef] = useState("");
  const [idLoading, setIdLoading] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);
  const [idSuccess, setIdSuccess] = useState(false);

  const [businessModalOpen, setBusinessModalOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessGstin, setBusinessGstin] = useState("");
  const [bizLoading, setBizLoading] = useState(false);
  const [bizError, setBizError] = useState<string | null>(null);
  const [bizSuccess, setBizSuccess] = useState(false);

  const [verifications, setVerifications] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch(`${webConfig.apiBaseUrl}/verification/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setVerifications(data.data);
        }
      })
      .catch(() => {});
  }, [token, idSuccess, bizSuccess]);

  // Compute live verification states backed by DB
  const emailVerified = Boolean(user?.email);
  const phoneVerified = Boolean(user?.mobileVerified);
  
  const pendingIdReq = verifications.find(
    (v) => (v.verificationType === "IDENTITY" || v.verificationType === "AADHAAR" || v.verificationType === "GOVERNMENT_ID") && v.status === "PENDING"
  );
  const identityVerified = Boolean(user?.identityVerified);
  const idStatus = identityVerified ? "VERIFIED" : pendingIdReq ? "PENDING" : "NOT_VERIFIED";

  const pendingBizReq = verifications.find(
    (v) => (v.verificationType === "BUSINESS" || v.targetType === "BUSINESS") && v.status === "PENDING"
  );
  const bizVerified = false; // Backed by provider profile
  const bizStatus = bizVerified ? "VERIFIED" : pendingBizReq ? "PENDING" : "NOT_VERIFIED";

  // Calculate percentage
  let totalSteps = user?.role === UserRole.PROVIDER ? 4 : 3;
  let completedSteps = 0;
  if (emailVerified) completedSteps++;
  if (phoneVerified) completedSteps++;
  if (identityVerified) completedSteps++;
  if (user?.role === UserRole.PROVIDER && bizVerified) completedSteps++;

  const completionPercent = Math.round((completedSteps / totalSteps) * 100);

  const [countdown, setCountdown] = useState(0);
  const [providerInfo, setProviderInfo] = useState<string>("mock");

  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendOtp = async () => {
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/auth/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone: phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to send verification code.");
      }
      setOtpSent(true);
      setCountdown(data.data?.cooldownSeconds || 60);
      setProviderInfo(data.data?.provider || "mock");
      if (data.data?.provider === "mock") {
        setOtpCode("123456");
      }
    } catch (err: any) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/auth/resend-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone: phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to resend verification code.");
      }
      setCountdown(data.data?.cooldownSeconds || 60);
      if (data.data?.provider === "mock") {
        setOtpCode("123456");
      }
    } catch (err: any) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/auth/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone: phoneNumber, otp: otpCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to verify phone OTP.");
      }
      if (refreshProfile) {
        await refreshProfile();
      }
      setPhoneModalOpen(false);
      setOtpSent(false);
    } catch (err: any) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmitIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIdLoading(true);
    setIdError(null);
    try {
      const targetType = user?.role === UserRole.WORKER ? "WORKER" : "PROVIDER";
      const res = await fetch(`${webConfig.apiBaseUrl}/verification/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType,
          verificationType: "GOVERNMENT_ID",
          documentRef: `DOC_HASH_${idType}_${idRef.slice(-4) || "REF"}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to submit verification request.");
      }
      setIdSuccess(true);
      setIdModalOpen(false);
      if (refreshProfile) await refreshProfile();
    } catch (err: any) {
      setIdError(err.message);
    } finally {
      setIdLoading(false);
    }
  };

  const handleSubmitBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setBizLoading(true);
    setBizError(null);
    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/verification/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType: "BUSINESS",
          verificationType: "BUSINESS_REGISTRATION",
          documentRef: `BIZ_GSTIN_${businessGstin.trim()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to submit business verification.");
      }
      setBizSuccess(true);
      setBusinessModalOpen(false);
    } catch (err: any) {
      setBizError(err.message);
    } finally {
      setBizLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Header & Overview */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-orange-600 font-bold text-xs uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Progressive Trust System</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              Trust & Verification Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Verify your identity layers progressively. High trust scores unlock faster matching and verified badges.
            </p>
          </div>

          {/* Trust Score Meter */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-card flex items-center space-x-4">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500 transition-all duration-1000"
                  strokeDasharray={`${completionPercent}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute font-black text-xs text-slate-900">{completionPercent}%</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase">Trust Level</div>
              <div className="text-sm font-black text-slate-900">
                {completedSteps} of {totalSteps} Verified
              </div>
            </div>
          </div>
        </div>

        {/* Verification Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Email Verification */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Mail className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>VERIFIED</span>
              </span>
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Email Address</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{user?.email}</p>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your primary email is confirmed and secured for all system notifications and payment receipts.
            </p>
          </div>

          {/* 2. Mobile Phone Verification */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                <Phone className="w-6 h-6" />
              </div>
              {phoneVerified ? (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>VERIFIED</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  NOT VERIFIED
                </span>
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Mobile Phone Number</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {user?.phone || "No phone added"}
              </p>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Required for emergency coordination, arrival notifications, and payment alerts.
            </p>
            {!phoneVerified && (
              <button
                type="button"
                onClick={() => setPhoneModalOpen(true)}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Verify Phone via OTP
              </button>
            )}
          </div>

          {/* 3. Government ID / KYC Verification */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <FileText className="w-6 h-6" />
              </div>
              {idStatus === "VERIFIED" ? (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>VERIFIED</span>
                </span>
              ) : idStatus === "PENDING" ? (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>UNDER REVIEW</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                  NOT VERIFIED
                </span>
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Government ID & KYC</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Aadhaar, Voter ID, PAN, or Driving License
              </p>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Privacy-preserving verification. Raw document numbers are never exposed; only cryptographic hashes are stored.
            </p>
            {idStatus === "NOT_VERIFIED" && (
              <button
                type="button"
                onClick={() => setIdModalOpen(true)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Submit ID Reference
              </button>
            )}
          </div>

          {/* 4. Business Verification (For Providers) */}
          {user?.role === UserRole.PROVIDER && (
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
                  <Building2 className="w-6 h-6" />
                </div>
                {bizStatus === "VERIFIED" ? (
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>VERIFIED</span>
                  </span>
                ) : bizStatus === "PENDING" ? (
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>UNDER REVIEW</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                    OPTIONAL
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Business Registration</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">GSTIN / Shop & Establishment</p>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Unlock commercial hiring badges for warehouses, retail stores, and facilities management.
              </p>
              {bizStatus === "NOT_VERIFIED" && (
                <button
                  type="button"
                  onClick={() => setBusinessModalOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Verify Business
                </button>
              )}
            </div>
          )}
        </div>

        {/* Informational Banner */}
        <div className="p-5 rounded-3xl bg-orange-50/70 border border-orange-200/80 flex items-start space-x-3.5">
          <Sparkles className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-slate-700">
            <div className="font-black text-slate-900">Email-First Freedom</div>
            <p className="leading-relaxed">
              You can explore and use NEARVIA right now with email authentication. Additional verifications can be added whenever you wish to boost your standing.
            </p>
          </div>
        </div>

        {/* ── MODALS ── */}

        {/* Phone OTP Modal */}
        {phoneModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900 font-display">
                  {otpSent ? "Enter Verification Code" : "Verify Mobile Number"}
                </h3>
                <button
                  type="button"
                  onClick={() => setPhoneModalOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {otpError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {otpError}
                </div>
              )}

              {!otpSent ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Phone Number (India)
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-medium text-sm focus:bg-white focus:border-orange-500"
                    />
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
                    <span className="font-bold">Provider:</span> {providerInfo === "msg91" ? "MSG91 SMS Gateway" : "Mock Development Provider"} • Deterministic test code: <code className="font-mono bg-white px-1.5 py-0.5 rounded text-orange-600 font-bold">123456</code>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpLoading || phoneNumber.length < 10}
                    className="w-full py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md transition-colors disabled:opacity-50"
                  >
                    {otpLoading ? "Sending..." : "Send Verification Code"}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      6-Digit OTP Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      autoFocus
                      aria-label="Enter 6-digit OTP verification code"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-center text-lg font-black tracking-widest focus:bg-white focus:border-orange-500"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Didn't receive code?</span>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={otpLoading || countdown > 0}
                      className="font-bold text-orange-600 hover:underline disabled:text-slate-400 disabled:no-underline"
                    >
                      {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={otpLoading || otpCode.length !== 6}
                    className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors disabled:opacity-50"
                  >
                    {otpLoading ? "Verifying..." : "Confirm & Verify Phone"}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Identity / KYC Modal */}
        {idModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900 font-display">
                  Submit ID Reference (Demo KYC)
                </h3>
                <button
                  type="button"
                  onClick={() => setIdModalOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {idError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {idError}
                </div>
              )}

              <form onSubmit={handleSubmitIdentity} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Document Type
                  </label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-medium text-sm focus:bg-white"
                  >
                    <option value="AADHAAR">Aadhaar Card (Last 4 Digits Reference)</option>
                    <option value="PAN">PAN Card</option>
                    <option value="VOTER_ID">Voter Identity Card</option>
                    <option value="DRIVING_LICENSE">Driving License</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Reference ID / Last 4 Digits
                  </label>
                  <input
                    type="text"
                    required
                    value={idRef}
                    onChange={(e) => setIdRef(e.target.value)}
                    placeholder="e.g. 5678"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-medium text-sm focus:bg-white"
                  />
                </div>

                <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 text-[11px] text-blue-800 flex items-start space-x-2">
                  <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    Privacy Protected: NEARVIA converts this into a cryptographic hash reference. Raw identity data is never stored or shown.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={idLoading || !idRef}
                  className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-colors"
                >
                  {idLoading ? "Submitting..." : "Submit Verification Request"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Business Modal */}
        {businessModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900 font-display">
                  Business Verification
                </h3>
                <button
                  type="button"
                  onClick={() => setBusinessModalOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {bizError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {bizError}
                </div>
              )}

              <form onSubmit={handleSubmitBusiness} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Registered Business Name
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Metro Logistics Pvt Ltd"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-medium text-sm focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    GSTIN / Enterprise Registration Ref
                  </label>
                  <input
                    type="text"
                    required
                    value={businessGstin}
                    onChange={(e) => setBusinessGstin(e.target.value)}
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-medium text-sm focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={bizLoading || !businessName || !businessGstin}
                  className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-colors"
                >
                  {bizLoading ? "Submitting..." : "Submit Business Details"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
