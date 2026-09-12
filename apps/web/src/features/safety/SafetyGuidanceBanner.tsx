import React from "react";
import { AlertOctagon, PhoneCall, ShieldAlert } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export const SafetyGuidanceBanner: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2.5 shadow-card">
      <div className="flex items-center space-x-2 text-amber-900 font-extrabold">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
        <span className="text-sm font-display font-black">{t.safetyHelplineTitle}</span>
      </div>
      <p className="text-amber-800 font-medium leading-relaxed">
        {t.safetyHelplineDesc}
      </p>
      <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs font-bold">
        <a
          href="tel:112"
          className="flex items-center gap-1.5 text-slate-800 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl border border-amber-200 shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 min-h-[38px]"
        >
          <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t.nationalEmergency112}</span>
        </a>
        <a
          href="tel:1091"
          className="flex items-center gap-1.5 text-slate-800 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl border border-amber-200 shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 min-h-[38px]"
        >
          <AlertOctagon className="w-3.5 h-3.5 text-orange-600" />
          <span>{t.womenHelpline1091}</span>
        </a>
        <a
          href="tel:100"
          className="flex items-center gap-1.5 text-slate-800 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl border border-amber-200 shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 min-h-[38px]"
        >
          <PhoneCall className="w-3.5 h-3.5 text-rose-600" />
          <span>{t.policeAmbulance}</span>
        </a>
      </div>
    </div>
  );
};
