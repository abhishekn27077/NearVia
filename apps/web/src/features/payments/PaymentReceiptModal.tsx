import React, { useEffect, useState } from "react";
import {
  X,
  Receipt,
  CheckCircle2,
  Printer,
  ShieldCheck,
  AlertCircle,
  Building,
  User,
  Calendar,
  CreditCard,
  Banknote,
} from "lucide-react";
import { PaymentReceipt } from "@nearvia/types";
import { formatCurrencyINR, playPaymentSuccessChime, playMechanicalTick } from "../../utils";

interface PaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId?: string;
  paymentId?: string;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  assignmentId,
  paymentId,
}) => {
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchReceipt() {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem("nearvia_auth_token");
        const url = paymentId
          ? `/api/v1/payments/${paymentId}/receipt`
          : `/api/v1/payments/assignments/${assignmentId}/receipt`;

        const res = await fetch(url, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || "Failed to load payment receipt");
        }
        setReceipt(data.data);
        playPaymentSuccessChime(0.12);
      } catch (err: any) {
        setError(err.message || "Failed to fetch receipt");
      } finally {
        setLoading(false);
      }
    }

    fetchReceipt();
  }, [isOpen, assignmentId, paymentId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    playMechanicalTick(0.1);
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([15, 30, 15]);
    }
    window.print();
  };

  const handleClose = () => {
    playMechanicalTick(0.1);
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
    onClose();
  };

  const isCash = (receipt?.paymentMethod || "").toUpperCase() === "CASH";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-3xl bg-white text-slate-900 shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 font-display-title">Official Payment Receipt</h3>
              <p className="text-xs text-slate-500 font-mono font-medium">
                {receipt?.receiptNumber || "Generating receipt..."}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors btn-tactile active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm font-medium">
              Generating verified digital receipt...
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-center text-xs space-y-2">
              <AlertCircle className="w-6 h-6 mx-auto text-red-500" />
              <p className="font-bold">{error}</p>
            </div>
          ) : receipt ? (
            <div className="space-y-6 receipt-feed-anim">
              {/* Receipt Status Badge */}
              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex items-center justify-between shadow-xs">
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-black text-emerald-900 uppercase tracking-wider font-caption-refined">
                    Payment Verified & Confirmed
                  </span>
                </div>
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-white text-emerald-800 text-xs font-bold border border-emerald-200 shadow-xs">
                  {isCash ? <Banknote className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <CreditCard className="w-3.5 h-3.5 mr-1 text-emerald-600" />}
                  {receipt.paymentMethod}
                </span>
              </div>

              {/* Parties Info Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px] mb-1">
                    Employer (Payer)
                  </span>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>{receipt.payerBusinessName || receipt.payerName}</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px] mb-1">
                    Worker (Payee)
                  </span>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{receipt.payeeName}</span>
                  </div>
                </div>
              </div>

              {/* Opportunity Summary */}
              <div className="space-y-2 text-xs">
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  Work Details
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1">
                  <div className="font-black text-slate-900 text-sm">{receipt.opportunityTitle}</div>
                  <div className="flex items-center space-x-3 text-slate-500 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(receipt.workDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span>•</span>
                    <span className="uppercase font-bold text-slate-600">{receipt.workType}</span>
                  </div>
                </div>
              </div>

              {/* Financial Breakdown Table */}
              <div className="space-y-2">
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  Financial Settlement Breakdown
                </div>
                <div className="rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 text-xs">
                  <div className="p-3.5 flex justify-between items-center bg-slate-50/50">
                    <span className="text-slate-600 font-medium">Agreed Gross Wage</span>
                    <span className="font-bold text-slate-900">{formatCurrencyINR(receipt.amount)}</span>
                  </div>
                  <div className="p-3.5 flex justify-between items-center bg-slate-50/50">
                    <span className="text-slate-600 font-medium">Platform Fee</span>
                    <span className="font-bold text-emerald-600">
                      {receipt.platformFee > 0 ? formatCurrencyINR(receipt.platformFee) : "₹0.00 (Zero Commission)"}
                    </span>
                  </div>
                  <div className="p-4 flex justify-between items-center bg-slate-900 text-white font-black">
                    <span className="text-xs uppercase tracking-wider">Total Net Worker Payout</span>
                    <span className="text-base font-display text-emerald-400">{formatCurrencyINR(receipt.netPayout)}</span>
                  </div>
                </div>
              </div>

              {/* Audit & Transaction Metadata */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] font-mono text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Txn Ref:</span>
                  <span className="text-slate-800 font-bold">{receipt.transactionRef}</span>
                </div>
                <div className="flex justify-between">
                  <span>Settled At:</span>
                  <span className="text-slate-800">
                    {new Date(receipt.recordedAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {/* Legal Custody & Policy Disclaimer */}
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1 text-amber-950">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                  Marketplace Settlement Notice
                </div>
                <p className="text-slate-700 font-normal">
                  {receipt.disclaimer}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Physical Paper Serrated Tear Edge */}
        <div className="receipt-sawtooth shrink-0 -mt-3" />

        {/* Modal Footer Actions */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={handlePrint}
            disabled={!receipt}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center space-x-2 shadow-xs disabled:opacity-50 btn-tactile active:scale-95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)]"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Receipt</span>
          </button>
          <button
            onClick={handleClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-sm btn-tactile active:scale-95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
