import React, { useEffect, useState } from "react";
import {
  Flag,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { SafetyGuidanceBanner } from "./SafetyGuidanceBanner";

interface ReportItem {
  id: string;
  targetType: string;
  targetId: string;
  category?: string;
  reason: string;
  description?: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";
  resolution?: string;
  createdAt: string;
}

export const ReportsHistoryPage: React.FC = () => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReports() {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem("nearvia_auth_token");
        const res = await fetch("/api/v1/reports/mine", {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || "Failed to load reports");
        }
        setReports(data.data.reports || []);
      } catch (err: any) {
        setError(err.message || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, []);

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
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <SafetyGuidanceBanner />

        {/* Header */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold border border-orange-100 mb-1">
              <Flag className="w-3.5 h-3.5" />
              <span>Safety & Content Moderation</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              Submitted Safety Reports
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
              Track trust, safety, and conduct incident reports submitted by your account.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="py-16 text-center text-xs font-bold text-slate-500">
            Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-card text-center space-y-3">
            <ShieldCheck className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="text-base font-black text-slate-900 font-display">No Safety Reports Filed</h3>
            <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
              You have not filed any safety incident reports. If you experience fraud, harassment, or workplace safety issues, you can file a report from any job or assignment page.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((r) => (
              <div
                key={r.id}
                className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-orange-300 transition-all space-y-3 shadow-card"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-sm text-slate-900">
                      Report #{r.id.substring(0, 8)}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                      {r.targetType}
                    </span>
                    {getStatusBadge(r.status)}
                  </div>

                  <span className="text-xs text-slate-400 font-medium">
                    {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>

                <div className="text-xs font-black text-slate-800">
                  Reason: {r.reason}
                </div>
                {r.description && (
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    {r.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
