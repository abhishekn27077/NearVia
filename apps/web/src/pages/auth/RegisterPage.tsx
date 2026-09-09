import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { UserRole } from "@nearvia/types";
import {
  UserPlus,
  ArrowRight,
  Mail,
  Lock,
  Phone,
  User,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";

export const RegisterPage: React.FC = () => {
  const { signUpWithEmailPassword, signInWithGoogle, resendVerificationEmail, isLoading, error } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.WORKER);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case UserRole.WORKER:
        return t.roleWorker;
      case UserRole.PROVIDER:
        return t.roleProvider;
      case UserRole.AGENT:
        return t.roleAgent;
      default:
        return role;
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const registeredUser = await signUpWithEmailPassword(
        email,
        password,
        fullName,
        phone || "",
        selectedRole,
      );
      if (registeredUser.emailVerified) {
        navigate(`/${registeredUser.role.toLowerCase()}/dashboard`, { replace: true });
      } else {
        setVerificationSent(true);
      }
    } catch {
      // Error handled by AuthContext
    }
  };

  const handleResend = async () => {
    try {
      await resendVerificationEmail(email);
      setResendStatus("Verification email sent! Please check your inbox.");
    } catch {
      setResendStatus("Failed to resend verification email. Please try again later.");
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      await signInWithGoogle(selectedRole);
    } catch {
      // Error handled by AuthContext
    }
  };

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] bg-[radial-gradient(ellipse_at_50%_0%,rgba(234,88,12,0.06)_0%,transparent_70%)] flex items-center justify-center p-4 sm:p-6 py-12">
      <div className="max-w-lg w-full p-8 sm:p-10 rounded-3xl card-premium space-y-6">
        <div className="text-center space-y-1.5">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 shadow-xs">
            <UserPlus className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display-title">
            {t.registerTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {t.registerSubtitle}
          </p>
        </div>

        {error && (
          <div role="alert" className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
            {error}
          </div>
        )}

        {verificationSent ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
              <Mail className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 font-display-title">Check Your Email</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
              We sent an account verification link to <strong className="text-slate-900">{email}</strong>. Please check your inbox and verify your email address to activate your NEARVIA account.
            </p>
            {resendStatus && (
              <div role="status" className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium">
                {resendStatus}
              </div>
            )}
            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={isLoading}
                className="py-2.5 px-4 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                Resend Verification Email
              </button>
              <Link
                to="/login"
                className="py-2.5 px-5 min-h-[44px] rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                {t.loginBtn}
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Role Selector Cards */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-caption-refined">
                I Want To Join As *
              </label>
              <div role="radiogroup" aria-label="Choose your role" className="grid grid-cols-3 gap-2">
                {[
                  { role: UserRole.WORKER, label: t.roleWorker, desc: t.workerDesc },
                  { role: UserRole.PROVIDER, label: t.roleProvider, desc: t.providerDesc },
                  { role: UserRole.AGENT, label: t.roleAgent, desc: t.agentDesc },
                ].map((r) => (
                  <button
                    key={r.role}
                    type="button"
                    role="radio"
                    aria-checked={selectedRole === r.role}
                    onClick={() => setSelectedRole(r.role)}
                    className={`p-3 min-h-[64px] rounded-2xl border text-center btn-tactile active:scale-95 transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)] focus-visible:ring-2 focus-visible:ring-orange-500 ${
                      selectedRole === r.role
                        ? "border-orange-600 bg-orange-50/40 ring-4 ring-orange-500/10 text-slate-900 font-black"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-600 font-medium"
                    }`}
                  >
                    <div className="text-xs font-extrabold">{r.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={isLoading}
              aria-label={`Sign up with Google as ${selectedRole}`}
              className="w-full py-3.5 px-4 min-h-[44px] rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold text-xs transition-all shadow-xs flex items-center justify-center space-x-3 disabled:opacity-50 btn-tactile active:scale-[0.98] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)] focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign up with Google as {selectedRole}</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider absolute">
                Or register with email
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="reg-fullname" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Legal Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="reg-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    aria-label="Full Legal Name"
                    className="w-full pl-11 pr-4 py-3.5 min-h-[44px] rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    aria-label="Email Address"
                    className="w-full pl-11 pr-4 py-3.5 min-h-[44px] rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="reg-phone" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Phone Number
                  </label>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Optional</span>
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="reg-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 (Optional - Phone verification deferred to V2)"
                    aria-label="Phone Number"
                    className="w-full pl-11 pr-4 py-3.5 min-h-[44px] rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Create Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="reg-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    aria-label="Create Password"
                    className="w-full pl-11 pr-4 py-3.5 min-h-[44px] rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 min-h-[44px] rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition-all shadow-md shadow-orange-600/20 flex items-center justify-center space-x-2 disabled:opacity-50 btn-tactile active:scale-[0.98] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)] focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                <span>{isLoading ? t.loading : `${t.createAccount} (${getRoleLabel(selectedRole)})`}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>

            <div className="pt-2 text-center text-xs text-slate-500">
              {t.alreadyHaveAccount}{" "}
              <Link to="/login" className="text-orange-600 font-extrabold hover:underline focus-visible:ring-2 focus-visible:ring-orange-500">
                {t.loginBtn}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
