import React, { useState } from "react";
import {
  X,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
  Zap,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { formatCurrencyINR, playPaymentSuccessChime, playMechanicalTick } from "../../utils";

interface RazorpaySandboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string;
  agreedWage: number;
  workerName: string;
  opportunityTitle: string;
  onSuccess: (paymentId?: string) => void;
}

export const RazorpaySandboxModal: React.FC<RazorpaySandboxModalProps> = ({
  isOpen,
  onClose,
  assignmentId,
  agreedWage,
  workerName,
  opportunityTitle,
  onSuccess,
}) => {
  const [step, setStep] = useState<"INIT" | "READY" | "PROCESSING" | "SUCCESS" | "FAILED">("INIT");
  const [selectedMethod, setSelectedMethod] = useState<"UPI" | "CARD" | "NETBANKING">("UPI");
  const [orderData, setOrderData] = useState<{
    paymentId: string;
    orderId?: string;
    amountPaise: number;
    keyId?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    playMechanicalTick(0.1);
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
    onClose();
  };

  // Step 1: Create server-authoritative Razorpay order
  const handleCreateOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      playMechanicalTick(0.1);

      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`/api/v1/payments/assignments/${assignmentId}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ paymentMethod: selectedMethod }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to create sandbox payment order.");
      }

      const payment = data.data.payment;
      const razorpayOrder = data.data.razorpayOrder;

      setOrderData({
        paymentId: payment.id,
        orderId: razorpayOrder?.id || `order_sbx_${payment.id.slice(0, 8)}`,
        amountPaise: Math.round(agreedWage * 100),
        keyId: data.data.keyId,
      });

      setStep("READY");
    } catch (err: any) {
      setError(err.message || "Failed to initialize payment.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Simulate Successful Payment in Sandbox
  const handleSimulateSuccess = async () => {
    if (!orderData) return;
    try {
      setLoading(true);
      setError(null);
      setStep("PROCESSING");
      playMechanicalTick(0.1);

      const token = localStorage.getItem("nearvia_auth_token");
      const mockPaymentId = `pay_sbx_${Date.now()}`;

      const res = await fetch(`/api/v1/payments/${orderData.paymentId}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          transactionRef: mockPaymentId,
          paymentMethod: selectedMethod,
          razorpayPaymentId: mockPaymentId,
          razorpayOrderId: orderData.orderId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Online confirmation failed.");
      }

      playPaymentSuccessChime(0.15);
      setStep("SUCCESS");
      setTimeout(() => {
        onSuccess(orderData.paymentId);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Confirmation failed");
      setStep("READY");
    } finally {
      setLoading(false);
    }
  };

  // Step 2b: Simulate Failure
  const handleSimulateFailure = () => {
    playMechanicalTick(0.1);
    setError("Payment simulation declined by user or test bank. Job remains in Settlement Pending state.");
    setStep("FAILED");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md rounded-3xl bg-white text-slate-900 shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shadow-sm">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-black text-slate-900 font-display-title">Razorpay Sandbox</h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider">
                  TEST
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Demo Payment Simulation</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors btn-tactile active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7 space-y-5">
          {/* Prominent Sandbox Notice Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 flex items-start space-x-2.5 text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">Test Sandbox Environment</span>
              <p className="text-slate-600 font-normal leading-relaxed">
                This is a simulation for testing. <strong>No real money will be charged</strong> or transferred from any bank account or UPI ID.
              </p>
            </div>
          </div>

          {/* Job & Amount Info */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3 text-xs">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">
                  Recipient Worker
                </span>
                <span className="font-bold text-slate-900 text-sm">{workerName}</span>
                <span className="text-slate-500 block text-[11px] truncate max-w-[200px]">{opportunityTitle}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">
                  Agreed Wage
                </span>
                <span className="font-black text-indigo-600 text-lg font-display">
                  {formatCurrencyINR(agreedWage)}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block">
                  ({Math.round(agreedWage * 100)} paise)
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          {step === "INIT" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Select Simulated Method:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["UPI", "CARD", "NETBANKING"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => {
                        playMechanicalTick(0.05);
                        setSelectedMethod(method);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-bold border text-center transition-all ${
                        selectedMethod === method
                          ? "border-indigo-600 bg-indigo-50/60 text-indigo-700 shadow-xs"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={loading}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 btn-tactile active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating Gateway Order...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>Generate Sandbox Order</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {step === "READY" && orderData && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Order ID:</span>
                  <span className="font-bold text-slate-800">{orderData.orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Method:</span>
                  <span className="font-bold text-slate-800">{selectedMethod} (Sandbox)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-bold text-amber-600">Awaiting Auth</span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSimulateSuccess}
                  disabled={loading}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 btn-tactile active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Simulate Payment Success (200 OK)</span>
                </button>

                <button
                  type="button"
                  onClick={handleSimulateFailure}
                  disabled={loading}
                  className="w-full py-2.5 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center justify-center space-x-2 btn-tactile active:scale-95"
                >
                  <span>Simulate Payment Failure / Abort</span>
                </button>
              </div>
            </div>
          )}

          {step === "PROCESSING" && (
            <div className="p-8 text-center space-y-3 animate-fadeIn">
              <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-700">Verifying sandbox authorization...</p>
              <p className="text-[11px] text-slate-400">Recording settlement on ledger</p>
            </div>
          )}

          {step === "SUCCESS" && (
            <div className="p-6 text-center space-y-2 animate-fadeIn">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-900">Payment Confirmed!</h4>
              <p className="text-xs text-slate-500">Generating verified payment receipt...</p>
            </div>
          )}

          {step === "FAILED" && (
            <div className="space-y-3 animate-fadeIn">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep("INIT");
                }}
                className="w-full py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
