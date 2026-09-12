/**
 * Protected Admin Route Guard
 * Strictly verifies authenticated administrator identity and role before rendering child views.
 */

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { UserRole } from "@nearvia/types";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedAdminRouteProps {
  children: React.ReactElement;
}

export const ProtectedAdminRoute: React.FC<ProtectedAdminRouteProps> = ({ children }) => {
  const { adminUser, token, isLoading } = useAdminAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#0F172A] flex flex-col items-center justify-center p-4 space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center shadow-xl">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-black text-slate-200 uppercase tracking-wider font-caption-refined">
            Verifying Security Credentials
          </p>
          <p className="text-xs text-slate-400 font-medium">
            NEARVIA Authoritative Security Gateway
          </p>
        </div>
      </div>
    );
  }

  if (!adminUser || !token || adminUser.role !== UserRole.ADMIN) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};
