import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  MapPin,
  LogOut,
  User,
  Compass,
  PlusCircle,
  Briefcase,
  ShieldCheck,
  Building,
  Languages,
  Zap,
  Wallet,
  CreditCard,
  ShieldAlert,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage, Language } from "../../context/LanguageContext";
import { UserRole } from "@nearvia/types";
import { NotificationBell } from "../notifications/NotificationBell";

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4 pointer-events-none">
      <nav className="pointer-events-auto w-full max-w-6xl nav-pill px-6 py-3 flex items-center justify-between transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
        {/* Brand Logo & Tagline */}
        <div className="flex items-center space-x-6">
          <Link
            to={user ? `/${user.role.toLowerCase()}/dashboard` : "/"}
            className="flex items-center space-x-2.5 group btn-tactile"
            aria-label="NEARVIA Home"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shadow-xs group-hover:bg-blue-600 transition-colors">
              <MapPin className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5 leading-none">
                <span className="font-black text-xl tracking-tight text-slate-900 font-display-title">
                  NEARVIA
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-orange-600"></span>
              </div>
              <p className="text-[10px] font-bold text-slate-500 font-caption-refined mt-0.5">
                Work Within Reach
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links — Strictly Filtered by Active Role */}
          <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-slate-200">
            {/* 1. GUEST / UNAUTHENTICATED NAVIGATION */}
            {!user && (
              <>
                <Link
                  to="/find-work"
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    location.pathname.startsWith("/find-work") || location.pathname.startsWith("/worker/find-work")
                      ? "bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t.findWork}</span>
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-orange-600" />
                  <span>{t.postWork}</span>
                </Link>
              </>
            )}

            {/* 2. WORKER ROLE NAVIGATION */}
            {user?.role === UserRole.WORKER && (
              <>
                <Link
                  to="/worker/find-work"
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    location.pathname.startsWith("/worker/find-work")
                      ? "bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t.findWork}</span>
                </Link>
                <Link
                  to="/worker/assignments"
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    location.pathname.startsWith("/worker/assignments")
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t.myShifts}</span>
                </Link>
                <Link
                  to="/worker/availability"
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    location.pathname.startsWith("/worker/availability")
                      ? "bg-amber-50 text-amber-700 border border-amber-200/80 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>Available Now</span>
                </Link>
                <Link
                  to="/worker/earnings"
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    location.pathname.startsWith("/worker/earnings")
                      ? "bg-purple-50 text-purple-700 border border-purple-200/80 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5 text-purple-600" />
                  <span>Earnings</span>
                </Link>
                <Link
                  to="/messages"
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    location.pathname.startsWith("/messages")
                      ? "bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>Messages</span>
                </Link>
              </>
            )}

            {/* 3. PROVIDER / EMPLOYER ROLE NAVIGATION */}
            {user?.role === UserRole.PROVIDER && (
              <>
                <Link
                  to="/provider/work/new"
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    location.pathname === "/provider/work/new"
                      ? "bg-orange-50 text-orange-700 border border-orange-200/80 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5 text-orange-600" />
                  <span>{t.postWork}</span>
                </Link>
                <Link
                  to="/provider/work"
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    location.pathname === "/provider/work"
                      ? "bg-slate-100 text-slate-900 border border-slate-300 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  <span>{t.myPostings}</span>
                </Link>
                <Link
                  to="/provider/payments"
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    location.pathname === "/provider/payments"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Wage Settlements</span>
                </Link>
                <Link
                  to="/messages"
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    location.pathname.startsWith("/messages")
                      ? "bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>Messages</span>
                </Link>
              </>
            )}

            {/* 4. AGENT ROLE NAVIGATION */}
            {user?.role === UserRole.AGENT && (
              <Link
                to="/agent/dashboard"
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  location.pathname.startsWith("/agent")
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Agent Portal</span>
              </Link>
            )}

            {/* 5. ADMIN ROLE NAVIGATION */}
            {user?.role === UserRole.ADMIN && (
              <>
                <Link
                  to="/admin/dashboard"
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    location.pathname === "/admin/dashboard"
                      ? "bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  <span>Command Center</span>
                </Link>
                <Link
                  to="/admin/work"
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    location.pathname.startsWith("/admin/work")
                      ? "bg-slate-100 text-slate-900 border border-slate-300 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  <span>Marketplace</span>
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Right Side Status, Language Selector & User Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Language Switcher Pill */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[11px] font-extrabold" title="Select Language">
            <span className="px-1.5 text-slate-400">
              <Languages className="w-3.5 h-3.5" />
            </span>
            {(["en", "kn", "hi"] as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`px-2 py-0.5 rounded-lg transition-all ${
                  language === lang
                    ? "bg-white text-slate-900 shadow-xs font-black"
                    : "text-slate-500 hover:text-slate-900"
                } ${lang === "kn" ? "font-kn" : ""} ${lang === "hi" ? "font-hi" : ""}`}
              >
                {lang === "en" ? "EN" : lang === "kn" ? "ಕನ್ನಡ" : "हिंदी"}
              </button>
            ))}
          </div>

          {/* 5 KM Live Network Indicator */}
          <div className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{t.networkLive}</span>
          </div>

          {user ? (
            <div className="flex items-center space-x-2">
              <NotificationBell />

              <Link
                to={
                  user.role === UserRole.WORKER
                    ? "/worker/profile"
                    : user.role === UserRole.PROVIDER
                    ? "/provider/profile"
                    : user.role === UserRole.AGENT
                    ? "/agent/dashboard"
                    : "/admin/dashboard"
                }
                className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900 text-xs font-bold transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center text-[11px] font-black">
                  {user.fullName ? user.fullName[0].toUpperCase() : "U"}
                </div>
                <div className="hidden sm:flex flex-col leading-tight max-w-[140px]">
                  <span className="truncate font-extrabold text-slate-900">
                    {user.fullName
                      ? user.fullName
                          .replace(/\s*\(.*?\)\s*/g, "")
                          .replace(/\s*(Demo|Test).*$/i, "")
                          .trim()
                          .split(/\s+/)
                          .slice(0, 2)
                          .join(" ") || "User"
                      : user.phone || "User"}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold">
                    {user.role}
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                title={t.logOut}
                aria-label={t.logOut}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                {t.logIn}
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm flex items-center space-x-1.5"
              >
                <User className="w-3.5 h-3.5" />
                <span>{t.getStarted}</span>
              </Link>
            </div>
          )}
        </div>
        </nav>
      </header>
  );
};
