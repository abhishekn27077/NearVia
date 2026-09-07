import { ShieldCheck, ShieldAlert, Shield } from "lucide-react";

interface TrustBadgeProps {
  status: "VERIFIED" | "PENDING" | "REJECTED" | "EXPIRED" | "UNVERIFIED";
  className?: string;
  showText?: boolean;
}

export function TrustBadge({ status, className, showText = true }: TrustBadgeProps) {
  const getBadgeConfig = () => {
    switch (status) {
      case "VERIFIED":
        return {
          icon: ShieldCheck,
          text: "Verified",
          colorClass: "text-green-600 bg-green-100",
          iconColor: "text-green-600",
        };
      case "PENDING":
        return {
          icon: Shield,
          text: "Verification Pending",
          colorClass: "text-amber-600 bg-amber-100",
          iconColor: "text-amber-600",
        };
      case "REJECTED":
      case "EXPIRED":
        return {
          icon: ShieldAlert,
          text: "Verification Issue",
          colorClass: "text-red-600 bg-red-100",
          iconColor: "text-red-600",
        };
      case "UNVERIFIED":
      default:
        return {
          icon: Shield,
          text: "Not Verified",
          colorClass: "text-slate-600 bg-slate-100",
          iconColor: "text-slate-500",
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.colorClass} ${className || ''}`}
    >
      <Icon className={`w-3.5 h-3.5 mr-1 ${config.iconColor}`} />
      {showText && config.text}
    </div>
  );
}
