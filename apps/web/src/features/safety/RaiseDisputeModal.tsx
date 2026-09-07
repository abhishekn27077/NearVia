import React, { useState } from "react";
import { AlertTriangle, X, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";

interface RaiseDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string;
  opportunityTitle: string;
  agreedWage?: number;
  onDisputeCreated?: () => void;
}

const DISPUTE_REASONS = [
  { value: "WORK_NOT_COMPLETED", label: "Work Not Completed as Agreed" },
  { value: "PAYMENT_DISAGREEMENT", label: "Payment or Wage Disagreement" },
  { value: "WORK_DESCRIPTION_MISMATCH", label: "Task Scope / Description Mismatch" },
  { value: "CANCELLATION_ISSUE", label: "Unfair Cancellation or Timing Issue" },
  { value: "ATTENDANCE_DISAGREEMENT", label: "Attendance / Check-In Disagreement" },
  { value: "INAPPROPRIATE_BEHAVIOR", label: "Unprofessional or Inappropriate Behavior" },
  { value: "OTHER", label: "Other Serious Issue" },
];

export const RaiseDisputeModal: React.FC<RaiseDisputeModalProps> = ({
  isOpen,
  onClose,
  assignmentId,
  opportunityTitle,
  agreedWage,
  onDisputeCreated,
}) => {
  const [reason, setReason] = useState("PAYMENT_DISAGREEMENT");
  const [description, setDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("nearvia_auth_token");
      const evidenceUrls = evidenceUrl.trim() ? [evidenceUrl.trim()] : [];

      const res = await fetch("/api/v1/disputes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          assignmentId,
          reason,
          description: description.trim(),
          evidenceUrls,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to open dispute");
      }

      setSuccess(true);
      if (onDisputeCreated) onDisputeCreated();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.message || "Failed to open dispute");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-5 relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 pb-2 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Raise Official Dispute</h2>
            <p className="text-xs text-slate-400">
              Shift: <span className="text-white font-medium">{opportunityTitle}</span>
              {agreedWage ? ` (₹${agreedWage.toFixed(2)})` : ""}
            </p>
          </div>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">Dispute Filed Successfully</h3>
            <p className="text-xs text-slate-300">
              Your dispute has been logged with immutable audit records. A platform mediator will review the case.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Dispute Reason <span className="text-amber-400">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
              >
                {DISPUTE_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Description of the Issue <span className="text-amber-400">*</span>
              </label>
              <textarea
                rows={4}
                required
                placeholder="Clearly describe what happened, what was agreed vs what took place (at least 10 characters)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Evidence URL (Photo proof, timesheet link, or chat link)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300 flex items-start space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Disputes are reviewed by human platform mediators. Both parties will be notified and given the opportunity to present facts.
              </span>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black transition shadow-lg shadow-amber-600/20 disabled:opacity-50"
              >
                {loading ? "Filing Dispute..." : "Raise Dispute"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
