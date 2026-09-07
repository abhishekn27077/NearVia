import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Phone,
  CheckCircle2,
  PlayCircle,
  ShieldCheck,
  Navigation,
  ShieldAlert,
  Lock,
  RefreshCw,
  LogIn,
  AlertCircle,
  MessageSquare,
  KeyRound,
  LogOut,
  AlertTriangle,
  Banknote,
  FileText,
} from "lucide-react";
import { AssignmentDetail, AssignmentStatus } from "@nearvia/types";
import { AssignmentStatusTimeline } from "./AssignmentStatusTimeline";
import { ReviewForm } from "../../components/trust/ReviewForm";
import { formatCurrencyINR, formatScheduleRange, playMechanicalTick, playPaymentSuccessChime } from "../../utils";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";
import { MessageModal } from "../messages/MessageModal";
import { JobEvidenceGallery } from "./JobEvidenceGallery";
import { SafetyToolkitModal } from "./SafetyToolkitModal";
import { CashPaymentModal } from "../payments/CashPaymentModal";
import { PaymentReceiptModal } from "../payments/PaymentReceiptModal";
import { DirectionsModal } from "../discovery/DirectionsModal";

export const WorkerAssignmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isSafetyOpen, setIsSafetyOpen] = useState<boolean>(false);

  // Job PIN State
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);

  // Phase 7 Payment Modals
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Real-World Delivery Navigation Modal
  const [showDirectionsModal, setShowDirectionsModal] = useState<boolean>(false);
  const [workerLocation, setWorkerLocation] = useState<{ latitude: number; longitude: number }>({
    latitude: 12.9716,
    longitude: 77.5946,
  });

  // Check-Out / Completion Form State
  const [completionNotes, setCompletionNotes] = useState("");

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setWorkerLocation({
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
          });
        },
        () => {},
        { timeout: 5000 },
      );
    }
  }, []);

  const fetchAssignment = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setErrorStatus(null);
      setErrorMessage(null);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${webConfig.apiBaseUrl}/assignments/${id}`, {
        headers,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorStatus(res.status);
        setErrorMessage(data.error?.message || "Failed to load assignment details.");
        setAssignment(null);
        return;
      }
      setAssignment(data.data);
    } catch (err: any) {
      console.error("Fetch assignment error:", err);
      setErrorStatus(500);
      setErrorMessage(err.message || "Network error. Please check your connection.");
      setAssignment(null);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  const handleConfirm = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${webConfig.apiBaseUrl}/assignments/${id}/confirm`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to confirm assignment.");
      }
      await fetchAssignment();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !pinInput.trim()) return;
    try {
      setActionLoading(true);
      setPinError(null);
      setPinSuccess(null);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${webConfig.apiBaseUrl}/assignments/${id}/verify-pin`, {
        method: "POST",
        headers,
        body: JSON.stringify({ jobPin: pinInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPinError(data.error?.message || "Invalid Job PIN. Please ask provider for the 4-digit code.");
        return;
      }
      setPinSuccess("✓ Job PIN Verified! On-site arrival confirmed.");
      playPaymentSuccessChime(0.12);
      setPinInput("");
      await fetchAssignment();
    } catch (err: any) {
      setPinError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!id) return;
    setActionLoading(true);

    const performCheckIn = async (lat?: number, lng?: number) => {
      try {
        const payload: any = {
          verificationMethod: "GPS",
        };
        if (lat !== undefined && lng !== undefined) {
          payload.latitude = lat;
          payload.longitude = lng;
        }

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${webConfig.apiBaseUrl}/assignments/${id}/check-in`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || "Attendance check-in failed.");
        }
        alert("✓ Checked in successfully! Shift is ready to start.");
        await fetchAssignment();
      } catch (err: any) {
        alert(err.message);
      } finally {
        setActionLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => performCheckIn(pos.coords.latitude, pos.coords.longitude),
        () => performCheckIn(undefined, undefined),
      );
    } else {
      performCheckIn(undefined, undefined);
    }
  };

  const handleStartWork = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${webConfig.apiBaseUrl}/assignments/${id}/start`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to start shift.");
      }
      await fetchAssignment();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${webConfig.apiBaseUrl}/assignments/${id}/check-out`, {
        method: "POST",
        headers,
        body: JSON.stringify({ completionNotes: completionNotes || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to check out.");
      }
      alert("🎉 Shift checked out! Completion submitted for settlement.");
      await fetchAssignment();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 w-full bg-[#FAFAF9] py-20 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading shift console...</p>
        </div>
      </div>
    );
  }

  if (!assignment) {
    if (errorStatus === 401) {
      return (
        <div className="flex-1 w-full bg-[#FAFAF9] py-20">
          <div className="max-w-md mx-auto p-8 rounded-3xl bg-white border border-slate-200 shadow-card text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-slate-900 font-display">Session Expired or Sign-In Required</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              {errorMessage || "Please sign in to your NEARVIA worker account to access this shift console."}
            </p>
            <Link
              to="/login"
              className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to Continue</span>
            </Link>
          </div>
        </div>
      );
    }

    if (errorStatus === 403) {
      return (
        <div className="flex-1 w-full bg-[#FAFAF9] py-20">
          <div className="max-w-md mx-auto p-8 rounded-3xl bg-white border border-rose-100 shadow-card text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-slate-900 font-display">Access Restricted</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              You don't have permission to view this assignment. This shift belongs to another worker or employer.
            </p>
            <div className="pt-2">
              <Link
                to="/worker/assignments"
                className="inline-flex px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors"
              >
                Back to My Shifts
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 w-full bg-[#FAFAF9] py-20">
        <div className="max-w-md mx-auto p-8 rounded-3xl bg-white border border-slate-200 shadow-card text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-slate-900 font-display">Unable to Load Shift</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {errorMessage || "A network or server error occurred while retrieving shift details."}
          </p>
          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              onClick={() => fetchAssignment()}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <Link
              to="/worker/assignments"
              className="inline-flex px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
            >
              Back to Shifts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const scheduleStr = formatScheduleRange(
    assignment.workDate,
    assignment.startTime,
    assignment.endTime,
    assignment.durationHours,
  );

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation & Header */}
        <div>
          <Link
            to="/worker/assignments"
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Active Assignments</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
                  {assignment.opportunityTitle || "Shift Execution Console"}
                </h1>
                {assignment.jobPinVerifiedAt && (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>PIN Verified</span>
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                Employer: <strong className="text-slate-800">{assignment.providerBusinessName || assignment.providerFullName}</strong> • Schedule: <strong className="text-slate-800">{scheduleStr}</strong> • Payout: <strong className="text-emerald-600">{formatCurrencyINR(assignment.agreedWage)}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
              {/* 🛡️ Floating / Header Safety Toolkit Trigger */}
              <button
                type="button"
                onClick={() => setIsSafetyOpen(true)}
                className="px-4 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black transition-all flex items-center space-x-1.5 shadow-xs"
              >
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>🛡️ Safety Toolkit</span>
              </button>

              <button
                type="button"
                onClick={() => setIsChatOpen(true)}
                className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center space-x-2 shadow-xs"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Message Employer</span>
              </button>

              {assignment.providerContactPhone && (
                <a
                  href={`tel:${assignment.providerContactPhone}`}
                  className="px-4 py-2.5 rounded-2xl bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 text-xs font-bold transition-all flex items-center space-x-2 shadow-xs"
                >
                  <Phone className="w-4 h-4 text-orange-600" />
                  <span>Call: {assignment.providerContactPhone}</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Real-World Delivery Tracking Shift HUD (Uber / Zomato / Swiggy Paradigm) */}
        <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/90 shadow-card space-y-6 card-premium">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            {/* Left: What, Who, Payout */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 text-[11px] font-black tracking-wider uppercase">
                  {assignment.workType}
                </span>
                <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                  {formatCurrencyINR(assignment.agreedWage)} • Guaranteed Pay
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-display-title">
                {assignment.opportunityTitle}
              </h2>

              <div className="text-xs text-slate-500 font-medium flex items-center space-x-2">
                <span>Employer:</span>
                <strong className="text-slate-800">{assignment.providerBusinessName || assignment.providerFullName}</strong>
                <span className="text-slate-300">•</span>
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{scheduleStr}</span>
              </div>
            </div>

            {/* Right: Where & Direction Action */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 min-w-[280px]">
              <div className="flex items-start space-x-2">
                <Navigation className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destination</div>
                  <div className="text-xs font-black text-slate-900 line-clamp-1">
                    {assignment.addressApproximate || "Workplace Address in Bengaluru"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDirectionsModal(true)}
                  className="flex-1 py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all flex items-center justify-center space-x-1.5 shadow-xs btn-tactile"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Get Directions</span>
                </button>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                    assignment.opportunityLatitude && assignment.opportunityLongitude
                      ? `${assignment.opportunityLatitude},${assignment.opportunityLongitude}`
                      : assignment.addressApproximate || "Bengaluru"
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center justify-center space-x-1"
                  title="Open in Google Maps"
                >
                  <span>Maps ↗</span>
                </a>
              </div>
            </div>
          </div>

          {/* Dynamic Next Step Guidance Bar */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div>
              <div className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider">
                Current Operational Step
              </div>
              <div className="text-sm font-black text-white mt-0.5">
                {assignment.status === AssignmentStatus.ASSIGNED && "Step 1: Confirm attendance so employer knows you are coming"}
                {assignment.status === AssignmentStatus.CONFIRMED && "Step 2: Head to location and tap Check-In when you arrive"}
                {assignment.status === AssignmentStatus.CHECKED_IN && "Step 3: Arrival verified! Tap Start Work when beginning tasks"}
                {assignment.status === AssignmentStatus.IN_PROGRESS && "Step 4: Shift in progress. Complete tasks and check-out to get paid"}
                {assignment.status === AssignmentStatus.COMPLETED && "Step 5: Shift complete! View receipt and submit rating"}
              </div>
            </div>

            {/* Direct 1-Tap Execution Button */}
            {assignment.status === AssignmentStatus.ASSIGNED && (
              <button
                onClick={handleConfirm}
                disabled={actionLoading}
                className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-900 text-xs font-black shadow-md transition-all shrink-0 btn-tactile"
              >
                {actionLoading ? "Confirming..." : "✓ Confirm Shift Attendance"}
              </button>
            )}

            {assignment.status === AssignmentStatus.CONFIRMED && (
              <button
                onClick={handleCheckIn}
                disabled={actionLoading}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-md transition-all shrink-0 flex items-center space-x-1.5 btn-tactile"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{actionLoading ? "Verifying..." : "📍 Arrived On Site (1-Tap Check-In)"}</span>
              </button>
            )}

            {assignment.status === AssignmentStatus.CHECKED_IN && (
              <button
                onClick={handleStartWork}
                disabled={actionLoading}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-md transition-all shrink-0 flex items-center space-x-1.5 btn-tactile"
              >
                <PlayCircle className="w-4 h-4" />
                <span>{actionLoading ? "Starting..." : "▶ Start Working Now"}</span>
              </button>
            )}

            {assignment.status === AssignmentStatus.IN_PROGRESS && (
              <a
                href="#checkout-section"
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-black shadow-md transition-all shrink-0 flex items-center space-x-1.5 btn-tactile"
              >
                <LogOut className="w-4 h-4" />
                <span>Complete Shift & Check Out</span>
              </a>
            )}

            {assignment.status === AssignmentStatus.COMPLETED && (
              <button
                onClick={() => setIsReceiptModalOpen(true)}
                className="px-6 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-black shadow-md transition-all shrink-0 flex items-center space-x-1.5 btn-tactile"
              >
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>View Receipt</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Stepper Timeline */}
        <AssignmentStatusTimeline
          status={assignment.status}
          assignedAt={assignment.assignedAt}
          confirmedAt={assignment.confirmedAt}
          checkedInAt={assignment.checkedInAt}
          startedAt={assignment.startedAt}
          completedAt={assignment.completedAt}
          cancelledAt={assignment.cancelledAt}
          noShowAt={assignment.noShowAt}
        />

        {/* On-Site Job PIN Verification Card (When on site before / during check-in) */}
        {!assignment.jobPinVerifiedAt && assignment.status !== AssignmentStatus.COMPLETED && assignment.status !== AssignmentStatus.CANCELLED && (
          <div className="p-6 sm:p-7 rounded-3xl bg-linear-to-br from-orange-50/80 to-amber-50/60 border border-orange-200/90 shadow-card space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 font-display">
                    On-Site Arrival PIN Verification
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    Ask the employer on site for their 4-digit Job PIN to verify arrival.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setPinInput(val);
                    if (typeof window !== "undefined" && "vibrate" in navigator) {
                      try { navigator.vibrate(10); } catch {}
                    }
                  }}
                  placeholder="4-digit PIN (e.g. 5829)"
                  className="px-4 py-3 rounded-2xl bg-white border border-orange-300 text-slate-900 text-base font-black tracking-widest text-center focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 font-mono"
                />
                <button
                  type="submit"
                  disabled={actionLoading || pinInput.length < 4}
                  className="px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black shadow-md shadow-orange-600/25 transition-transform duration-100 ease-out active:scale-95 disabled:opacity-50 btn-tactile touch-target"
                >
                  {actionLoading ? "Verifying PIN..." : "Verify Arrival PIN"}
                </button>
              </div>

              {/* Tactile On-Site Keypad Spell for Quick 1-Handed Mobile Entry */}
              <div className="pt-2 border-t border-orange-200/60">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center mb-2 font-caption-refined">
                  Quick Mobile Keypad
                </p>
                <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "⌫"].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        playMechanicalTick(0.08);
                        if (typeof window !== "undefined" && "vibrate" in navigator) {
                          try { navigator.vibrate(12); } catch {}
                        }
                        if (k === "Clear") {
                          setPinInput("");
                        } else if (k === "⌫") {
                          setPinInput((prev) => prev.slice(0, -1));
                        } else if (pinInput.length < 4) {
                          setPinInput((prev) => prev + k);
                        }
                      }}
                      className="keypad-btn py-2.5 rounded-xl bg-white border border-orange-200/80 text-slate-900 text-sm font-black shadow-xs hover:bg-orange-50/50 active:bg-orange-100 select-none flex items-center justify-center touch-target"
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            </form>

            {pinError && (
              <div className="p-3 rounded-xl bg-rose-100/80 border border-rose-200 text-rose-800 text-xs font-medium flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{pinError}</span>
              </div>
            )}

            {pinSuccess && (
              <div className="p-3 rounded-xl bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{pinSuccess}</span>
              </div>
            )}
          </div>
        )}

        {/* Live Execution Panel based on status */}
        <div className="p-6 sm:p-8 rounded-3xl card-premium space-y-6">
          {assignment.status === AssignmentStatus.ASSIGNED && (
            <div className="space-y-4 text-center py-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900 font-display">Confirm Shift Attendance</h3>
              <p className="text-xs text-slate-500 font-medium">
                Please confirm that you will arrive on time at {assignment.addressApproximate || "the scheduled address"}.
              </p>
              <button
                onClick={handleConfirm}
                disabled={actionLoading}
                className="w-full py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition-all shadow-md shadow-orange-600/20 disabled:opacity-50"
              >
                {actionLoading ? "Confirming..." : "✓ Confirm Shift Attendance"}
              </button>
            </div>
          )}

          {assignment.status === AssignmentStatus.CONFIRMED && (
            <div className="space-y-4">
              <h3 className="text-base font-black text-slate-900 font-display flex items-center space-x-2">
                <Navigation className="w-4 h-4 text-orange-600" />
                <span>Step 2: On-Site Attendance Check-In</span>
              </h3>
              <p className="text-xs text-slate-500">
                When you arrive at {assignment.addressApproximate || "the work location"}, tap Check-In to record your GPS arrival.
              </p>

              <button
                onClick={handleCheckIn}
                disabled={actionLoading}
                className="w-full py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition-all shadow-md shadow-orange-600/20 flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{actionLoading ? "Verifying GPS..." : "📍 Check-In On Site (GPS Verified)"}</span>
              </button>
            </div>
          )}

          {assignment.status === AssignmentStatus.CHECKED_IN && (
            <div className="space-y-4 text-center py-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                <PlayCircle className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900 font-display">Ready to Begin Working</h3>
              <p className="text-xs text-slate-500 font-medium">
                Attendance verified. Start the shift timer when you begin your tasks.
              </p>
              <button
                onClick={handleStartWork}
                disabled={actionLoading}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {actionLoading ? "Starting..." : "▶ Start Shift Now"}
              </button>
            </div>
          )}

          {assignment.status === AssignmentStatus.IN_PROGRESS && (
            <div className="space-y-6">
              <div className="flex items-center justify-between text-amber-800 bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-amber-600 animate-spin shrink-0" />
                  <div>
                    <div className="text-xs font-black">Shift Currently In Progress</div>
                    <div className="text-[11px] text-amber-700">
                      Started at {assignment.startedAt ? new Date(assignment.startedAt).toLocaleTimeString() : "now"}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-slate-900">Guaranteed Pay</div>
                  <div className="text-sm font-black text-emerald-600">{formatCurrencyINR(assignment.agreedWage)}</div>
                </div>
              </div>

              {/* Photo Evidence Section */}
              <div className="pt-2 border-t border-slate-100">
                <JobEvidenceGallery assignmentId={assignment.id} />
              </div>

              {/* Check Out Form */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Handover Notes / Summary (Optional)
                </label>
                <textarea
                  rows={2}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="e.g. Completed kitchen sanitization, returned access card..."
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:bg-white focus:border-orange-500"
                />

                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{actionLoading ? "Submitting Check-Out..." : "✓ Check-Out & Submit Shift Completion"}</span>
                </button>
              </div>
            </div>
          )}

          {assignment.status === AssignmentStatus.COMPLETED && (
            <div className="space-y-6">
              {assignment.paymentStatus === "CONFIRMED" ? (
                // 1. Confirmed Payout Banner & Receipt Viewer
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="text-sm font-black">Shift Completed & Wage Settled!</h4>
                      <p className="text-xs text-emerald-700">
                        Total Payout: <strong className="text-emerald-900 font-extrabold">{formatCurrencyINR(assignment.finalWagePaid || assignment.agreedWage)}</strong> via {assignment.paymentMethod || "Direct"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsReceiptModalOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs self-start sm:self-auto"
                  >
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>View Digital Receipt</span>
                  </button>
                </div>
              ) : (
                // 2. Pending Settlement Banner & Cash PIN Confirmation Trigger
                <div className="p-6 rounded-3xl bg-linear-to-br from-slate-900 to-slate-800 text-white space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                        Shift Complete — Awaiting Settlement
                      </span>
                      <h3 className="text-base font-extrabold text-white">
                        Agreed Wage: {formatCurrencyINR(assignment.agreedWage)}
                      </h3>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
                      Settlement Pending
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Did employer hand over cash? Enter the 4-digit PIN provided by your employer to confirm receipt on the NEARVIA ledger.
                  </p>

                  <div className="pt-2">
                    <button
                      onClick={() => setIsCashModalOpen(true)}
                      className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all flex items-center justify-center space-x-2 shadow-md"
                    >
                      <Banknote className="w-4 h-4" />
                      <span>💵 Received Cash? Enter 4-Digit Payment PIN</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Read-Only Photo Evidence */}
              <JobEvidenceGallery assignmentId={assignment.id} isReadOnly />

              {/* Review Section */}
              <div className="pt-2 border-t border-slate-100">
                <ReviewForm assignmentId={assignment.id} />
              </div>
            </div>
          )}
        </div>

        {/* Direct In-App Message Modal */}
        <MessageModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          workOpportunityId={assignment.workOpportunityId}
          opportunityTitle={assignment.opportunityTitle}
          counterpartyName={assignment.providerBusinessName || assignment.providerFullName}
        />

        {/* Safety & SOS Modal */}
        <SafetyToolkitModal
          isOpen={isSafetyOpen}
          onClose={() => setIsSafetyOpen(false)}
          assignment={assignment}
          onOpenChat={() => setIsChatOpen(true)}
        />

        {/* Phase 7 Cash Payment Modal */}
        <CashPaymentModal
          isOpen={isCashModalOpen}
          onClose={() => setIsCashModalOpen(false)}
          assignmentId={assignment.id}
          agreedWage={assignment.agreedWage}
          workerName={assignment.workerFullName}
          opportunityTitle={assignment.opportunityTitle}
          userRole="WORKER"
          onSuccess={async () => {
            await fetchAssignment();
          }}
        />

        {/* Phase 7 Payment Receipt Modal */}
        <PaymentReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          assignmentId={assignment.id}
        />

        {/* Real-World Directions Routing Modal */}
        {showDirectionsModal && (
          <DirectionsModal
            isOpen={showDirectionsModal}
            onClose={() => setShowDirectionsModal(false)}
            origin={workerLocation}
            destination={{
              latitude: assignment.opportunityLatitude || 12.9784,
              longitude: assignment.opportunityLongitude || 77.6408,
            }}
            destinationTitle={assignment.opportunityTitle}
            destinationAddress={assignment.addressApproximate || "Workplace Destination, Bengaluru"}
          />
        )}
      </div>
    </div>
  );
};
