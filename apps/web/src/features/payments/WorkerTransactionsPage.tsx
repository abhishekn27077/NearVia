import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Receipt,
  Banknote,
  CreditCard,
  FileText,
} from "lucide-react";
import { formatCurrencyINR } from "../../utils";
import { PaymentReceiptModal } from "./PaymentReceiptModal";

interface TransactionItem {
  id: string;
  assignmentId: string;
  payerId: string;
  payeeId: string;
  payerName?: string;
  payerBusinessName?: string;
  opportunityTitle?: string;
  workType?: string;
  workDate?: string;
  amount: number;
  currency: string;
  status: "PENDING" | "CONFIRMED" | "FAILED" | "DISPUTED" | "REFUNDED" | string;
  paymentMethod: string | null;
  transactionRef: string | null;
  notes: string | null;
  recordedAt: string;
}

export const WorkerTransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("nearvia_auth_token");
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (methodFilter) params.append("paymentMethod", methodFilter);

      const url = `/api/v1/payments/worker/transactions?${params.toString()}`;

      const res = await fetch(url, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to load transactions");
      }
      setTransactions(data.data.transactions || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [statusFilter, methodFilter]);

  const totalEarned = transactions
    .filter((t) => t.status === "CONFIRMED")
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card">
          <div className="space-y-1">
            <Link
              to="/worker/dashboard"
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              Earnings & Settlement Ledger
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
              Track verified wage payouts, cash receipts, and pending shift settlements with official receipts.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-right shrink-0">
            <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Total Received</div>
            <div className="text-2xl font-black text-emerald-600 font-display mt-0.5">
              {formatCurrencyINR(totalEarned)}
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
            {[
              { label: "All Settlements", value: "" },
              { label: "Confirmed Paid", value: "CONFIRMED" },
              { label: "Pending", value: "PENDING" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  statusFilter === tab.value
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            {[
              { label: "All Methods", value: "" },
              { label: "💵 Cash Only", value: "CASH" },
              { label: "💳 Online Only", value: "ONLINE" },
            ].map((m) => (
              <button
                key={m.value}
                onClick={() => setMethodFilter(m.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  methodFilter === m.value
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200/70 text-slate-700 hover:bg-slate-300/70"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions List */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
          <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
            <Receipt className="w-4 h-4 text-orange-600" />
            <span>Settlement History ({transactions.length})</span>
          </h2>

          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-slate-500">
              Loading ledger...
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400 font-medium">
              No transactions recorded yet. Complete work shifts to receive settlements.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map((tx) => {
                const isCash = (tx.paymentMethod || "").toUpperCase() === "CASH";
                return (
                  <div key={tx.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 rounded-2xl px-3 transition-colors">
                    <div className="space-y-1">
                      <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                        <span>{tx.opportunityTitle || "Shift Payout"}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {isCash ? <Banknote className="w-3 h-3 mr-1 text-emerald-600" /> : <CreditCard className="w-3 h-3 mr-1 text-indigo-600" />}
                          {tx.paymentMethod || "Direct"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        From: <strong className="text-slate-800">{tx.payerBusinessName || tx.payerName || "Verified Employer"}</strong> • {new Date(tx.recordedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 self-end sm:self-center">
                      <div className="text-right">
                        <div className="font-black text-base text-emerald-600 font-display">
                          +{formatCurrencyINR(tx.amount)}
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          tx.status === "CONFIRMED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : tx.status === "DISPUTED"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {tx.status}
                        </span>
                      </div>

                      <button
                        onClick={() => setSelectedPaymentId(tx.id)}
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

      {/* Payment Receipt Modal */}
      {selectedPaymentId && (
        <PaymentReceiptModal
          isOpen={Boolean(selectedPaymentId)}
          onClose={() => setSelectedPaymentId(null)}
          paymentId={selectedPaymentId}
        />
      )}
    </div>
  );
};
