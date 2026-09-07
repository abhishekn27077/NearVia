import React from "react";
import { Link } from "react-router-dom";
import { MapPin, ShieldCheck, Heart } from "lucide-react";
import { webConfig } from "../../config";

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-white py-12 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Brand Col */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold shadow-sm">
                <MapPin className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-slate-900 text-lg font-display">
                {webConfig.appName}
              </span>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed max-w-xs">
              Hyperlocal marketplace connecting local businesses and individuals with nearby available workers for urgent shifts and micro-tasks within 5 km.
            </p>
          </div>

          {/* For Workers */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              For Workers
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <Link to="/worker/find-work" className="hover:text-blue-600 transition-colors font-medium">
                  Find Work Near Me (5 KM)
                </Link>
              </li>
              <li>
                <Link to="/worker/availability" className="hover:text-blue-600 transition-colors font-medium">
                  Available-Now Shifts
                </Link>
              </li>
              <li>
                <Link to="/worker/earnings" className="hover:text-blue-600 transition-colors font-medium">
                  Daily Earnings & Payouts
                </Link>
              </li>
            </ul>
          </div>

          {/* For Employers */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              For Employers
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <Link to="/provider/work/new" className="hover:text-blue-600 transition-colors font-medium">
                  Post a Task or Shift
                </Link>
              </li>
              <li>
                <Link to="/provider/work" className="hover:text-blue-600 transition-colors font-medium">
                  Manage Postings
                </Link>
              </li>
              <li>
                <Link to="/provider/payments" className="hover:text-blue-600 transition-colors font-medium">
                  Wage Settlements
                </Link>
              </li>
            </ul>
          </div>

          {/* Trust & Community */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Trust & Safety
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified Business Employers</span>
              </li>
              <li>
                <Link to="/agent/dashboard" className="hover:text-blue-600 transition-colors font-medium">
                  Community Agent Network
                </Link>
              </li>
              <li>
                <Link to="/disputes" className="hover:text-blue-600 transition-colors font-medium">
                  Safety & Fair Arbitration
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
          <p>
            © {new Date().getFullYear()} {webConfig.appName} • {webConfig.tagline}. Hyperlocal PostGIS Infrastructure.
          </p>
          <div className="flex items-center space-x-1 text-slate-500">
            <span>Built for local communities with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" />
            <span>in Bengaluru</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
