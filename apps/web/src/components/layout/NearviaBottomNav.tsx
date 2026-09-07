import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Compass,
  Briefcase,
  User,
  PlusCircle,
  IndianRupee,
  ShieldCheck,
  Building,
  Home,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { UserRole } from "@nearvia/types";

export const NearviaBottomNav: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  const getNavItems = () => {
    if (!user) {
      return [
        {
          label: "Home",
          to: "/",
          icon: Home,
          isActive: location.pathname === "/",
        },
        {
          label: "Find Work",
          to: "/find-work",
          icon: Compass,
          isActive:
            location.pathname.startsWith("/find-work") ||
            location.pathname.startsWith("/worker/find-work"),
        },
        {
          label: "Sign In",
          to: "/login",
          icon: User,
          isActive: location.pathname === "/login" || location.pathname === "/register",
        },
      ];
    }

    switch (user.role) {
      case UserRole.WORKER:
        return [
          {
            label: "Home",
            to: "/worker/dashboard",
            icon: Home,
            isActive: location.pathname === "/worker/dashboard",
          },
          {
            label: "Find Work",
            to: "/worker/find-work",
            icon: Compass,
            isActive: location.pathname.startsWith("/worker/find-work"),
          },
          {
            label: "Shifts",
            to: "/worker/assignments",
            icon: Briefcase,
            isActive:
              location.pathname.startsWith("/worker/assignments") ||
              location.pathname.startsWith("/worker/applications"),
          },
          {
            label: "Earnings",
            to: "/worker/earnings",
            icon: IndianRupee,
            isActive: location.pathname.startsWith("/worker/earnings"),
          },
          {
            label: "Profile",
            to: "/worker/profile",
            icon: User,
            isActive:
              location.pathname.startsWith("/worker/profile") ||
              location.pathname.startsWith("/worker/skills") ||
              location.pathname.startsWith("/worker/availability"),
          },
        ];

      case UserRole.PROVIDER:
        return [
          {
            label: "Home",
            to: "/provider/dashboard",
            icon: Home,
            isActive: location.pathname === "/provider/dashboard",
          },
          {
            label: "My Work",
            to: "/provider/work",
            icon: Building,
            isActive:
              location.pathname === "/provider/work" ||
              location.pathname.startsWith("/provider/work/"),
          },
          {
            label: "Post Work",
            to: "/provider/work/new",
            icon: PlusCircle,
            isAction: true,
            isActive: location.pathname === "/provider/work/new",
          },
          {
            label: "Shifts",
            to: "/provider/assignments",
            icon: Briefcase,
            isActive: location.pathname.startsWith("/provider/assignments"),
          },
          {
            label: "Profile",
            to: "/provider/profile",
            icon: User,
            isActive: location.pathname.startsWith("/provider/profile"),
          },
        ];

      case UserRole.AGENT:
        return [
          {
            label: "Home",
            to: "/agent/dashboard",
            icon: Home,
            isActive: location.pathname === "/agent/dashboard",
          },
          {
            label: "Workers",
            to: "/agent/dashboard",
            icon: Users,
            isActive: location.pathname.startsWith("/agent/workers"),
          },
          {
            label: "Find Jobs",
            to: "/worker/find-work",
            icon: Compass,
            isActive: location.pathname.startsWith("/worker/find-work"),
          },
          {
            label: "Profile",
            to: "/agent/dashboard",
            icon: User,
            isActive: false,
          },
        ];

      case UserRole.ADMIN:
        return [
          {
            label: "Admin",
            to: "/admin/dashboard",
            icon: ShieldCheck,
            isActive: location.pathname.startsWith("/admin"),
          },
          {
            label: "Find Work",
            to: "/worker/find-work",
            icon: Compass,
            isActive: location.pathname.startsWith("/worker/find-work"),
          },
        ];

      default:
        return [
          {
            label: "Home",
            to: "/",
            icon: Home,
            isActive: location.pathname === "/",
          },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-2xl border-t border-white/60 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] safe-area-bottom px-2 py-1.5"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const isAction = (item as any).isAction;

          if (isAction) {
            return (
              <Link
                key={idx}
                to={item.to}
                className="flex flex-col items-center justify-center -mt-6 group active:scale-90 transition-transform duration-100"
                aria-label={item.label}
              >
                <div className="w-13 h-13 rounded-full bg-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-600/35 border-2 border-white ring-2 ring-orange-500/20">
                  <PlusCircle className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-extrabold text-orange-600 mt-1 font-caption-refined">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={idx}
              to={item.to}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl min-w-[54px] touch-target active:scale-[0.92] transition-all duration-100 ${
                item.isActive
                  ? "text-blue-600 font-extrabold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              aria-label={item.label}
            >
              <div
                className={`p-1.5 rounded-xl transition-all duration-200 ${
                  item.isActive ? "bg-blue-50 text-blue-600 shadow-xs scale-105" : ""
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
