import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Phone,
  CheckCircle2,
  ShieldCheck,
  Lock,
  RefreshCw,
  LogIn,
  AlertCircle,
  MessageSquare,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  Banknote,
  CreditCard,
  FileText,
} from "lucide-react";
import { AssignmentDetail, AssignmentStatus } from "@nearvia/types";
import { AssignmentStatusTimeline } from "./AssignmentStatusTimeline";
import { ReviewForm } from "../../components/trust/ReviewForm";
import { formatCurrencyINR, formatScheduleRange } from "../../utils";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";
import { MessageModal } from "../messages/MessageModal";
import { JobEvidenceGallery } from "./JobEvidenceGallery";
import { ReportModal } from "../safety/ReportModal";
import { CashPaymentModal } from "../payments/CashPaymentModal";
import { PaymentReceiptModal } from "../payments/PaymentReceiptModal";

export const ProviderAssignmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [copiedPin, setCopiedPin] = useState(false);

  // Phase 7 Payment Modals
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [onlinePaying, setOnlinePaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

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
      console.error(err);
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

  const handleCopyPin = async () => {
    if (!assignment?.jobPin) return;
    try {
      await navigator.clipboard.writeText(assignment.jobPin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2500);
    } catch (err) {
      console.error("Copy PIN error:", err);
    }
  };

  const handleConfirmCompletion = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${webConfig.apiBaseUrl}/assignments/${id}/confirm-completion`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to confirm completion.");
      }
      alert("🎉 Shift completion confirmed! You may now settle payment with worker.");
      await fetchAssignment();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayOnlineDirect = async () => {
    if (!id || !assignment) return;
    try {
      setOnlinePaying(true);
      setPayError(null);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // 1. Initiate Online Order
      const initRes = await fetch(`${webConfig.apiBaseUrl}/payments/assignments/${id}/pay`, {
        method: "POST",
        headers,
        body: JSON.stringify({ paymentMethod: "UPI" }),
      });
      const initData = await initRes.json();
      if (!initRes.ok || !initData.success) {
        throw new Error(initData.error?.message || "Failed to initiate online payment.");
      }

      const paymentId = initData.data.payment.id;

      // 2. Direct Confirm in Sandbox Mode
      const confRes = await fetch(`${webConfig.apiBaseUrl}/payments/${paymentId}/confirm`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          transactionRef: `tx_sbx_${Date.now()}`,
          paymentMethod: "UPI",
        }),
      });
      const confData = await confRes.json();
      if (!confRes.ok || !confData.success) {
        throw new Error(confData.error?.message || "Online confirmation failed.");
      }

      await fetchAssignment();
      setIsReceiptModalOpen(true);
    } catch (err: any) {
      setPayError(err.message || "Payment processing failed");
    } finally {
      setOnlinePaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 w-full bg-[#FAFAF9] py-20 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading assignment...</p>
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
              {errorMessage || "Please sign in to your NEARVIA employer account to access this shift record."}
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

    return (
      <div className="flex-1 w-full bg-[#FAFAF9] py-20">
        <div className="max-w-md mx-auto p-8 rounded-3xl bg-white border border-slate-200 shadow-card text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-slate-900 font-display">Assignment Not Found</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {errorMessage || "The requested shift record does not exist or you do not have permission to view it."}
          </p>
          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              onClick={fetchAssignment}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
            <Link
              to="/provider/dashboard"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const scheduleStr = formatScheduleRange(
    assignment.startTime,
    assignment.endTime,
    assignment.workDate
  );

  const isPaymentConfirmed = assignment.paymentStatus === "CONFIRMED";

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Header Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
          <div>
            <Link
              to="/provider/dashboard"
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
                    {assignment.opportunityTitle || "Shift Management"}
                  </h1>
                  {assignment.jobPinVerifiedAt && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center space-x-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Arrival PIN Verified</span>
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                  Worker: <strong className="text-slate-800">{assignment.workerFullName}</strong> • Schedule: <strong className="text-slate-800">{scheduleStr}</strong> • Agreed Wage: <strong className="text-emerald-600">{formatCurrencyINR(assignment.agreedWage)}</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setIsReportOpen(true)}
                  className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs"
                >
                  <AlertTriangle className="w-4 h-4 text-slate-500" />
                  <span>Report Issue</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsChatOpen(true)}
                  className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center space-x-2 shadow-xs"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Message Worker</span>
                </button>

                {assignment.workerContactPhone && (
                  <a
                    href={`tel:${assignment.workerContactPhone}`}
                    className="px-4 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition-all flex items-center space-x-2 shadow-xs"
                  >
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <span>Call Worker</span>
                  </a>
                )}
              </div>
            </div>
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

        {/* PIN Management Box */}
        {assignment.jobPin && (
          <div className="p-6 sm:p-7 rounded-3xl bg-linear-to-br from-orange-50/80 to-amber-50/60 border border-orange-200/90 shadow-card space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 font-display">
                    4-Digit On-Site Arrival PIN
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    Share this PIN with {assignment.workerFullName} when they physically arrive at the location.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/90 border border-orange-200 shadow-xs">
              <div className="flex items-center space-x-3">
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-slate-900">
                  {assignment.jobPin}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPin}
                  className="px-3 py-1.5 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-950 text-xs font-bold transition-colors flex items-center space-x-1"
                >
                  {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPin ? "Copied!" : "Copy PIN"}</span>
                </button>
              </div>

              <div className="text-xs font-medium text-slate-500">
                {assignment.jobPinVerifiedAt ? (
                  <span className="text-emerald-700 font-bold flex items-center space-x-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Verified by worker at {new Date(assignment.jobPinVerifiedAt).toLocaleTimeString()}</span>
                  </span>
                ) : (
                  <span className="text-amber-700 font-bold flex items-center space-x-1">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Awaiting worker verification upon arrival</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Shift Attendance & Payment Actions */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
              <ShieldCheck className="w-4 h-4 text-orange-600" />
              <span>Shift Settlement & Verification</span>
            </h2>
            <span className="font-black text-emerald-600 text-base font-display">
              {formatCurrencyINR(assignment.agreedWage)}
            </span>
          </div>

          {/* Photo Evidence Section */}
          <div className="pt-2">
            <JobEvidenceGallery assignmentId={assignment.id} />
          </div>

          {/* Active Work State */}
          {(assignment.status === AssignmentStatus.IN_PROGRESS || assignment.status === AssignmentStatus.CHECKED_IN) && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center space-x-3">
                <Clock className="w-5 h-5 text-amber-600 animate-spin shrink-0" />
                <span>Worker is currently active on site. You can confirm sign-off once work is completed.</span>
              </div>

              <button
                onClick={handleConfirmCompletion}
                disabled={actionLoading}
                className="w-full py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition-all shadow-md shadow-orange-600/20 disabled:opacity-50"
              >
                {actionLoading ? "Confirming..." : "✓ Confirm Work Completion & Authorize Payment"}
              </button>
            </div>
          )}

          {/* Completed Work State -> Post-Work Payment Flow */}
          {assignment.status === AssignmentStatus.COMPLETED && (
            <div className="space-y-6 pt-4 border-t border-slate-100">
              {payError && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              {isPaymentConfirmed ? (
                // 1. Payment Confirmed Banner & Receipt Button
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="text-sm font-black">Shift Completed & Payment Settled!</h4>
                      <p className="text-xs text-emerald-700">
                        Total Settled: <strong className="text-emerald-900 font-extrabold">{formatCurrencyINR(assignment.finalWagePaid || assignment.agreedWage)}</strong> via {assignment.paymentMethod || "Direct"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsReceiptModalOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs"
                  >
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>View Digital Receipt</span>
                  </button>
                </div>
              ) : (
                // 2. Payment Pending -> Choose Cash (PIN) or Online Payment
                <div className="p-6 rounded-3xl bg-linear-to-br from-slate-900 to-slate-800 text-white space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                        Payment Eligible
                      </span>
                      <h3 className="text-base font-extrabold text-white">
                        Settle Shift Wage: {formatCurrencyINR(assignment.agreedWage)}
                      </h3>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
                      Awaiting Settlement
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Please choose how you would like to pay {assignment.workerFullName}:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => setIsCashModalOpen(true)}
                      className="p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all flex items-center justify-center space-x-2 shadow-md"
                    >
                      <Banknote className="w-5 h-5" />
                      <span>💵 Pay with Cash (Generate PIN)</span>
                    </button>

                    <button
                      onClick={handlePayOnlineDirect}
                      disabled={onlinePaying}
                      className="p-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition-all flex items-center justify-center space-x-2 shadow-md disabled:opacity-50"
                    >
                      <CreditCard className="w-5 h-5 text-amber-300" />
                      <span>{onlinePaying ? "Processing Gateway..." : "💳 Pay Online (Instant UPI)"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Review Form */}
              <div className="pt-2">
                <ReviewForm assignmentId={assignment.id} />
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        <MessageModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          workOpportunityId={assignment.workOpportunityId}
          opportunityTitle={assignment.opportunityTitle}
          counterpartyName={assignment.workerFullName}
        />

        <ReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          targetType="ASSIGNMENT"
          targetId={assignment.id}
          targetTitle={`Worker: ${assignment.workerFullName}`}
        />

        {/* Phase 7 Cash Payment Modal */}
        <CashPaymentModal
          isOpen={isCashModalOpen}
          onClose={() => setIsCashModalOpen(false)}
          assignmentId={assignment.id}
          agreedWage={assignment.agreedWage}
          workerName={assignment.workerFullName}
          opportunityTitle={assignment.opportunityTitle}
          userRole="PROVIDER"
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
      </div>
    </div>
  );
};
