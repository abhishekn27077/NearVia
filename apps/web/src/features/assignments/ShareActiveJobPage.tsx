import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ShieldCheck,
  MapPin,
  Clock,
  AlertCircle,
  Building,
  Radio,
  ArrowRight,
} from "lucide-react";
import { SharedActiveJobInfo } from "@nearvia/types";
import { webConfig } from "../../config";

export const ShareActiveJobPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<SharedActiveJobInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSharedJob() {
      if (!id) return;
      try {
        setLoading(true);
        const res = await fetch(`${webConfig.apiBaseUrl}/assignments/${id}/share-view`);
        const data = await res.json();
        if (res.ok && data.success) {
          setJob(data.data);
        } else {
          setError(data.error?.message || "Active job could not be found.");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load live status.");
      } finally {
        setLoading(false);
      }
    }
    fetchSharedJob();
    const interval = setInterval(fetchSharedJob, 15000); // Polling every 15s for live status
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-400">Loading live shift status...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-white font-display">Shift Information Unavailable</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error || "This shared job link has expired or is invalid."}
          </p>
          <Link
            to="/"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <span>Visit NEARVIA Home</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "IN_PROGRESS":
        return {
          label: "🟢 Shift In Progress",
          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          pulse: true,
        };
      case "CHECKED_IN":
        return {
          label: "📍 Worker Arrived & Checked In",
          color: "bg-blue-500/10 text-blue-400 border-blue-500/30",
          pulse: false,
        };
      case "COMPLETED":
        return {
          label: "✓ Shift Completed Successfully",
          color: "bg-purple-500/10 text-purple-400 border-purple-500/30",
          pulse: false,
        };
      case "CONFIRMED":
        return {
          label: "📅 Confirmed — En Route",
          color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          pulse: false,
        };
      default:
        return {
          label: `Status: ${status}`,
          color: "bg-slate-700 text-slate-300 border-slate-600",
          pulse: false,
        };
    }
  };

  const statusInfo = getStatusBadge(job.status);

  return (
    <div className="min-h-screen bg-slate-950 text-white py-12 px-4 sm:px-6 flex flex-col justify-between">
      <div className="max-w-xl w-full mx-auto space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-black tracking-tight text-white font-display">
              NEAR<span className="text-orange-500">VIA</span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              Live Safe Share
            </span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Live Updating</span>
          </div>
        </div>

        {/* Status Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span
                className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black border ${statusInfo.color}`}
              >
                {statusInfo.pulse && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                )}
                <span>{statusInfo.label}</span>
              </span>
              <span className="text-xs font-bold text-slate-400">
                {job.workType} Task
              </span>
            </div>

            <h1 className="text-2xl font-black text-white font-display">
              {job.title}
            </h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div className="flex items-start space-x-3">
              <Building className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Employer
                </div>
                <div className="text-xs font-black text-slate-200">
                  {job.providerName}
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <MapPin className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  General Location
                </div>
                <div className="text-xs font-black text-slate-200">
                  {job.addressApproximate}
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Clock className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Shift Window
                </div>
                <div className="text-xs font-black text-slate-200">
                  {new Date(job.workDate).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Verification
                </div>
                <div className="text-xs font-black text-emerald-400">
                  {job.checkedInAt ? "GPS On-Site Verified" : "Pending Arrival"}
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
            <span>
              This is a privacy-protected active job share card. For worker and client privacy, exact phone numbers and indoor coordinates are omitted.
            </span>
          </div>
        </div>
      </div>

      <div className="text-center pt-8 text-xs text-slate-500">
        Powered by NEARVIA Hyperlocal Marketplace & Safe Execution Platform
      </div>
    </div>
  );
};
