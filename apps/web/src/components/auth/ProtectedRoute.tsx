import React, { ReactNode } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { UserRole } from "@nearvia/types";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { LoadingFallback } from "../../app/LoadingFallback";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingFallback message="Verifying authorization..." />;
  }

  if (!user) {
    // Redirect unauthenticated user to /login
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Authenticated with incompatible role (403 representation)
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white border border-slate-200 shadow-card text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 font-display mb-1">
              Access Restricted
            </h2>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              This area requires the{" "}
              <span className="font-extrabold text-orange-600">
                {allowedRoles.join(" or ")}
              </span>{" "}
              role. You are currently signed in as{" "}
              <span className="font-extrabold text-slate-900">{user.role}</span>.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center justify-center space-x-2 w-full py-3.5 px-4 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-sm transition-all shadow-md shadow-orange-600/20"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to NEARVIA Home</span>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
