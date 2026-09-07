import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  IndianRupee,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Receipt,
  Calendar,
} from "lucide-react";
import { formatCurrencyINR } from "../../utils";

interface EarningsSummary {
  todayEarnings: number;
  todayEarningsPaise: number;
  weekEarnings: number;
  weekEarningsPaise: number;
  monthEarnings: number;
  monthEarningsPaise: number;
  totalEarned: number;
  totalEarnedPaise: number;
  pendingSettlement: number;
  pendingSettlementPaise: number;
  completedPaymentsCount: number;
  pendingPaymentsCount: number;
}

export const WorkerEarningsPage: React.FC = () => {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEarnings() {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem("nearvia_auth_token");
        const res = await fetch("/api/v1/payments/worker/earnings", {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || "Failed to load earnings summary");
        }
        setSummary(data.data);
      } catch (err: any) {
        setError(err.message || "Failed to load earnings");
      } finally {
        setLoading(false);
      }
    }

    fetchEarnings();
  }, []);

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Bar */}
        <div>
          <Link
            to="/worker/dashboard"
            className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-emerald-700 transition gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {/* Header Banner with Emerald Ambient Lighting */}
        <div className="p-6 sm:p-8 rounded-3xl card-premium flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

          <div className="space-y-1 relative z-10">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Worker Earnings & Payouts</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display-title">
              My Earnings Summary
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
              Track verified wage settlements, cash handovers, and pending payments for your completed hyperlocal work.
            </p>
          </div>

          <Link
            to="/worker/transactions"
            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition flex items-center space-x-1.5 shadow-md btn-tactile active:scale-95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]"
          >
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span>View All Transactions</span>
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium text-sm">Loading your earnings...</div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-center text-xs space-y-2">
            <AlertCircle className="w-6 h-6 mx-auto text-red-500" />
            <p className="font-bold">{error}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Main Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Total Earned */}
              <div className="p-6 rounded-3xl card-premium space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider font-caption-refined">
                  <span>Total Settled (All-Time)</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl sm:text-4xl font-black text-emerald-600 font-display-title">
                    {formatCurrencyINR(summary?.totalEarned || 0)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {summary?.completedPaymentsCount || 0} verified shift settlements
                </p>
              </div>

              {/* Today's Earnings */}
              <div className="p-6 rounded-3xl card-premium space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider font-caption-refined">
                  <span>Today's Earnings</span>
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 font-display-title">
                    {formatCurrencyINR(summary?.todayEarnings || 0)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Earnings confirmed today
                </p>
              </div>

              {/* Pending Settlement */}
              <div className="p-6 rounded-3xl card-premium space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider font-caption-refined">
                  <span>Pending Settlement</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl sm:text-4xl font-black text-amber-600 font-display-title">
                    {formatCurrencyINR(summary?.pendingSettlement || 0)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {summary?.pendingPaymentsCount || 0} shifts awaiting confirmation
                </p>
              </div>
            </div>

            {/* Period Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl card-premium flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block font-caption-refined">
                    This Week's Confirmed Payouts
                  </span>
                  <span className="text-2xl font-black text-slate-900 font-display-title">
                    {formatCurrencyINR(summary?.weekEarnings || 0)}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-black text-xs">
                  7D
                </div>
              </div>

              <div className="p-5 rounded-2xl card-premium flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block font-caption-refined">
                    This Month's Confirmed Payouts
                  </span>
                  <span className="text-2xl font-black text-slate-900 font-display-title">
                    {formatCurrencyINR(summary?.monthEarnings || 0)}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-black text-xs">
                  30D
                </div>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Link
                to="/worker/transactions"
                className="p-6 rounded-2xl card-premium hover:border-emerald-300 transition-all group flex items-center justify-between btn-tactile active:scale-95"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)]">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">Transaction Ledger</h3>
                    <p className="text-xs text-slate-500">View date-wise payment history and digital receipts.</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </Link>

              <Link
                to="/worker/assignments"
                className="p-6 rounded-2xl card-premium hover:border-blue-300 transition-all group flex items-center justify-between btn-tactile active:scale-95"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)]">
                    <IndianRupee className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">Completed Work</h3>
                    <p className="text-xs text-slate-500">Check completed shifts and wage status.</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </Link>
            </div>

            {/* Security & Financial Policy */}
            <div className="p-6 rounded-2xl card-premium bg-emerald-50/20 border border-emerald-200/60">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-950 mb-2 flex items-center gap-1.5 font-caption-refined">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                NEARVIA Wage Settlement Standard
              </h3>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside font-medium">
                <li>Payments are credited upon completion verification by the employer.</li>
                <li>For cash payments, verify your 4-digit Payment PIN to confirm physical cash receipt.</li>
                <li>Money is counted as "Settled" only when successfully confirmed on the ledger.</li>
                <li>Community agents cannot alter, redirect, or hold your wages.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
