import React from "react";
import { BrandLogo } from "../components/ui/BrandLogo";

interface LoadingFallbackProps {
  message?: string;
}

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
  message = "Loading NEARVIA...",
}) => {
  return (
    <div
      className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="relative mb-4 flex items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-xs animate-pulse">
          <BrandLogo variant="symbol" size="sm" priority />
        </div>
      </div>
      <p className="text-sm font-bold text-slate-600 font-caption-refined">{message}</p>
      <span className="sr-only">Loading content...</span>
    </div>
  );
};
