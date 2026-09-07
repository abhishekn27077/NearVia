import React, { useState } from "react";
import {
  X,
  Banknote,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Clock,
} from "lucide-react";
import { formatCurrencyINR } from "../../utils";

interface CashPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string;
  agreedWage: number;
  workerName: string;
  opportunityTitle: string;
  userRole: "PROVIDER" | "WORKER";
  onSuccess: () => void;
}

export const CashPaymentModal: React.FC<CashPaymentModalProps> = ({
  isOpen,
  onClose,
  assignmentId,
  agreedWage,
  workerName,
  opportunityTitle,
  userRole,
  onSuccess,
}) => {
  // Provider state
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [pinCopied, setPinCopied] = useState(false);

  // Worker state
  const [enteredPin, setEnteredPin] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  // Provider initiates cash payment & generates 4-digit PIN
  const handleInitiateCash = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`/api/v1/payments/assignments/${assignmentId}/cash/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ notes: `Cash handover for ${opportunityTitle}` }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to initiate cash payment");
      }
      setGeneratedPin(data.data.paymentPin);
    } catch (err: any) {
      setError(err.message || "Failed to generate payment PIN");
    } finally {
      setLoading(false);
    }
  };

  // Worker confirms cash receipt with 4-digit PIN
  const handleConfirmReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin.length < 4) {
      setError("Please enter the 4-digit Payment PIN provided by your employer.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`/api/v1/payments/assignments/${assignmentId}/cash/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ paymentPin: enteredPin.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Invalid Payment PIN");
      }
      setConfirmed(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to verify PIN");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPin = () => {
    if (!generatedPin) return;
    navigator.clipboard.writeText(generatedPin);
    setPinCopied(true);
    setTimeout(() => setPinCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md rounded-3xl bg-white text-slate-900 shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-sm">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 font-display">
                {userRole === "PROVIDER" ? "Direct Cash Settlement" : "Confirm Cash Receipt"}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Amount: <strong className="text-slate-900 font-black">{formatCurrencyINR(agreedWage)}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {confirmed ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-black text-slate-900">Cash Payment Confirmed!</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Receipt of {formatCurrencyINR(agreedWage)} has been officially recorded on the NEARVIA ledger.
              </p>
            </div>
          ) : userRole === "PROVIDER" ? (
            // PROVIDER FLOW
            !generatedPin ? (
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-2">
                  <p className="font-semibold text-slate-800">Direct Physical Cash Handover Steps:</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600">
                    <li>Generate a 4-digit Payment Verification PIN below.</li>
                    <li>Hand over <strong className="text-slate-900">{formatCurrencyINR(agreedWage)}</strong> in physical cash to {workerName}.</li>
                    <li>Share the 4-digit PIN with {workerName} to confirm receipt on their device.</li>
                  </ol>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700 inline mr-1" />
                  <strong>Notice:</strong> NEARVIA records this transaction directly between employer and worker. NEARVIA does not hold custody of physical cash.
                </div>

                <button
                  onClick={handleInitiateCash}
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {loading ? "Generating PIN..." : "💵 Generate 4-Digit Payment PIN"}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-6 rounded-3xl bg-slate-900 text-white text-center space-y-3 shadow-lg">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                    Cash Payment PIN
                  </span>
                  <div className="text-4xl font-extrabold tracking-widest text-emerald-400 font-mono py-1">
                    {generatedPin}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPin}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors"
                  >
                    {pinCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{pinCopied ? "PIN Copied!" : "Copy PIN"}</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1.5">
                  <h5 className="font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    Waiting for Worker Confirmation
                  </h5>
                  <p className="text-[11px] text-emerald-800">
                    Hand over {formatCurrencyINR(agreedWage)} cash and provide this 4-digit PIN to {workerName}. The settlement will complete automatically when they submit it.
                  </p>
                </div>
              </div>
            )
          ) : (
            // WORKER FLOW
            <form onSubmit={handleConfirmReceipt} className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-1.5">
                <p className="font-bold text-slate-800">
                  Received cash from your employer?
                </p>
                <p className="text-[11px] text-slate-500">
                  Ask your employer for the 4-digit Payment PIN to verify that you received {formatCurrencyINR(agreedWage)} in cash.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  4-Digit Payment PIN
                </label>
                <div className="relative">
                  <KeyRound className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    maxLength={4}
                    value={enteredPin}
                    onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 4821"
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-xl tracking-widest text-slate-900 font-bold focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-center"
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-slate-400 text-center">
                  Protected with rate-limiting (Max 5 attempts allowed)
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || enteredPin.length < 4}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {loading ? "Verifying PIN..." : "✓ Confirm Cash Received"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
