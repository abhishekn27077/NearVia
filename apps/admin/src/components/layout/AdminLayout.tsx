import React from "react";
import { Outlet } from "react-router-dom";
import { AdminHeader } from "./AdminHeader";

export const AdminLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900">
      <AdminHeader />
      <main className="flex-1 pb-16">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} NEARVIA Operations & Platform Governance Console</p>
          <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono">
            <span>ISOLATED PORT: 5174</span>
            <span>•</span>
            <span>SUPABASE AUTH RBAC</span>
            <span>•</span>
            <span>ZERO CLIENT TRUST</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
