import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CreditCard,
  Banknote,
  CheckCircle2,
  Clock,
  FileText,
  AlertCircle,
  User,
  Calendar,
} from "lucide-react";
import { formatCurrencyINR } from "../../utils";
import { PaymentReceiptModal } from "./PaymentReceiptModal";
import { CashPaymentModal } from "./CashPaymentModal";

interface ProviderSummary {
  totalPaid: number;
  pendingPayable: number;
  completedCount: number;
  pendingPayableCount: number;
}

interface PayableAssignment {
  assignmentId: string;
  workOpportunityId: string;
  title: string;
  workType: string;
  workDate: string;
  workerId: string;
  workerUserId: string;
  workerName: string;
  workerPhone: string;
  agreedWage: number;
  completedAt: string;
  paymentStatus: string;
}

interface PaymentHistoryItem {
  id: string;
  assignmentId: string;
  payerId: string;
  payeeId: string;
  payeeName?: string;
  opportunityTitle?: string;
  workType?: string;
  workDate?: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  transactionRef: string | null;
  recordedAt: string;
}

export const ProviderPaymentsPage: React.FC = () => {
  const [summary, setSummary] = useState<ProviderSummary | null>(null);
  const [payableList, setPayableList] = useState<PayableAssignment[]>([]);
  const [historyList, setHistoryList] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [cashModalAssignment, setCashModalAssignment] = useState<PayableAssignment | null>(null);
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);

  // Online payment state
  const [onlinePayingId, setOnlinePayingId] = useState<string | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  // History filters
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("");
  const [historyMethodFilter, setHistoryMethodFilter] = useState<string>("");

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("nearvia_auth_token");
      const headers = { Authorization: token ? `Bearer ${token}` : "" };

      const params = new URLSearchParams();
      if (historyStatusFilter) params.append("status", historyStatusFilter);
      if (historyMethodFilter) params.append("paymentMethod", historyMethodFilter);

      const [sumRes, payRes, histRes] = await Promise.all([
        fetch("/api/v1/payments/provider/summary", { headers }),
        fetch("/api/v1/payments/provider/payable", { headers }),
        fetch(`/api/v1/payments/provider/history?${params.toString()}`, { headers }),
      ]);

      if (sumRes.ok) {
        const sumJson = await sumRes.json();
        if (sumJson.success) setSummary(sumJson.data);
      }
      if (payRes.ok) {
        const payJson = await payRes.json();
        if (payJson.success) setPayableList(payJson.data || []);
      }
      if (histRes.ok) {
        const histJson = await histRes.json();
        if (histJson.success) setHistoryList(histJson.data.payments || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [historyStatusFilter, historyMethodFilter]);

  // Direct online pay handler (Sandbox / Demo mode)
  const handlePayOnline = async (item: PayableAssignment) => {
    try {
      setOnlinePayingId(item.assignmentId);
      setOnlineError(null);
      const token = localStorage.getItem("nearvia_auth_token");

      // 1. Initiate online order
      const initRes = await fetch(`/api/v1/payments/assignments/${item.assignmentId}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ paymentMethod: "UPI" }),
      });
      const initData = await initRes.json();
      if (!initRes.ok || !initData.success) {
        throw new Error(initData.error?.message || "Failed to initialize payment gateway order");
      }

      const paymentId = initData.data.payment.id;

      // 2. Direct Sandbox confirmation
      const confRes = await fetch(`/api/v1/payments/${paymentId}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          transactionRef: `tx_sbx_${Date.now()}`,
          paymentMethod: "UPI",
        }),
      });
      const confData = await confRes.json();
      if (!confRes.ok || !confData.success) {
        throw new Error(confData.error?.message || "Payment confirmation failed");
      }

      await loadData();
      setReceiptPaymentId(paymentId);
    } catch (err: any) {
      setOnlineError(err.message || "Online payment processing error");
    } finally {
      setOnlinePayingId(null);
    }
  };

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card">
          <div className="space-y-1">
            <Link
              to="/provider/dashboard"
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              Employer Settlement & Payments
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
              Pay workers via verified cash handover with 4-digit PINs or instant digital gateway settlements.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-4 rounded-2xl bg-slate-900 text-white text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Settled</div>
              <div className="text-2xl font-black text-emerald-400 font-display mt-0.5">
                {formatCurrencyINR(summary?.totalPaid || 0)}
              </div>
            </div>
          </div>
        </div>

        {onlineError && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{onlineError}</span>
          </div>
        )}

        {/* Pending Settlements Section */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Awaiting Payment ({payableList.length})</span>
            </h2>
            <span className="text-xs font-bold text-slate-500">
              Completed shifts ready for wage settlement
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs font-medium text-slate-400">Loading payable work...</div>
          ) : payableList.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              🎉 All completed shifts have been fully paid and settled!
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {payableList.map((item) => (
                <div
                  key={item.assignmentId}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-sm text-slate-900">{item.title}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold uppercase">
                        {item.workType}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Worker: <strong className="text-slate-800 font-bold">{item.workerName}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Completed: {new Date(item.completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 self-end md:self-center">
                    <div className="text-right pr-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Agreed Wage</div>
                      <div className="text-lg font-black text-slate-900 font-display">
                        {formatCurrencyINR(item.agreedWage)}
                      </div>
                    </div>

                    <button
                      onClick={() => setCashModalAssignment(item)}
                      className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
                    >
                      <Banknote className="w-4 h-4" />
                      <span>💵 Pay Cash (PIN)</span>
                    </button>

                    <button
                      onClick={() => handlePayOnline(item)}
                      disabled={onlinePayingId === item.assignmentId}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                    >
                      <CreditCard className="w-4 h-4 text-orange-400" />
                      <span>{onlinePayingId === item.assignmentId ? "Processing..." : "💳 Pay Online"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History Section */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Settlement History ({historyList.length})</span>
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-1.5">
                {[
                  { label: "All Status", value: "" },
                  { label: "Confirmed", value: "CONFIRMED" },
                  { label: "Pending", value: "PENDING" },
                ].map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setHistoryStatusFilter(s.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      historyStatusFilter === s.value
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-1.5">
                {[
                  { label: "All Methods", value: "" },
                  { label: "💵 Cash", value: "CASH" },
                  { label: "💳 Online", value: "ONLINE" },
                ].map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setHistoryMethodFilter(m.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      historyMethodFilter === m.value
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {historyList.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400 font-medium">
              No previous payment history found matching criteria.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {historyList.map((item) => {
                const isCash = (item.paymentMethod || "").toUpperCase() === "CASH";
                return (
                  <div
                    key={item.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 rounded-2xl px-3 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                        <span>{item.opportunityTitle || "Shift Settlement"}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {isCash ? <Banknote className="w-3 h-3 mr-1 text-emerald-600" /> : <CreditCard className="w-3 h-3 mr-1 text-indigo-600" />}
                          {item.paymentMethod || "Direct"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        Paid to: <strong className="text-slate-800">{item.payeeName || "Worker"}</strong> • {new Date(item.recordedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 self-end sm:self-center">
                      <div className="text-right">
                        <div className="font-black text-base text-slate-900 font-display">
                          {formatCurrencyINR(item.amount)}
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          item.status === "CONFIRMED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : item.status === "DISPUTED"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {item.status}
                        </span>
                      </div>

                      <button
                        onClick={() => setReceiptPaymentId(item.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center space-x-1"
                        title="View Official Receipt"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-600" />
                        <span>Receipt</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cash Payment Modal */}
      {cashModalAssignment && (
        <CashPaymentModal
          isOpen={Boolean(cashModalAssignment)}
          onClose={() => setCashModalAssignment(null)}
          assignmentId={cashModalAssignment.assignmentId}
          agreedWage={cashModalAssignment.agreedWage}
          workerName={cashModalAssignment.workerName}
          opportunityTitle={cashModalAssignment.title}
          userRole="PROVIDER"
          onSuccess={() => {
            loadData();
          }}
        />
      )}

      {/* Payment Receipt Modal */}
      {receiptPaymentId && (
        <PaymentReceiptModal
          isOpen={Boolean(receiptPaymentId)}
          onClose={() => setReceiptPaymentId(null)}
          paymentId={receiptPaymentId}
        />
      )}
    </div>
  );
};
