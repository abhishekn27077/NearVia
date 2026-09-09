import React from "react";
import { AssignmentStatus } from "@nearvia/types";
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { formatDateTimeHuman } from "../../utils";

interface AssignmentStatusTimelineProps {
  status: AssignmentStatus;
  assignedAt?: string;
  confirmedAt?: string;
  checkedInAt?: string;
  startedAt?: string;
  completedAt?: string;
  settlementPendingAt?: string;
  closedAt?: string;
  cancelledAt?: string;
  noShowAt?: string;
}

interface StepInfo {
  status: AssignmentStatus;
  label: string;
  timestamp?: string;
}

export const AssignmentStatusTimeline: React.FC<AssignmentStatusTimelineProps> = ({
  status,
  assignedAt,
  confirmedAt,
  checkedInAt,
  startedAt,
  completedAt,
  settlementPendingAt,
  closedAt: _closedAt,
  cancelledAt,
  noShowAt,
}) => {
  if (status === AssignmentStatus.CANCELLED) {
    return (
      <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center space-x-3 shadow-xs">
        <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
        <div>
          <h4 className="text-sm font-black">Assignment Cancelled</h4>
          <p className="text-xs text-rose-700 mt-0.5">
            This work assignment was cancelled on{" "}
            {cancelledAt ? formatDateTimeHuman(cancelledAt) : "record"}.
          </p>
        </div>
      </div>
    );
  }

  if (status === AssignmentStatus.NO_SHOW) {
    return (
      <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center space-x-3 shadow-xs">
        <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
        <div>
          <h4 className="text-sm font-black">Reported as No-Show</h4>
          <p className="text-xs text-amber-700 mt-0.5">
            The worker did not arrive at the scheduled start time. Recorded on{" "}
            {noShowAt ? formatDateTimeHuman(noShowAt) : "record"}.
          </p>
        </div>
      </div>
    );
  }

  const steps: StepInfo[] = [
    {
      status: AssignmentStatus.ASSIGNED,
      label: "Assigned",
      timestamp: assignedAt,
    },
    {
      status: AssignmentStatus.CONFIRMED,
      label: "Confirmed",
      timestamp: confirmedAt,
    },
    {
      status: AssignmentStatus.CHECKED_IN,
      label: "Checked In",
      timestamp: checkedInAt,
    },
    {
      status: AssignmentStatus.IN_PROGRESS,
      label: "Working",
      timestamp: startedAt,
    },
    {
      status: AssignmentStatus.COMPLETED,
      label: "Completed",
      timestamp: completedAt,
    },
    {
      status: AssignmentStatus.SETTLEMENT_PENDING,
      label: "Settlement",
      timestamp: settlementPendingAt,
    },
  ];

  const statusOrder: Record<AssignmentStatus, number> = {
    [AssignmentStatus.ASSIGNED]: 0,
    [AssignmentStatus.CONFIRMED]: 1,
    [AssignmentStatus.CHECKED_IN]: 2,
    [AssignmentStatus.IN_PROGRESS]: 3,
    [AssignmentStatus.COMPLETED]: 4,
    [AssignmentStatus.SETTLEMENT_PENDING]: 5,
    [AssignmentStatus.CLOSED]: 5,
    [AssignmentStatus.CANCELLED]: -1,
    [AssignmentStatus.NO_SHOW]: -1,
    [AssignmentStatus.REPLACED]: -1,
  };

  const currentStepIdx = statusOrder[status] ?? 0;

  return (
    <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Shift Execution Timeline
        </h4>
        <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-black">
          Step {Math.min(6, currentStepIdx + 1)} of 6
        </span>
      </div>

      <div className="grid grid-cols-6 gap-2 relative">
        {steps.map((step, idx) => {
          const isPassed = idx < currentStepIdx;
          const isCurrent = idx === currentStepIdx;

          return (
            <div key={step.status} className="flex flex-col items-center text-center relative">
              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className={`absolute top-4 left-1/2 w-full h-1 -z-0 transition-colors ${
                    idx < currentStepIdx ? "bg-orange-600" : "bg-slate-200"
                  }`}
                />
              )}

              {/* Icon Circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all relative z-10 ${
                  isPassed
                    ? "bg-orange-600 text-white shadow-xs"
                    : isCurrent
                      ? "bg-white border-2 border-orange-600 text-orange-600 shadow-md ring-4 ring-orange-500/20"
                      : "bg-slate-100 border border-slate-200 text-slate-400"
                }`}
              >
                {isPassed ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isCurrent ? (
                  <Clock className="w-4 h-4 animate-spin text-orange-600" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              {/* Label & Timestamp */}
              <div className="mt-2 space-y-0.5">
                <div
                  className={`text-[11px] font-bold ${
                    isCurrent
                      ? "text-orange-600 font-black"
                      : isPassed
                        ? "text-slate-900"
                        : "text-slate-400"
                  }`}
                >
                  {step.label}
                </div>
                {step.timestamp && (
                  <div className="text-[10px] text-slate-400 font-medium">
                    {new Date(step.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
