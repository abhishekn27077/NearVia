import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Users, Phone, AlertCircle, ArrowRight, Calendar, MapPin } from "lucide-react";
import { AssignmentDetail, AssignmentStatus } from "@nearvia/types";
import { formatCurrencyINR, formatScheduleRange } from "../../utils";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";

export const ProviderAssignmentsPage: React.FC = () => {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setError(null);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${webConfig.apiBaseUrl}/assignments/mine`, {
        headers,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to load assigned workers.");
      }
      setAssignments(data.data || []);
    } catch (err: any) {
      setError(err.message || "Error fetching assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [token]);

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold border border-orange-100 mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>Shift Staffing & Rosters</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              Hired Workers & Active Shifts
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
              Track worker attendance check-ins, live shifts, and completion sign-offs.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <Link
              to="/provider/work"
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors shadow-xs"
            >
              My Postings
            </Link>
            <Link
              to="/provider/work/new"
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-md shadow-orange-600/20 flex items-center space-x-1.5"
            >
              <span>Post New Work</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Assignments List */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading assignments...</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-16 p-8 rounded-3xl bg-white border border-slate-200 shadow-card max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto text-orange-600">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="font-black text-lg text-slate-900 font-display">No assigned workers yet</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              When you accept applicant candidates from your postings, their live shifts, check-in status, and contact cards will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment) => {
              const scheduleStr = formatScheduleRange(
                assignment.workDate,
                assignment.startTime,
                assignment.endTime,
                assignment.durationHours,
              );

              return (
                <div
                  key={assignment.id}
                  className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 hover:border-orange-300 transition-all space-y-5 shadow-card"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-800 text-base font-black flex items-center justify-center shrink-0">
                        {assignment.workerFullName?.charAt(0) || "W"}
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 font-display">
                          {assignment.workerFullName}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                          Assigned to: <strong className="text-slate-800">{assignment.opportunityTitle || "Work"}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 sm:self-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black ${
                          assignment.status === AssignmentStatus.COMPLETED
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : assignment.status === AssignmentStatus.IN_PROGRESS
                              ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {assignment.status}
                      </span>
                      <div className="font-black text-emerald-600 text-base">
                        {formatCurrencyINR(assignment.agreedWage)}
                      </div>
                    </div>
                  </div>

                  {/* Schedule & Location */}
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 pt-3 border-t border-slate-100">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-4 h-4 text-orange-600" />
                      <span>{scheduleStr}</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <span>{assignment.addressApproximate || "Indiranagar, Bangalore"}</span>
                    </div>

                    {assignment.workerContactPhone && (
                      <a
                        href={`tel:${assignment.workerContactPhone}`}
                        className="flex items-center space-x-1.5 text-orange-600 hover:text-orange-700 font-bold"
                      >
                        <Phone className="w-4 h-4" />
                        <span>Call Worker: {assignment.workerContactPhone}</span>
                      </a>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <span className="text-xs text-slate-400 font-medium">
                      Assigned on {new Date(assignment.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>

                    <Link
                      to={`/provider/assignments/${assignment.id}`}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition-all flex items-center space-x-1.5 shadow-xs"
                    >
                      <span>Manage Shift</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
