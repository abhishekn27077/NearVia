import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, FileText } from "lucide-react";
import { BrandLogo } from "../../components/ui/BrandLogo";

export const TermsPage: React.FC = () => {
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
          <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
            <FileText className="w-3.5 h-3.5" />
            <span>Legal Agreement</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display-title">
            NEARVIA Terms of Service
          </h1>
          <p className="text-xs text-slate-400">
            Last Updated: October 2026 • Hyperlocal Work Network
          </p>
        </div>

        <div className="space-y-6 text-xs sm:text-sm text-slate-600 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">1. Acceptance of Terms</h2>
            <p>
              By accessing or creating an account on NEARVIA (&ldquo;the Platform&rdquo;), you agree to comply with and be bound by these Terms of Service. If you do not agree, do not register or use the Platform.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">2. Marketplace Roles & Responsibilities</h2>
            <p>
              NEARVIA connects Workers, Employers (Providers), and Community Agents within a 5 km hyperlocal radius.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li><strong>Workers:</strong> Agree to provide accurate skill profiles, attend confirmed shifts, and follow local workplace safety guidelines.</li>
              <li><strong>Employers:</strong> Agree to post truthful job descriptions, maintain a safe work environment, and honor agreed wages upon job completion.</li>
              <li><strong>Agents:</strong> Act in good faith as assisted-registration facilitators for local workers without digital access. Self-assignment of administrative roles is prohibited.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">3. Authentication & Account Security</h2>
            <p>
              Users are responsible for safeguarding their login credentials. All accounts require valid email verification or authorized provider OAuth login. NEARVIA reserves the right to suspend accounts with fraudulent credentials or duplicate phone numbers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">4. Dispute Resolution & Fair Settlement</h2>
            <p>
              All hyperlocal job settlements, milestone disputes, and cancellations are subject to our platform arbitration guidelines. Unresolved disputes may be escalated through the NEARVIA Safety & Arbitration Portal.
            </p>
          </section>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center text-xs text-emerald-700 font-semibold space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Verified & Protected by NEARVIA Trust & Safety</span>
            </div>
            <Link
              to="/privacy"
              className="text-xs font-bold text-orange-600 hover:underline"
            >
              View Privacy Policy →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
