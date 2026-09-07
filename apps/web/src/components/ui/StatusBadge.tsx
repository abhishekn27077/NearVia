import React from "react";
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  PlayCircle,
  IndianRupee,
} from "lucide-react";

export type UniversalStatus =
  | "PUBLISHED"
  | "DRAFT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "CONFIRMED"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "ACTIVE"
  | "SUSPENDED"
  | "RESOLVED"
  | "OPEN"
  | "UNDER_REVIEW";

interface StatusBadgeProps {
  status: UniversalStatus | string;
  className?: string;
  size?: "sm" | "md";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = "",
  size = "md",
}) => {
  const norm = (status || "").toUpperCase();

  const getConfig = () => {
    switch (norm) {
      case "PUBLISHED":
      case "ACTIVE":
      case "ACCEPTED":
      case "CONFIRMED":
      case "PAID":
      case "RESOLVED":
      case "COMPLETED":
        return {
          icon: CheckCircle2,
          label: norm.replace("_", " "),
          colors: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
        };
      case "IN_PROGRESS":
        return {
          icon: PlayCircle,
          label: "IN PROGRESS",
          colors: "bg-teal-500/10 text-teal-300 border-teal-500/30",
        };
      case "PENDING":
      case "OPEN":
      case "UNDER_REVIEW":
      case "DRAFT":
        return {
          icon: Clock,
          label: norm.replace("_", " "),
          colors: "bg-amber-500/10 text-amber-300 border-amber-500/30",
        };
      case "REJECTED":
      case "CANCELLED":
      case "FAILED":
      case "SUSPENDED":
        return {
          icon: XCircle,
          label: norm.replace("_", " "),
          colors: "bg-rose-500/10 text-rose-300 border-rose-500/30",
        };
      case "REFUNDED":
        return {
          icon: IndianRupee,
          label: "REFUNDED",
          colors: "bg-purple-500/10 text-purple-300 border-purple-500/30",
        };
      default:
        return {
          icon: AlertCircle,
          label: norm,
          colors: "bg-slate-800 text-slate-300 border-slate-700",
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center space-x-1.5 rounded-full font-bold uppercase tracking-wider border ${sizeClasses} ${config.colors} ${className}`}
    >
      <Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
};
