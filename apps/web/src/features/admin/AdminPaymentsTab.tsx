import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Scale,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

export const AdminPaymentsTab: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Operational Reconciliation State (Section 16)
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileReport, setReconcileReport] = useState<any | null>(null);
  const [showIssuesList, setShowIssuesList] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("nearvia_auth_token");
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (search.trim()) params.append("search", search.trim());
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`/api/v1/admin/payments?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPayments(data.payments || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load payments:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  const handleRunReconciliation = async () => {
    try {
      setReconcileLoading(true);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch("/api/v1/payments/reconcile", {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setReconcileReport(json.data);
        setShowIssuesList(true);
      }
    } catch (err) {
      console.error("Reconciliation failed:", err);
    } finally {
      setReconcileLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return (
    <div className="space-y-6">
      {/* Operational Payment Reconciliation Engine (Section 16) */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 font-display">
                Operational Payment Reconciliation Engine
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Automated consistency audit: compares assignments, cash confirmation PINs, and gateway states.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunReconciliation}
            disabled={reconcileLoading}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reconcileLoading ? "animate-spin" : ""}`} />
            <span>{reconcileLoading ? "Auditing Records..." : "Run Reconciliation Audit"}</span>
          </button>
        </div>

        {/* Reconciliation Report Summary */}
        {reconcileReport && (
          <div className="space-y-3 pt-2 animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Records Checked</span>
                <span className="text-lg font-black text-slate-900 font-mono">{reconcileReport.totalChecked}</span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Matched & Settled</span>
                <span className="text-lg font-black text-emerald-700 font-mono">{reconcileReport.matchedCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-center">
                <span className="text-[10px] font-bold text-rose-700 uppercase block">Discrepancies</span>
                <span className="text-lg font-black text-rose-700 font-mono">{reconcileReport.discrepanciesCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                <span className="text-[10px] font-bold text-amber-700 uppercase block">Unconfirmed Cash &gt;24h</span>
                <span className="text-lg font-black text-amber-700 font-mono">{reconcileReport.unreconciledCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-center">
                <span className="text-[10px] font-bold text-purple-700 uppercase block">Active Disputes</span>
                <span className="text-lg font-black text-purple-700 font-mono">{reconcileReport.disputedCount}</span>
              </div>
            </div>

            {reconcileReport.issues && reconcileReport.issues.length > 0 && showIssuesList && (
              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Detected Inconsistencies ({reconcileReport.issues.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowIssuesList(false)}
                    className="text-[11px] text-rose-700 hover:underline font-bold"
                  >
                    Hide
                  </button>
                </div>
                <div className="space-y-2">
                  {reconcileReport.issues.map((iss: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-white border border-rose-200/80 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span className="text-rose-700 font-mono">{iss.issueType}</span>
                        <span className="text-[10px] text-slate-400">Assignment: {iss.assignmentId.substring(0, 8)}...</span>
                      </div>
                      <p className="text-slate-600 text-[11px]">{iss.description}</p>
                      <p className="text-slate-900 text-[11px] font-semibold">Action: {iss.actionRequired}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reconcileReport.discrepanciesCount === 0 && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>All assignments and settlement records match perfectly. Zero discrepancies detected.</span>
              </div>
            )}
          </div>
        )}

        {/* Regulatory Disclaimer Banner */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            <strong>Regulatory Safeguard:</strong> Cash payment records represent verified settlements confirmed directly between provider and worker. NEARVIA does not hold or escrow physical cash.
          </span>
        </div>
      </div>
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by transaction reference or gateway order ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:border-orange-500 shadow-xs"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:border-orange-500 shadow-xs"
        >
          <option value="">All Payment Statuses</option>
          <option value="CONFIRMED">Settled / Confirmed</option>
          <option value="PENDING">Pending Settlement</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>
      </div>

      {/* Payments Table */}
      <div className="overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-5">Opportunity</th>
                <th className="py-3.5 px-5">Payer / Employer</th>
                <th className="py-3.5 px-5">Payee / Worker</th>
                <th className="py-3.5 px-5">Amount</th>
                <th className="py-3.5 px-5">Method & Ref</th>
                <th className="py-3.5 px-5">Date</th>
                <th className="py-3.5 px-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    Loading payment logs...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    No payment records found.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900">{p.opportunityTitle}</div>
                      <div className="font-mono text-[10px] text-slate-400 font-medium">{p.assignmentId?.substring(0, 8)}...</div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-800 font-medium">{p.payerName}</td>
                    <td className="py-3.5 px-5 text-slate-800 font-semibold">{p.payeeName}</td>
                    <td className="py-3.5 px-5 font-bold text-emerald-600">
                      ₹{p.amount}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-800">{p.paymentMethod}</div>
                      <div className="font-mono text-[10px] text-slate-400">{p.transactionRef || p.gatewayOrderId || "Internal Ledger"}</div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 text-[11px] font-medium">
                      {new Date(p.createdAt).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          p.status === "CONFIRMED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : p.status === "PENDING"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-2">
        <div>
          Showing {payments.length} of {total} transactions
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="p-2 rounded-xl bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50 text-slate-700 shadow-xs transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-slate-700">Page {page} of {Math.max(1, Math.ceil(total / 15))}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 15) || loading}
            className="p-2 rounded-xl bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50 text-slate-700 shadow-xs transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
