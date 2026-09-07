import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Calendar,
  Clock,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  UserCheck,
  Building,
} from "lucide-react";
import { AssignmentDetail, AssignmentStatus } from "@nearvia/types";
import { formatCurrencyINR, formatScheduleRange } from "../../utils";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";

export const WorkerAssignmentsPage: React.FC = () => {
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
        throw new Error(data.error?.message || "Failed to load your assignments.");
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

  const getStatusBadge = (status: AssignmentStatus) => {
    switch (status) {
      case AssignmentStatus.ASSIGNED:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center space-x-1 animate-pulse">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>🎉 Hired • Tap to Confirm</span>
          </span>
        );
      case AssignmentStatus.CONFIRMED:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Confirmed • Ready for Arrival</span>
          </span>
        );
      case AssignmentStatus.IN_PROGRESS:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1 animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            <span>Shift In Progress</span>
          </span>
        );
      case AssignmentStatus.COMPLETED:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Shift Completed</span>
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold border border-orange-100 mb-1">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Shift Dispatch & Execution</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              Active Shift Assignments
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
              Confirmed work sessions with GPS directions, attendance verification, and same-day payout.
            </p>
          </div>

          <Link
            to="/worker/find-work"
            className="px-5 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-md shadow-orange-600/20 flex items-center space-x-2 self-start sm:self-auto shrink-0"
          >
            <span>Find More Shifts</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
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
            <p className="text-xs font-bold text-slate-500">Loading your assignments...</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-16 p-8 rounded-3xl bg-white border border-slate-200 shadow-card max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto text-orange-600">
              <Briefcase className="w-7 h-7" />
            </div>
            <h3 className="font-black text-lg text-slate-900 font-display">No active assignments</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              When an employer hires your application, your confirmed shifts, arrival instructions, and check-in pass will show up here.
            </p>
            <div className="pt-2">
              <Link
                to="/worker/find-work"
                className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs shadow-md shadow-orange-600/20"
              >
                <span>Find Nearby Work</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-xs font-black">
                        {assignment.workType || "TASK"}
                      </span>
                      {getStatusBadge(assignment.status)}
                    </div>

                    <div className="sm:text-right">
                      <div className="font-black text-xl text-emerald-600 font-display">
                        {formatCurrencyINR(assignment.agreedWage)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">
                        Guaranteed Payout
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 hover:text-orange-600 transition-colors font-display">
                      <Link to={`/worker/assignments/${assignment.id}`}>
                        {assignment.opportunityTitle || "Work Assignment"}
                      </Link>
                    </h3>
                    <div className="flex items-center space-x-3 text-xs text-slate-500 font-semibold mt-1">
                      <span className="flex items-center space-x-1">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span>{assignment.providerBusinessName || assignment.providerFullName || "Verified Employer"}</span>
                      </span>
                      {assignment.providerContactPhone && (
                        <>
                          <span>•</span>
                          <span className="flex items-center space-x-1 text-slate-700">
                            <Phone className="w-3.5 h-3.5 text-orange-600" />
                            <span>{assignment.providerContactPhone}</span>
                          </span>
                        </>
                      )}
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
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <span className="text-xs text-slate-400 font-medium">
                      Assigned on {new Date(assignment.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>

                    <Link
                      to={`/worker/assignments/${assignment.id}`}
                      className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-all flex items-center space-x-1.5 shadow-xs"
                    >
                      <span>Open Shift Console</span>
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
