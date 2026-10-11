import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Lock } from "lucide-react";
import { BrandLogo } from "../../components/ui/BrandLogo";

export const PrivacyPage: React.FC = () => {
  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8 bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <Link
            to="/register"
            className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Registration
          </Link>
          <BrandLogo variant="full" size="sm" />
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <Lock className="w-3.5 h-3.5" />
            <span>Privacy & Data Protection</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display-title">
            NEARVIA Privacy Policy
          </h1>
          <p className="text-xs text-slate-400">
            Last Updated: October 2026 • Hyperlocal Privacy Architecture
          </p>
        </div>

        <div className="space-y-6 text-xs sm:text-sm text-slate-600 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">1. Information We Collect</h2>
            <p>
              NEARVIA collects only the minimal data necessary to power our hyperlocal job marketplace:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li><strong>Contact Info:</strong> Legal name and verified email address. Phone number is optional.</li>
              <li><strong>Hyperlocal Coordinates:</strong> Approximate GPS location solely used for 5 km distance matching. Indoor or precise home coordinates are never made public.</li>
              <li><strong>Work Profile:</strong> Skills, trade categories, and availability indicators.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">2. Zero Data Selling Commitment</h2>
            <p>
              We do not sell, rent, or monetize personal user data to third-party ad networks or brokers. Data is used exclusively within the NEARVIA matching and dispatch engine.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">3. Identity Verification & Cryptographic Privacy</h2>
            <p>
              For identity verification, NEARVIA utilizes privacy-preserving cryptographic hashes. Raw government documents are never stored insecurely.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">4. Your Privacy Rights</h2>
            <p>
              You have the right to inspect, update, or request the deletion of your account and associated profile data at any time through your account settings or by contacting our data protection officer.
            </p>
          </section>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center text-xs text-emerald-700 font-semibold space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Compliant with Indian Digital Data Protection (DPDP) Guidelines</span>
            </div>
            <Link
              to="/terms"
              className="text-xs font-bold text-orange-600 hover:underline"
            >
              View Terms of Service →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
