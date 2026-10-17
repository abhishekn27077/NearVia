import React, { useState, useEffect, useCallback } from "react";
import {
  XCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  AlertTriangle,
  FileText,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  X,
} from "lucide-react";
import { adminConfig } from "../../config";

interface PreviewState {
  open: boolean;
  loading: boolean;
  url: string | null;
  error: string | null;
  isFixture: boolean;
  documentRef: string;
  userName: string;
}

export const AdminVerificationsTab: React.FC = () => {
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [excludeTestAccounts, setExcludeTestAccounts] = useState(false);

  // Modals state
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [resubmitId, setResubmitId] = useState<string | null>(null);
  const [resubmitInstructions, setResubmitInstructions] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [previewModal, setPreviewModal] = useState<PreviewState | null>(null);

  const isTestFixture = useCallback((v: any) => {
    if (v.isTestFixture !== undefined) return Boolean(v.isTestFixture);
    const email = (v.user_email || v.email || "").toLowerCase();
    const phone = v.user_phone || v.phone || "";
    const docRef = v.document_ref || "";
    const name = (v.user_name || "").toLowerCase();
    return (
      email.endsWith("@nearvia.test") ||
      email.includes("test.worker") ||
      docRef === "DOC_HASH_AADHAAR_9812" ||
      docRef.startsWith("DOC_HASH_") ||
      phone.startsWith("+919999") ||
      name.includes("test worker")
    );
  }, []);

  const hasGenuineDocument = useCallback((v: any) => {
    return Boolean(
      v.storage_path ||
      (v.document_ref && v.document_ref.startsWith("kyc/"))
    );
  }, []);

  const fetchVerifications = useCallback(async () => {
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

      const res = await fetch(`${adminConfig.apiBaseUrl}/admin/verifications?${params.toString()}`, {
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

  const displayedVerifications = excludeTestAccounts
    ? verifications.filter((v) => !isTestFixture(v))
    : verifications;
  const testFixtureCount = verifications.filter(isTestFixture).length;

  const handleApprove = async (v: any) => {
    if (actionLoading) return;
    if (isTestFixture(v)) {
      alert("Test fixtures and synthetic references cannot be approved as real verification.");
      return;
    }
    if (!hasGenuineDocument(v)) {
      alert("Cannot approve verification: No genuine document has been uploaded for review.");
      return;
    }
    if (!confirm(`Are you sure you want to approve identity verification for ${v.user_name || "this applicant"}?`)) return;
    try {
      setActionLoading(true);
      const token =
        localStorage.getItem("nearvia_admin_auth_token") ||
        localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`${adminConfig.apiBaseUrl}/admin/verifications/${v.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ notes: "Reviewed and approved by Admin via secure preview" }),
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
    if (!rejectId || !rejectReason.trim() || actionLoading) return;
    try {
      setActionLoading(true);
      const token =
        localStorage.getItem("nearvia_admin_auth_token") ||
        localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`${adminConfig.apiBaseUrl}/admin/verifications/${rejectId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
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

  const handleResubmit = async () => {
    if (!resubmitId || !resubmitInstructions.trim() || actionLoading) return;
    try {
      setActionLoading(true);
      const token =
        localStorage.getItem("nearvia_admin_auth_token") ||
        localStorage.getItem("nearvia_auth_token");
      const instructionsText = resubmitInstructions.trim();
      const res = await fetch(`${adminConfig.apiBaseUrl}/admin/verifications/${resubmitId}/resubmission`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          reason: instructionsText,
          instructions: instructionsText,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResubmitId(null);
        setResubmitInstructions("");
        fetchVerifications();
      } else {
        alert(data.error?.message || "Failed to request resubmission");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPreview = async (v: any) => {
    setPreviewModal({
      open: true,
      loading: true,
      url: null,
      error: null,
      isFixture: isTestFixture(v),
      documentRef: v.document_ref || v.storage_path || "None",
      userName: v.user_name || "Applicant",
    });

    try {
      const token =
        localStorage.getItem("nearvia_admin_auth_token") ||
        localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`${adminConfig.apiBaseUrl}/admin/verifications/${v.id}/preview`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPreviewModal((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                url: data.data.previewUrl,
                isFixture: data.data.isFixture,
                error: data.data.message || null,
              }
            : null
        );
      } else {
        setPreviewModal((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                error: data.error?.message || "Failed to generate preview URL",
              }
            : null
        );
      }
    } catch (err: any) {
      setPreviewModal((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              error: err.message || "Failed to connect to preview service",
            }
          : null
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "PENDING", label: "Pending Review" },
            { id: "RESUBMISSION_REQUIRED", label: "Resubmission Req" },
            { id: "VERIFIED", label: "Verified" },
            { id: "REJECTED", label: "Rejected" },
            { id: "", label: "All Submissions" },
          ].map((item) => (
            <button
              key={item.id || "ALL"}
              onClick={() => {
                setStatusFilter(item.id);
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer ${
                statusFilter === item.id
                  ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Exclude Test Accounts Filter */}
        <label className="inline-flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer select-none bg-white px-3.5 py-2 rounded-2xl border border-slate-200 shadow-xs hover:bg-slate-50 transition">
          <input
            type="checkbox"
            checked={excludeTestAccounts}
            onChange={(e) => setExcludeTestAccounts(e.target.checked)}
            className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer"
          />
          <span>Exclude Test Accounts</span>
          {testFixtureCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">
              {testFixtureCount} test
            </span>
          )}
        </label>
      </div>

      {/* Verifications Table */}
      <div className="overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-5">Applicant</th>
                <th className="py-3.5 px-5">Type</th>
                <th className="py-3.5 px-5">Document Attachment</th>
                <th className="py-3.5 px-5">Submitted</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Review Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">
                    Loading verification queue...
                  </td>
                </tr>
              ) : displayedVerifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">
                    No verification submissions found for this status.
                  </td>
                </tr>
              ) : (
                displayedVerifications.map((v) => {
                  const fixture = isTestFixture(v);
                  const genuineDoc = hasGenuineDocument(v);

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{v.user_name || "Applicant"}</span>
                          {fixture && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                              TEST FIXTURE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium">
                          {v.user_phone} • {v.user_role}
                          {v.user_email && <span className="text-slate-500 font-mono text-[10px]"> ({v.user_email})</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                          {v.verification_type}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(v)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-600" />
                            <span>View Doc</span>
                          </button>
                          <div className="font-mono text-[10px] text-slate-500 truncate max-w-[150px]">
                            {v.storage_path || v.document_ref || "None"}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 text-[11px] font-medium">
                        {new Date(v.submitted_at).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            v.status === "VERIFIED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : v.status === "RESUBMISSION_REQUIRED"
                              ? "bg-amber-50 text-amber-800 border border-amber-300"
                              : v.status === "REJECTED"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {v.status === "RESUBMISSION_REQUIRED" ? "Resubmit Req" : v.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {v.status === "PENDING" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {fixture || !genuineDoc ? (
                              <span
                                title="Approval disabled: test fixture or placeholder hash. Only genuine documents can be approved."
                                className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-400 text-[11px] font-bold cursor-not-allowed border border-slate-200"
                              >
                                Cannot Approve
                              </span>
                            ) : (
                              <button
                                onClick={() => handleApprove(v)}
                                disabled={actionLoading}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition disabled:opacity-50 shadow-xs cursor-pointer"
                              >
                                Approve
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setResubmitId(v.id);
                                setResubmitInstructions("");
                              }}
                              disabled={actionLoading}
                              title="Request applicant to re-upload clear document"
                              className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Resubmit</span>
                            </button>

                            <button
                              onClick={() => {
                                setRejectId(v.id);
                                setRejectReason("");
                              }}
                              disabled={actionLoading}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition shadow-xs cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 font-medium">
                            {v.reviewer_name ? `Reviewed by ${v.reviewer_name}` : "Completed"}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-2">
        <div>
          Showing {displayedVerifications.length} of {excludeTestAccounts ? Math.max(0, total - testFixtureCount) : total} records
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

      {/* Document Preview Modal */}
      {previewModal?.open && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col p-6 sm:p-8 space-y-4 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 font-display">
                  Document Preview: {previewModal.userName}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5 truncate max-w-md">
                  Ref: {previewModal.documentRef}
                </p>
              </div>
              <button
                onClick={() => setPreviewModal(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center min-h-[300px] bg-slate-50 rounded-2xl border border-slate-100 p-4">
              {previewModal.loading ? (
                <div className="text-xs text-slate-500 font-medium">
                  Generating secure signed preview URL...
                </div>
              ) : previewModal.isFixture ? (
                <div className="p-6 text-center space-y-3 max-w-md">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 mx-auto flex items-center justify-center">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Synthetic Test Fixture</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    This submission is a test fixture or placeholder hash. No genuine document was uploaded to private storage. Platform compliance rules prevent approving synthetic fixtures.
                  </p>
                </div>
              ) : previewModal.error ? (
                <div className="p-6 text-center space-y-3 max-w-md">
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 mx-auto flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Preview Inaccessible</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {previewModal.error}
                  </p>
                </div>
              ) : previewModal.url ? (
                <div className="w-full h-full flex flex-col items-center space-y-3">
                  {previewModal.documentRef.endsWith(".pdf") ? (
                    <div className="text-center space-y-3">
                      <FileText className="w-16 h-16 text-slate-400 mx-auto" />
                      <p className="text-xs text-slate-600">PDF Document ready for inspection.</p>
                      <a
                        href={previewModal.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-md hover:bg-slate-800"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Open PDF in Secure Tab (60s Expiry)</span>
                      </a>
                    </div>
                  ) : (
                    <img
                      src={previewModal.url}
                      alt="Verification Document"
                      className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-xs"
                    />
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Temporary 60-second time-bounded signed URL. Raw storage remains private.
              </span>
              <button
                onClick={() => setPreviewModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resubmission Modal */}
      {resubmitId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center space-x-2.5 text-amber-600">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
                <RefreshCw className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-900 font-display">Request Document Resubmission</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Specify what needs correction (e.g. image blurry, document cropped, or expired). The applicant will see these instructions in their Trust Center.
            </p>
            <textarea
              value={resubmitInstructions}
              onChange={(e) => setResubmitInstructions(e.target.value)}
              placeholder="e.g. Front of Aadhaar card is blurry. Please upload a clear photo showing full name and photo..."
              rows={3}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition shadow-xs"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setResubmitId(null)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResubmit}
                disabled={actionLoading || !resubmitInstructions.trim()}
                className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-xs font-black text-white disabled:opacity-50 shadow-md shadow-amber-600/20 transition cursor-pointer"
              >
                {actionLoading ? "Submitting..." : "Send Request to Applicant"}
              </button>
            </div>
          </div>
        </div>
      )}

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
              placeholder="e.g. Identity document name does not match user account profile..."
              rows={3}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white transition shadow-xs"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRejectId(null)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                Dismiss
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-xs font-black text-white disabled:opacity-50 shadow-md shadow-rose-600/20 transition cursor-pointer"
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
