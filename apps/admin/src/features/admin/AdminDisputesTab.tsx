import React, { useState, useEffect, useCallback } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, X, ExternalLink } from "lucide-react";

export const AdminDisputesTab: React.FC = () => {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("OPEN");

  // Dispute Arbitration Modal
  const [activeDispute, setActiveDispute] = useState<any | null>(null);
  const [nextStatus, setNextStatus] = useState<"UNDER_REVIEW" | "RESOLVED" | "REJECTED">("RESOLVED");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDisputes = useCallback(async () => {
    try {
      setLoading(true);
      const token =
        localStorage.getItem("nearvia_admin_auth_token") ||
        localStorage.getItem("nearvia_auth_token");
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`/api/v1/disputes/admin/all?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDisputes(data.data.disputes || []);
        setTotal(data.data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load disputes:", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const handleArbitrateDispute = async () => {
    if (!activeDispute || !resolutionNotes.trim()) return;
    try {
      setActionLoading(true);
      const token =
        localStorage.getItem("nearvia_admin_auth_token") ||
        localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`/api/v1/disputes/admin/${activeDispute.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          status: nextStatus,
          resolutionNotes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActiveDispute(null);
        setResolutionNotes("");
        fetchDisputes();
      } else {
        alert(data.error?.message || "Failed to update dispute status");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED", ""].map((st) => (
            <button
              key={st || "ALL"}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer ${
                statusFilter === st
                  ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {st ? (st === "OPEN" ? "Open Cases" : st === "UNDER_REVIEW" ? "Under Review" : st === "RESOLVED" ? "Resolved" : "Rejected") : "All Disputes"}
            </button>
          ))}
        </div>
      </div>

      {/* Disputes Table */}
      <div className="overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-5">Opportunity</th>
                <th className="py-3.5 px-5">Parties</th>
                <th className="py-3.5 px-5">Dispute Reason</th>
                <th className="py-3.5 px-5">Wage</th>
                <th className="py-3.5 px-5">Filed</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Arbitration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    Loading dispute cases...
                  </td>
                </tr>
              ) : disputes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    No disputes found for this status.
                  </td>
                </tr>
              ) : (
                disputes.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900">{d.opportunity_title || "Work Assignment"}</div>
                      <div className="font-mono text-[10px] text-slate-400 font-medium">{d.assignment_id?.substring(0, 8)}...</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="text-slate-800">Initiator: <span className="font-bold text-slate-900">{d.initiator_name}</span></div>
                      <div className="text-slate-400 text-[11px] font-medium">Respondent: {d.respondent_name}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                        {d.reason}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-bold text-emerald-600">
                      ₹{d.agreed_wage}
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 text-[11px] font-medium">
                      {new Date(d.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          d.status === "OPEN"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : d.status === "RESOLVED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => {
                          setActiveDispute(d);
                          setNextStatus("RESOLVED");
                          setResolutionNotes(d.resolution_notes || "");
                        }}
                        className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        Arbitrate
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
          Showing {disputes.length} of {total} dispute cases
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="p-2 rounded-xl bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50 text-slate-700 shadow-xs transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-slate-700">Page {page} of {Math.max(1, Math.ceil(total / 15))}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 15) || loading}
            className="p-2 rounded-xl bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50 text-slate-700 shadow-xs transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Arbitration Modal */}
      {activeDispute && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 font-display flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <span>Arbitrate Transaction Dispute</span>
              </h3>
              <button onClick={() => setActiveDispute(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <div className="text-slate-500 font-medium"><strong className="text-slate-900 font-bold">Opportunity:</strong> {activeDispute.opportunity_title}</div>
              <div className="text-slate-500 font-medium"><strong className="text-slate-900 font-bold">Agreed Wage:</strong> ₹{activeDispute.agreed_wage}</div>
              <div className="text-slate-500 font-medium"><strong className="text-slate-900 font-bold">Reason:</strong> {activeDispute.reason}</div>
              <div className="text-slate-500 font-medium"><strong className="text-slate-900 font-bold">Statement:</strong> {activeDispute.description}</div>
              {activeDispute.evidence_urls && activeDispute.evidence_urls.length > 0 && (
                <div className="pt-2">
                  <div className="text-slate-600 font-bold mb-1">Attached Evidence:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeDispute.evidence_urls.map((url: string, idx: number) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-blue-600 text-[11px] font-bold hover:underline shadow-xs"
                      >
                        <span>Evidence #{idx + 1}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[10px]">Mediation Outcome</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNextStatus("UNDER_REVIEW")}
                  className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer ${
                    nextStatus === "UNDER_REVIEW"
                      ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Under Review
                </button>
                <button
                  type="button"
                  onClick={() => setNextStatus("RESOLVED")}
                  className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer ${
                    nextStatus === "RESOLVED"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Resolve & Settle
                </button>
                <button
                  type="button"
                  onClick={() => setNextStatus("REJECTED")}
                  className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer ${
                    nextStatus === "REJECTED"
                      ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Reject Claim
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[10px]">Arbitration Resolution Notes</label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Provide authoritative findings, GPS audit validation, or settlement instructions..."
                rows={3}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition shadow-xs"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setActiveDispute(null)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleArbitrateDispute}
                disabled={actionLoading || !resolutionNotes.trim()}
                className="px-5 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-xs font-black text-white disabled:opacity-50 shadow-md shadow-orange-600/20 transition cursor-pointer"
              >
                {actionLoading ? "Processing..." : "Submit Arbitration"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
