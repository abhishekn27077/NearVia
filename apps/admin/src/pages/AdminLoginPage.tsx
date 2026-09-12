import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import { Shield, Lock, Mail, ArrowRight, AlertTriangle, Loader2 } from "lucide-react";

export const AdminLoginPage: React.FC = () => {
  const { login, isLoading, error } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      await login(email, password);
      const targetPath = (location.state as { from?: { pathname: string } })?.from?.pathname;
      const redirectUrl = targetPath && targetPath !== "/login" ? targetPath : "/dashboard";
      navigate(redirectUrl, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setLocalError(msg);
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen w-full bg-[#0B0F17] flex flex-col justify-between p-4 sm:p-6 py-12 relative overflow-hidden text-slate-100">
      {/* Ambient Radial Spotlight */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(234,88,12,0.12)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,rgba(37,99,235,0.08)_0%,transparent_60%)] pointer-events-none" />

      <header className="max-w-md w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white font-black shadow-md shadow-orange-600/30">
            N
          </div>
          <div>
            <span className="text-sm font-black tracking-tight text-white">NEARVIA</span>
            <span className="ml-2 text-[10px] font-bold text-orange-400 uppercase tracking-widest px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20">
              Admin
            </span>
          </div>
        </div>
        <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>PORT 5174</span>
        </div>
      </header>

      <main className="max-w-md w-full mx-auto my-auto z-10 py-8">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 text-[11px] font-bold border border-rose-500/20">
              <Shield className="w-3.5 h-3.5" />
              <span>RESTRICTED PLATFORM CONSOLE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-display-title">
              Sign In to Command Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              Authorized operators only. Multi-factor administrative tokens and audit trails are active.
            </p>
          </div>

          {displayError && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-start space-x-3"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{displayError}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 font-caption-refined"
              >
                Administrator Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@nearvia.in"
                  autoComplete="email"
                  aria-label="Administrator Email"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm font-medium focus:bg-slate-800 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 font-caption-refined"
              >
                Security Passphrase
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="admin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  aria-label="Security Passphrase"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm font-medium focus:bg-slate-800 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-black text-xs sm:text-sm transition-all shadow-lg shadow-orange-600/30 flex items-center justify-center space-x-2 disabled:opacity-50 btn-tactile cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Authorization...</span>
                </>
              ) : (
                <>
                  <span>Authenticate Session</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 text-center leading-relaxed">
            Admin accounts are provisioned server-side by system architects. Self-registration is strictly disabled.
          </div>
        </div>
      </main>

      <footer className="max-w-md w-full mx-auto text-center z-10 text-[11px] text-slate-400 space-y-1">
        <p>NEARVIA Platform Operations • Zero-Trust Perimeter</p>
        <p className="font-mono text-[10px]">Session ID, IP Address and Device Signatures Logged</p>
      </footer>
    </div>
  );
};
