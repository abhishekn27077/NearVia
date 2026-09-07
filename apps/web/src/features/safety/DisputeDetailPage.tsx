import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface DisputeDetail {
  id: string;
  assignmentId: string;
  initiatorId: string;
  respondentId: string;
  reason: string;
  description: string;
  evidenceUrls?: string[];
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  workOpportunityId?: string;
  opportunityTitle?: string;
  workType?: string;
  agreedWage?: number;
  paymentStatus?: string;
  initiatorName?: string;
  respondentName?: string;
}

export const DisputeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDispute() {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem("nearvia_auth_token");
        const res = await fetch(`/api/v1/disputes/${id}`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || "Failed to load dispute details");
        }
        setDispute(data.data);
      } catch (err: any) {
        setError(err.message || "Failed to load dispute");
      } finally {
        setLoading(false);
      }
    }
    fetchDispute();
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 w-full bg-[#FAFAF9] py-20 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading case details...</p>
        </div>
      </div>
    );
  }

  if (error || !dispute) {
    return (
      <div className="flex-1 w-full bg-[#FAFAF9] py-20">
        <div className="max-w-md mx-auto p-8 rounded-3xl bg-white border border-slate-200 shadow-card text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-black text-slate-900 font-display">Dispute Record Not Found</h2>
          <Link
            to="/disputes"
            className="inline-flex px-5 py-2.5 rounded-xl bg-orange-600 text-white font-bold text-xs"
          >
            Back to Dispute Cases
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <Link
            to="/disputes"
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dispute Cases</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
                Dispute Case #{dispute.id.substring(0, 8)}
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Initiated on {new Date(dispute.createdAt).toLocaleString("en-IN")}
              </p>
            </div>

            <span className="px-4 py-1.5 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200 self-start sm:self-auto">
              Status: {dispute.status}
            </span>
          </div>
        </div>

        {/* Details Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dispute Reason</div>
            <div className="text-lg font-black text-slate-900 mt-0.5">{dispute.reason}</div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detailed Statement</div>
            <div className="text-xs sm:text-sm text-slate-700 font-medium mt-1 bg-slate-50 p-4 rounded-2xl border border-slate-100 leading-relaxed">
              {dispute.description}
            </div>
          </div>

          {dispute.resolutionNotes && (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
              <div className="text-xs font-black flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Arbitration Resolution Notes</span>
              </div>
              <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                {dispute.resolutionNotes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
