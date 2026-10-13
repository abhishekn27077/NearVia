import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import {
  LogOut,
  Compass,
  LayoutDashboard,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { BrandLogo } from "../common/BrandLogo";

export const AdminHeader: React.FC = () => {
  const { user, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (path: string) => {
    if (path === "/dashboard" && (location.pathname === "/" || location.pathname === "/dashboard")) {
      return true;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Console Identity */}
          <div className="flex items-center space-x-6">
            <Link to="/dashboard" className="flex items-center space-x-3 group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl" aria-label="NEARVIA Admin Home">
              <BrandLogo variant="full" theme="dark" size="sm" priority />
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/60 font-black">
                    Admin Console
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-mono">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>Platform Enclave • SSL Protected</span>
                </div>
              </div>
            </Link>

            {/* Navigation tabs */}
            <nav className="hidden md:flex items-center space-x-1">
              <Link
                to="/dashboard"
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                  isActive("/dashboard")
                    ? "bg-slate-800 text-orange-400 shadow-xs border border-slate-700"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Operations Hub</span>
              </Link>
              <Link
                to="/radar"
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                  isActive("/radar")
                    ? "bg-slate-800 text-orange-400 shadow-xs border border-slate-700"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>Workforce Radar</span>
              </Link>
            </nav>
          </div>

          {/* Operator Profile & Logout */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col items-end text-right">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{user?.email || "System Administrator"}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                ROLE: {user?.role || "ADMIN"} • SERVER RBAC
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 border border-slate-700 hover:border-rose-700/60 text-slate-200 hover:text-rose-200 text-xs font-bold transition-all"
              title="Secure Admin Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
