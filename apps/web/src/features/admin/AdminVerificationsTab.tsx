import React, { useState, useEffect, useCallback } from "react";
import { XCircle, ChevronLeft, ChevronRight } from "lucide-react";

export const AdminVerificationsTab: React.FC = () => {
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("PENDING");

  // Rejection Modal
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchVerifications = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("nearvia_auth_token");
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`/api/v1/admin/verifications?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVerifications(data.verifications || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load verifications:", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  const handleApprove = async (id: string) => {
    if (!confirm("Are you sure you want to approve this verification application?")) return;
    try {
      setActionLoading(true);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`/api/v1/admin/verifications/${id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ notes: "Verified government credentials" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchVerifications();
      } else {
        alert(data.error?.message || "Failed to approve verification");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    try {
      setActionLoading(true);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`/api/v1/admin/verifications/${rejectId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ rejectionReason: rejectReason }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRejectId(null);
        setRejectReason("");
        fetchVerifications();
      } else {
        alert(data.error?.message || "Failed to reject verification");
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
          {["PENDING", "VERIFIED", "REJECTED", ""].map((st) => (
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
              {st ? (st === "PENDING" ? "Pending Review" : st === "VERIFIED" ? "Verified" : "Rejected") : "All Submissions"}
            </button>
          ))}
        </div>
      </div>

      {/* Verifications Table */}
      <div className="overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-5">Applicant</th>
                <th className="py-3.5 px-5">Type</th>
                <th className="py-3.5 px-5">Document Ref</th>
                <th className="py-3.5 px-5">Submitted</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Review Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    Loading verification queue...
                  </td>
                </tr>
              ) : verifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No verification submissions found for this status.
                  </td>
                </tr>
              ) : (
                verifications.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900">{v.user_name || "Applicant"}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{v.user_phone} • {v.user_role}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                        {v.verification_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-mono text-[11px] text-slate-600">
                        {v.document_ref || "None provided"}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 text-[11px] font-medium">
                      {new Date(v.submitted_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          v.status === "VERIFIED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : v.status === "REJECTED"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      {v.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(v.id)}
                            disabled={actionLoading}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition disabled:opacity-50 shadow-xs"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectId(v.id)}
                            disabled={actionLoading}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition shadow-xs"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 font-medium">
                          {v.reviewer_name ? `Reviewed by ${v.reviewer_name}` : "Completed"}
                        </div>
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
          Showing {verifications.length} of {total} verification records
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

      {/* Rejection Modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center space-x-2.5 text-rose-600">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                <XCircle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-900 font-display">Reject Verification Request</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Please specify the precise reason for rejection. This explanation will be delivered to the applicant.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Identity document is blurred or expired..."
              rows={3}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white transition shadow-xs"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRejectId(null)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
              >
                Dismiss
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-xs font-black text-white disabled:opacity-50 shadow-md shadow-rose-600/20 transition"
              >
                {actionLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
