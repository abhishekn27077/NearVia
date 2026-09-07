import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { SafetyGuidanceBanner } from "./SafetyGuidanceBanner";

interface DisputeItem {
  id: string;
  assignmentId: string;
  initiatorId: string;
  respondentId: string;
  reason: string;
  description: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  createdAt: string;
  opportunityTitle?: string;
  workType?: string;
  agreedWage?: number;
  initiatorName?: string;
  respondentName?: string;
}

export const DisputesListPage: React.FC = () => {
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("nearvia_auth_token");
      const url = statusFilter
        ? `/api/v1/disputes/mine?status=${statusFilter}`
        : `/api/v1/disputes/mine`;

      const res = await fetch(url, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to load disputes");
      }
      setDisputes(data.data.disputes || []);
    } catch (err: any) {
      setError(err.message || "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, [statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200 gap-1">
            <Clock className="w-3 h-3" />
            Open
          </span>
        );
      case "UNDER_REVIEW":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-800 border border-blue-200 gap-1">
            <Clock className="w-3 h-3" />
            Under Review
          </span>
        );
      case "RESOLVED":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Resolved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-800 border border-rose-200 gap-1">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return <span className="text-xs text-slate-500 font-bold">{status}</span>;
    }
  };

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Safety Notice */}
        <SafetyGuidanceBanner />

        {/* Header & Controls */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold border border-orange-100 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Mediation & Safety</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              Dispute Resolution Cases
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
              Formal mediation cases, wage escrow holds, and platform arbitration status.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold focus:bg-white focus:border-orange-500"
            >
              <option value="">All Cases</option>
              <option value="OPEN">Open</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dispute List */}
        {loading ? (
          <div className="py-16 text-center text-xs font-bold text-slate-500">
            Loading disputes...
          </div>
        ) : disputes.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-card text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="text-base font-black text-slate-900 font-display">No Disputes on Record</h3>
            <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
              Your account has zero open disputes or wage conflicts. All shift executions are in good standing.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {disputes.map((d) => (
              <div
                key={d.id}
                className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-orange-300 transition-all space-y-4 shadow-card"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-sm text-slate-900">
                      Case #{d.id.substring(0, 8)}
                    </span>
                    {getStatusBadge(d.status)}
                  </div>

                  <span className="text-xs text-slate-400 font-medium">
                    Opened {new Date(d.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Reason: {d.reason}
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {d.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">
                    Opportunity: <strong className="text-slate-800">{d.opportunityTitle || "Shift"}</strong>
                  </span>

                  <Link
                    to={`/disputes/${d.id}`}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-all flex items-center space-x-1.5 shadow-xs"
                  >
                    <span>View Case File</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
