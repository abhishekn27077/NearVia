import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-[#FAFAF9] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-700 mb-4 shadow-sm border border-slate-200">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-black text-slate-900 font-display-title mb-2">
        Console Endpoint Not Found
      </h1>
      <p className="text-sm text-slate-500 max-w-md mb-6">
        The requested administrative route does not exist or has been relocated.
      </p>
      <Link
        to="/dashboard"
        className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all btn-tactile"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Command Center</span>
      </Link>
    </div>
  );
};
