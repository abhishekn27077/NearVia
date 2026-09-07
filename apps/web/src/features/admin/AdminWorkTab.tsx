import React, { useState, useEffect, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

export const AdminWorkTab: React.FC = () => {
  const [workList, setWorkList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [workTypeFilter, setWorkTypeFilter] = useState("");

  // Cancel Moderation Modal
  const [modWorkId, setModWorkId] = useState<string | null>(null);
  const [modReason, setModReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchWork = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("nearvia_auth_token");
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (search.trim()) params.append("search", search.trim());
      if (statusFilter) params.append("status", statusFilter);
      if (workTypeFilter) params.append("workType", workTypeFilter);

      const res = await fetch(`/api/v1/admin/work?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWorkList(data.work || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load work opportunities:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, workTypeFilter]);

  useEffect(() => {
    fetchWork();
  }, [fetchWork]);

  const handleCancelWork = async () => {
    if (!modWorkId || !modReason.trim()) return;
    try {
      setActionLoading(true);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`/api/v1/admin/work/${modWorkId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ reason: modReason }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setModWorkId(null);
        setModReason("");
        fetchWork();
      } else {
        alert(data.error?.message || "Failed to cancel work");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by work title or description..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:border-orange-500 shadow-xs"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={workTypeFilter}
            onChange={(e) => {
              setWorkTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:border-orange-500 shadow-xs"
          >
            <option value="">All Types</option>
            <option value="TASK">Task (1–3h)</option>
            <option value="SHIFT">Shift (4–8h)</option>
            <option value="JOB">Job (Multi-Day)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:border-orange-500 shadow-xs"
          >
            <option value="">All Statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
      </div>

      {/* Work Table */}
      <div className="overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-5">Opportunity</th>
                <th className="py-3.5 px-5">Provider</th>
                <th className="py-3.5 px-5">Type</th>
                <th className="py-3.5 px-5">Compensation</th>
                <th className="py-3.5 px-5">Applications</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    Loading work postings...
                  </td>
                </tr>
              ) : workList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    No work opportunities found.
                  </td>
                </tr>
              ) : (
                workList.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900">{w.title}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{w.category_name}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="text-slate-800 font-semibold">{w.provider_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{w.provider_phone}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                        {w.work_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-bold text-emerald-600">
                      ₹{w.payment_amount}
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 font-medium">
                      {w.applications_count} applied
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          w.status === "PUBLISHED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : w.status === "COMPLETED"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {w.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      {w.status === "PUBLISHED" && (
                        <button
                          onClick={() => setModWorkId(w.id)}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition shadow-xs"
                        >
                          Moderate
                        </button>
                      )}
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
          Showing {workList.length} of {total} postings
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

      {/* Moderation Cancel Modal */}
      {modWorkId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center space-x-2.5 text-rose-600">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-900 font-display">Moderate & Cancel Work Posting</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              This action cancels the job opportunity, immediately removes it from public 5 KM discovery, and records an immutable audit trail.
            </p>
            <textarea
              value={modReason}
              onChange={(e) => setModReason(e.target.value)}
              placeholder="Provide explicit moderation violation reason..."
              rows={3}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white transition shadow-xs"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setModWorkId(null)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
              >
                Dismiss
              </button>
              <button
                onClick={handleCancelWork}
                disabled={actionLoading || !modReason.trim()}
                className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-xs font-black text-white disabled:opacity-50 shadow-md shadow-rose-600/20 transition"
              >
                {actionLoading ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
