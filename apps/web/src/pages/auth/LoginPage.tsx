import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { UserRole } from "@nearvia/types";
import {
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { BrandLogo } from "../../components/ui/BrandLogo";

export const LoginPage: React.FC = () => {
  const {
    user,
    signInWithEmailPassword,
    signInWithGoogle,
    resendVerificationEmail,
    isLoading,
    error,
  } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Auto-redirect confirmed authenticated users to their role-specific dashboard
  useEffect(() => {
    if (user && user.emailVerified) {
      if (window.location.hash || window.location.search.includes("code=")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      const rolePrefix = `/${user.role.toLowerCase()}`;
      const targetPath = (location.state as { from?: { pathname: string } })?.from?.pathname;
      const isSafeRedirect = targetPath && targetPath.startsWith(rolePrefix);
      const redirectUrl = isSafeRedirect ? targetPath : `${rolePrefix}/dashboard`;
      navigate(redirectUrl, { replace: true });
    }
  }, [user, navigate, location.state]);

  // Synchronize banner when auth error occurs
  useEffect(() => {
    if (error) {
      setBannerMessage(null);
    }
  }, [error]);

  // Inspect URL hash/query for confirmation status, OAuth tokens, or Supabase error codes
  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;

    if (hash || search) {
      const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
      const queryParams = new URLSearchParams(search);

      const errorDescription =
        hashParams.get("error_description") || queryParams.get("error_description");
      const errorCode = hashParams.get("error_code") || queryParams.get("error_code");
      const type = hashParams.get("type") || queryParams.get("type");

      if (errorDescription || errorCode) {
        if (errorCode === "otp_expired" || errorDescription?.toLowerCase().includes("expired")) {
          setBannerMessage({
            type: "error",
            text: "Your confirmation link has expired. Please request a new verification email below.",
          });
        } else {
          setBannerMessage({
            type: "error",
            text: errorDescription || "Authentication error. Please sign in with email and password.",
          });
        }
      } else if (type === "signup") {
        setBannerMessage({
          type: "success",
          text: "Email confirmed successfully! Signing you in...",
        });
      } else if (hashParams.get("access_token") || queryParams.get("code")) {
        setBannerMessage({
          type: "success",
          text: "Google sign-in verified! Finalizing session and redirecting...",
        });
      }
    }
  }, []);

  // Watchdog: Prevent getting stuck indefinitely if OAuth processing stalls
  useEffect(() => {
    const hasOAuth =
      window.location.hash.includes("access_token") ||
      window.location.search.includes("code=");
    if (hasOAuth && !user && !error) {
      const timer = setTimeout(() => {
        if (!user && !error) {
          setBannerMessage({
            type: "error",
            text: "Authentication session took longer than expected. Please verify your connection or try signing in again.",
          });
        }
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [user, error]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isLoading || isGoogleLoading) return; // Prevent duplicate submission

    setResendStatus(null);
    setBannerMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) return;

    setIsSubmitting(true);
    try {
      const authenticatedUser = await signInWithEmailPassword(trimmedEmail, password);
      const rolePrefix = `/${authenticatedUser.role.toLowerCase()}`;
      const targetPath = (location.state as { from?: { pathname: string } })?.from?.pathname;
      const isSafeRedirect = targetPath && targetPath.startsWith(rolePrefix);
      const redirectUrl = isSafeRedirect ? targetPath : `${rolePrefix}/dashboard`;
      navigate(redirectUrl, { replace: true });
    } catch {
      // Error handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setResendStatus("Please enter your email address above to resend verification.");
      return;
    }
    try {
      await resendVerificationEmail(email);
      setResendStatus("Verification email sent! Check your inbox.");
    } catch {
      setResendStatus("Failed to resend verification email. Please try again later.");
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSubmitting || isLoading || isGoogleLoading) return;
    setIsGoogleLoading(true);
    setBannerMessage(null);

    try {
      await signInWithGoogle(UserRole.WORKER);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      setBannerMessage({
        type: "error",
        text: rawMsg || "Google authentication failed. Please try signing in with email.",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const isAnyLoading = isSubmitting || isLoading || isGoogleLoading;

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] flex items-center justify-center p-4 sm:p-6 py-12 relative overflow-hidden">
      {/* Ambient Top Radial Depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(37,99,235,0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="max-w-md w-full p-8 sm:p-10 rounded-3xl card-premium space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Link
              to="/"
              className="inline-block focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
              aria-label="NEARVIA Home"
            >
              <BrandLogo variant="full" size="md" priority />
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display-title">
            {t.loginTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {t.loginSubtitle}
          </p>
        </div>

        {/* Status / Alert Banner */}
        {bannerMessage && (
          <div
            role="status"
            className={`p-4 rounded-2xl border text-xs font-medium space-y-1 flex items-start space-x-2 ${
              bannerMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>{bannerMessage.text}</div>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium space-y-2"
          >
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
            {(error.toLowerCase().includes("verified") ||
              error.toLowerCase().includes("verification") ||
              error.toLowerCase().includes("confirm") ||
              error.toLowerCase().includes("inbox")) && (
              <div className="pt-1 pl-6">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isAnyLoading}
                  className="font-bold underline text-rose-900 hover:text-rose-950 cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
                >
                  Resend confirmation email to {email || "entered email"}
                </button>
              </div>
            )}
          </div>
        )}

        {resendStatus && (
          <div
            role="status"
            className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium"
          >
            {resendStatus}
          </div>
        )}

        {/* Google OAuth Button */}
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isAnyLoading}
            aria-busy={isGoogleLoading}
            aria-label="Continue with Google"
            className="w-full py-3.5 px-4 min-h-[44px] rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 font-bold text-xs flex items-center justify-center space-x-3 transition-all shadow-xs active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50 cursor-pointer"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-orange-600" aria-hidden="true" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
            )}
            <span>{isGoogleLoading ? "Connecting to Google..." : "Continue with Google"}</span>
          </button>
        </div>

        {/* Section Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-[#FAFAF9] px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider absolute">
            Or sign in with email
          </span>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail
                className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                id="login-email"
                type="email"
                required
                disabled={isAnyLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                aria-label="Email Address"
                className="w-full pl-11 pr-4 py-3.5 min-h-[44px] rounded-2xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <Lock
                className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                required
                disabled={isAnyLoading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-label="Password"
                className="w-full pl-11 pr-12 py-3.5 min-h-[44px] rounded-2xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={isAnyLoading}
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                aria-pressed={showPassword}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 cursor-pointer disabled:opacity-50"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isAnyLoading}
            aria-busy={isSubmitting}
            className="w-full py-3.5 min-h-[44px] rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition-all shadow-md shadow-orange-600/20 flex items-center justify-center space-x-2 disabled:opacity-50 btn-tactile active:scale-[0.98] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)] focus-visible:ring-2 focus-visible:ring-orange-500 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" aria-hidden="true" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>{isLoading ? t.loading : t.loginBtn}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-500">
          {t.dontHaveAccount}{" "}
          <Link
            to="/register"
            className="text-orange-600 font-extrabold hover:underline focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            {t.createAccount}
          </Link>
        </div>
      </div>
    </div>
  );
};
