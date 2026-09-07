import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = "Loading information...",
  className = "",
  size = "md",
}) => {
  const sizeMap = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center justify-center p-8 space-y-3 ${className}`}
    >
      <Loader2 className={`${sizeMap[size]} text-teal-400 animate-spin`} />
      {label && <span className="text-xs text-slate-400 font-medium">{label}</span>}
      <span className="sr-only">{label}</span>
    </div>
  );
};
