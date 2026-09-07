import React, { useState, useEffect, useCallback } from "react";
import { Flag, ChevronLeft, ChevronRight, X } from "lucide-react";

export const AdminReportsTab: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("OPEN");

  // Moderation Resolution Modal
  const [activeReport, setActiveReport] = useState<any | null>(null);
  const [nextStatus, setNextStatus] = useState<"RESOLVED" | "DISMISSED">("RESOLVED");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("nearvia_auth_token");
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`/api/v1/reports/admin/all?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReports(data.data.reports || []);
        setTotal(data.data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleUpdateStatus = async () => {
    if (!activeReport || !resolutionNotes.trim()) return;
    try {
      setActionLoading(true);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`/api/v1/reports/admin/${activeReport.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          status: nextStatus,
          resolution: resolutionNotes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActiveReport(null);
        setResolutionNotes("");
        fetchReports();
      } else {
        alert(data.error?.message || "Failed to update report status");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED", ""].map((st) => (
            <button
              key={st || "ALL"}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition shadow-xs ${
                statusFilter === st
                  ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {st ? (st === "OPEN" ? "Open Incident Reports" : st === "UNDER_REVIEW" ? "Under Review" : st === "RESOLVED" ? "Resolved" : "Dismissed") : "All Reports"}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Table */}
      <div className="overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-5">Reporter</th>
                <th className="py-3.5 px-5">Category</th>
                <th className="py-3.5 px-5">Target Type</th>
                <th className="py-3.5 px-5">Reason / Notes</th>
                <th className="py-3.5 px-5">Filed</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Moderation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    Loading incident reports...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    No incident reports found for this status filter.
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900">{r.reporter_name || "Anonymous Reporter"}</div>
                      <div className="font-mono text-[10px] text-slate-400 font-medium">{r.reporter_id?.substring(0, 8)}...</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                        {r.category || "GENERAL"}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                        {r.target_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 max-w-xs">
                      <div className="font-semibold text-slate-900">{r.reason}</div>
                      {r.description && <div className="text-[11px] text-slate-500 truncate font-medium">{r.description}</div>}
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 text-[11px] font-medium">
                      {new Date(r.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          r.status === "OPEN"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : r.status === "RESOLVED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => {
                          setActiveReport(r);
                          setNextStatus("RESOLVED");
                          setResolutionNotes(r.resolution || "");
                        }}
                        className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-bold transition shadow-xs"
                      >
                        Moderate
                      </button>
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
          Showing {reports.length} of {total} incident reports
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

      {/* Resolution Modal */}
      {activeReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 font-display flex items-center gap-2">
                <Flag className="w-5 h-5 text-rose-600" />
                <span>Resolve Incident Report</span>
              </h3>
              <button onClick={() => setActiveReport(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <div className="text-slate-500 font-medium"><strong className="text-slate-900 font-bold">Category:</strong> {activeReport.category}</div>
              <div className="text-slate-500 font-medium"><strong className="text-slate-900 font-bold">Target Type:</strong> {activeReport.target_type}</div>
              <div className="text-slate-500 font-medium"><strong className="text-slate-900 font-bold">Reason:</strong> {activeReport.reason}</div>
              <div className="text-slate-500 font-medium"><strong className="text-slate-900 font-bold">Description:</strong> {activeReport.description || "None"}</div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[10px]">Moderation Outcome</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNextStatus("RESOLVED")}
                  className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition shadow-xs ${
                    nextStatus === "RESOLVED"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Resolve & Take Action
                </button>
                <button
                  type="button"
                  onClick={() => setNextStatus("DISMISSED")}
                  className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition shadow-xs ${
                    nextStatus === "DISMISSED"
                      ? "bg-slate-800 text-white shadow-md"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Dismiss Report
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[10px]">Investigation / Action Notes</label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Detail the investigation findings or disciplinary actions taken..."
                rows={3}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white transition shadow-xs"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setActiveReport(null)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatus}
                disabled={actionLoading || !resolutionNotes.trim()}
                className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-xs font-black text-white disabled:opacity-50 shadow-md shadow-rose-600/20 transition"
              >
                {actionLoading ? "Saving..." : "Submit Moderation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
