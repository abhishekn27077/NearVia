import React from "react";
import { AlertOctagon, PhoneCall, ShieldAlert } from "lucide-react";

export const SafetyGuidanceBanner: React.FC = () => {
  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2.5 shadow-card">
      <div className="flex items-center space-x-2 text-amber-900 font-extrabold">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
        <span className="text-sm font-display font-black">NEARVIA 24/7 Safety & Emergency Helpline Guidance</span>
      </div>
      <p className="text-amber-800 font-medium leading-relaxed">
        NEARVIA strictly moderates fraud, harassment, and wage issues. For immediate physical danger, medical emergencies, or safety incidents on site, please immediately contact emergency services.
      </p>
      <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs font-bold">
        <span className="flex items-center gap-1.5 text-slate-800 bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-xs">
          <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
          <span>National Emergency: 112</span>
        </span>
        <span className="flex items-center gap-1.5 text-slate-800 bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-xs">
          <AlertOctagon className="w-3.5 h-3.5 text-orange-600" />
          <span>Women Helpline: 1091</span>
        </span>
        <span className="flex items-center gap-1.5 text-slate-800 bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-xs">
          <PhoneCall className="w-3.5 h-3.5 text-rose-600" />
          <span>Police: 100 / Ambulance: 108</span>
        </span>
      </div>
    </div>
  );
};
