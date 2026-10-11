import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { UserRole } from "@nearvia/types";
import {
  ArrowRight,
  Mail,
  Lock,
  Phone,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { BrandLogo } from "../../components/ui/BrandLogo";

interface CountryCodeOption {
  code: string;
  label: string;
  flag: string;
  maxDigits: number;
  placeholder: string;
}

const COUNTRY_CODES: CountryCodeOption[] = [
  { code: "+91", label: "India", flag: "🇮🇳", maxDigits: 10, placeholder: "98765 43210" },
  { code: "+1", label: "US / CA", flag: "🇺🇸", maxDigits: 10, placeholder: "202 555 0123" },
  { code: "+44", label: "UK", flag: "🇬🇧", maxDigits: 10, placeholder: "7911 123456" },
  { code: "+971", label: "UAE", flag: "🇦🇪", maxDigits: 9, placeholder: "50 123 4567" },
  { code: "+65", label: "Singapore", flag: "🇸🇬", maxDigits: 8, placeholder: "8123 4567" },
];

export const RegisterPage: React.FC = () => {
  const { signUpWithEmailPassword, signInWithGoogle, resendVerificationEmail, isLoading, error } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.WORKER);

  // UX & Security States
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleStatusMessage, setGoogleStatusMessage] = useState<{
    type: "info" | "error";
    text: string;
  } | null>(null);

  // Field Touched / Validation States
  const [fullNameTouched, setFullNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  // Registration Lifecycle States
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const currentCountry =
    COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0];

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

  // Restrict phone to digits only and enforce country-specific max length
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, "");
    const capped = digitsOnly.slice(0, currentCountry.maxDigits);
    setPhone(capped);
    if (!phoneTouched) setPhoneTouched(true);
  };

  // Phone Validation Logic (Strictly Optional, but validates if entered)
  const getPhoneValidation = (): { isValid: boolean; message: string | null } => {
    if (!phone || phone.trim() === "") {
      return { isValid: true, message: null }; // Optional
    }

    if (countryCode === "+91") {
      if (!/^[6-9]/.test(phone)) {
        return {
          isValid: false,
          message: "Indian mobile numbers must start with 6, 7, 8, or 9.",
        };
      }
      if (phone.length < 10) {
        return {
          isValid: false,
          message: `${10 - phone.length} more digits needed (10 digits required).`,
        };
      }
      return { isValid: true, message: null };
    }

    if (phone.length < currentCountry.maxDigits) {
      return {
        isValid: false,
        message: `${currentCountry.maxDigits - phone.length} more digits needed.`,
      };
    }

    return { isValid: true, message: null };
  };

  const phoneValidation = getPhoneValidation();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isLoading || isGoogleLoading) return; // Prevent duplicate submission

    setLocalError(null);
    setGoogleStatusMessage(null);
    setFullNameTouched(true);
    setEmailTouched(true);
    setPasswordTouched(true);
    setPhoneTouched(true);

    const trimmedFullName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // 1. Full Name Validation
    if (!trimmedFullName || trimmedFullName.length < 2) {
      setLocalError(t.fullNameRequired || "Full legal name must be at least 2 characters.");
      return;
    }

    // 2. Email Validation
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setLocalError(t.emailRequired || "Please enter a valid email address.");
      return;
    }

    // 3. Password Validation
    if (!password) {
      setLocalError(t.passwordRequired || "Password is required.");
      return;
    }
    if (password.length < 6) {
      setLocalError(t.passwordMinLength || "Password must be at least 6 characters long.");
      return;
    }

    // 4. Optional Phone Validation
    if (phone.length > 0 && !phoneValidation.isValid) {
      setLocalError(phoneValidation.message || t.phoneInvalidDigits);
      return;
    }

    const formattedPhone = phone.length > 0 ? `${countryCode}${phone}` : "";

    setIsSubmitting(true);
    try {
      const registeredUser = await signUpWithEmailPassword(
        trimmedEmail,
        password,
        trimmedFullName,
        formattedPhone,
        selectedRole,
      );

      if (registeredUser.emailVerified) {
        navigate(`/${registeredUser.role.toLowerCase()}/dashboard`, { replace: true });
      } else {
        setVerificationSent(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed. Please try again.";
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendVerificationEmail(email);
      setResendStatus("Verification email sent! Please check your inbox.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resend verification email.";
      setResendStatus(msg);
    }
  };

  const handleGoogleSignUp = async () => {
    if (isSubmitting || isLoading || isGoogleLoading) return;
    setIsGoogleLoading(true);
    setLocalError(null);
    setGoogleStatusMessage(null);

    try {
      await signInWithGoogle(selectedRole);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const lower = rawMsg.toLowerCase();
      if (
        lower.includes("not enabled") ||
        lower.includes("unsupported provider") ||
        lower.includes("provider is not enabled") ||
        lower.includes("validation_failed")
      ) {
        setGoogleStatusMessage({
          type: "error",
          text:
            t.googleUnavailable ||
            "Google Sign-In is not enabled for this Supabase project. To enable it, configure Google OAuth in the Supabase Dashboard under Authentication > Providers. In the meantime, please register with Email & Password below.",
        });
      } else {
        setGoogleStatusMessage({
          type: "error",
          text: rawMsg || "Google authentication failed. Please try email registration.",
        });
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const isAnyLoading = isSubmitting || isLoading || isGoogleLoading;

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] bg-[radial-gradient(ellipse_at_50%_0%,rgba(234,88,12,0.06)_0%,transparent_70%)] flex items-center justify-center p-4 sm:p-6 py-12">
      <div className="max-w-lg w-full p-6 sm:p-8 md:p-10 rounded-3xl card-premium space-y-6">
        {/* Header & Logo */}
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
            {t.registerTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {t.registerSubtitle}
          </p>
        </div>

        {/* Global Error Banner */}
        {(localError || error) && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start space-x-2"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{localError || error}</span>
          </div>
        )}

        {/* Google Status Notification Banner */}
        {googleStatusMessage && (
          <div
            role="alert"
            className={`p-4 rounded-2xl text-xs font-medium flex items-start space-x-2.5 transition-all ${
              googleStatusMessage.type === "error"
                ? "bg-amber-50 border border-amber-200 text-amber-900"
                : "bg-blue-50 border border-blue-200 text-blue-900"
            }`}
          >
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-bold">OAuth Provider Status</p>
              <p className="leading-relaxed">{googleStatusMessage.text}</p>
            </div>
          </div>
        )}

        {verificationSent ? (
          /* Email Verification State */
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
              <Mail className="w-8 h-8" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-black text-slate-900 font-display-title">
              {t.checkYourEmail || "Check your email"}
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto space-y-2">
              <p>
                Account created. We sent a confirmation link to{" "}
                <strong className="text-slate-900">{email}</strong>.
              </p>
              <p>Click the link in that email to activate your NEARVIA account.</p>
              <p className="text-slate-500 font-medium">
                After confirming, return to NEARVIA and sign in.
              </p>
            </div>
            {resendStatus && (
              <div
                role="status"
                className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium"
              >
                {resendStatus}
              </div>
            )}
            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={isAnyLoading}
                className="py-2.5 px-4 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all focus-visible:ring-2 focus-visible:ring-orange-500 cursor-pointer disabled:opacity-50"
              >
                {t.resendConfirmation || "Resend confirmation email"}
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
            {/* Role Selection Group */}
            <div className="space-y-2">
              <label
                id="role-group-label"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-caption-refined"
              >
                {t.joinAs || "I Want To Join As *"}
              </label>
              <div
                role="radiogroup"
                aria-labelledby="role-group-label"
                className="grid grid-cols-3 gap-2"
              >
                {[
                  { role: UserRole.WORKER, label: t.roleWorker, desc: t.workerDesc },
                  { role: UserRole.PROVIDER, label: t.roleProvider, desc: t.providerDesc },
                  { role: UserRole.AGENT, label: t.roleAgent, desc: t.agentDesc },
                ].map((r) => {
                  const isSelected = selectedRole === r.role;
                  return (
                    <button
                      key={r.role}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={isAnyLoading}
                      onClick={() => setSelectedRole(r.role)}
                      className={`p-3 min-h-[68px] rounded-2xl border text-center btn-tactile active:scale-95 transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)] focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50 cursor-pointer ${
                        isSelected
                          ? "border-orange-600 bg-orange-50/50 ring-4 ring-orange-500/10 text-slate-900 font-black shadow-xs"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-600 font-medium"
                      }`}
                    >
                      <div className="text-xs font-extrabold">{r.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-tight">
                        {r.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Google OAuth Button */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={isAnyLoading}
                aria-busy={isGoogleLoading}
                aria-label={`Sign up with Google as ${selectedRole}`}
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
                <span>
                  {isGoogleLoading
                    ? "Connecting to Google..."
                    : `${t.googleSignUp || "Sign up with Google"} (${getRoleLabel(selectedRole).split(" ")[0]})`}
                </span>
              </button>
            </div>

            {/* Section Divider */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-[#FAFAF9] px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider absolute">
                Or register with email
              </span>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleRegister} className="space-y-4" noValidate>
              {/* Full Legal Name */}
              <div>
                <label
                  htmlFor="reg-fullname"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Full Legal Name *
                </label>
                <div className="relative">
                  <User
                    className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-fullname"
                    type="text"
                    required
                    disabled={isAnyLoading}
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (!fullNameTouched) setFullNameTouched(true);
                    }}
                    onBlur={() => setFullNameTouched(true)}
                    placeholder="e.g. Ramesh Kumar"
                    aria-label="Full Legal Name"
                    aria-required="true"
                    aria-invalid={fullNameTouched && fullName.trim().length < 2}
                    className={`w-full pl-11 pr-4 py-3.5 min-h-[44px] rounded-2xl bg-white border text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium focus:bg-white focus:ring-4 transition-all disabled:opacity-50 ${
                      fullNameTouched && fullName.trim().length >= 2
                        ? "border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/10"
                        : fullNameTouched && fullName.trim().length > 0 && fullName.trim().length < 2
                        ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10"
                        : "border-slate-200 focus:border-orange-500 focus:ring-orange-500/10"
                    }`}
                  />
                </div>
                {fullNameTouched && fullName.trim().length > 0 && fullName.trim().length < 2 && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center space-x-1">
                    <span>{t.fullNameRequired || "Full name must be at least 2 characters."}</span>
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Email Address *
                </label>
                <div className="relative">
                  <Mail
                    className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-email"
                    type="email"
                    required
                    disabled={isAnyLoading}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (!emailTouched) setEmailTouched(true);
                    }}
                    onBlur={() => setEmailTouched(true)}
                    placeholder="name@example.com"
                    aria-label="Email Address"
                    aria-required="true"
                    aria-invalid={
                      emailTouched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
                    }
                    className={`w-full pl-11 pr-4 py-3.5 min-h-[44px] rounded-2xl bg-white border text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium focus:bg-white focus:ring-4 transition-all disabled:opacity-50 ${
                      emailTouched && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
                        ? "border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/10"
                        : emailTouched && email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
                        ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10"
                        : "border-slate-200 focus:border-orange-500 focus:ring-orange-500/10"
                    }`}
                  />
                </div>
                {emailTouched && email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center space-x-1">
                    <span>{t.emailRequired || "Please enter a valid email address."}</span>
                  </p>
                )}
              </div>

              {/* Phone Number Field with Country Code Selector (Digits Only, Max 10 for India, Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="reg-phone"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                  >
                    Phone Number
                  </label>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    {t.phoneOptional || "Optional"}
                  </span>
                </div>

                <div className="flex rounded-2xl border border-slate-200 bg-white overflow-hidden focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/10 transition-all">
                  {/* Country Code Dropdown */}
                  <label htmlFor="reg-country-code" className="sr-only">
                    Country Code
                  </label>
                  <select
                    id="reg-country-code"
                    value={countryCode}
                    disabled={isAnyLoading}
                    onChange={(e) => {
                      setCountryCode(e.target.value);
                      setPhone(""); // Reset phone when country changes to respect new limits
                    }}
                    className="bg-slate-50 text-slate-700 font-bold text-xs py-3.5 pl-3 pr-2 border-r border-slate-200 focus:outline-hidden cursor-pointer"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>

                  {/* Phone Digits-Only Input */}
                  <div className="relative flex-1">
                    <Phone
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <input
                      id="reg-phone"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      disabled={isAnyLoading}
                      value={phone}
                      onChange={handlePhoneChange}
                      onBlur={() => setPhoneTouched(true)}
                      placeholder={currentCountry.placeholder}
                      aria-label="Phone Number (Digits only)"
                      className="w-full pl-10 pr-4 py-3.5 min-h-[44px] bg-white text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-hidden disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Inline Phone Validation Feedback */}
                <div className="mt-1.5 min-h-[16px]">
                  {phone.length === 0 ? (
                    <p className="text-[11px] text-slate-400 font-medium">
                      Optional: 10-digit Indian mobile number for SMS job alerts.
                    </p>
                  ) : phoneValidation.isValid ? (
                    <p className="text-[11px] font-semibold text-emerald-600 flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {countryCode === "+91"
                          ? "✓ Valid 10-digit Indian mobile number."
                          : `✓ Valid ${currentCountry.label} mobile number.`}
                      </span>
                    </p>
                  ) : (
                    <p className="text-[11px] font-semibold text-amber-600 flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{phoneValidation.message}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Password Field with Show/Hide Toggle */}
              <div>
                <label
                  htmlFor="reg-password"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Create Password *
                </label>
                <div className="relative">
                  <Lock
                    className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={isAnyLoading}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (!passwordTouched) setPasswordTouched(true);
                    }}
                    onBlur={() => setPasswordTouched(true)}
                    placeholder="Minimum 6 characters"
                    aria-label="Create Password"
                    aria-required="true"
                    aria-invalid={passwordTouched && password.length < 6}
                    className={`w-full pl-11 pr-12 py-3.5 min-h-[44px] rounded-2xl bg-white border text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium focus:bg-white focus:ring-4 transition-all disabled:opacity-50 ${
                      passwordTouched && password.length >= 6
                        ? "border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/10"
                        : passwordTouched && password.length > 0 && password.length < 6
                        ? "border-amber-300 focus:border-amber-500 focus:ring-amber-500/10"
                        : "border-slate-200 focus:border-orange-500 focus:ring-orange-500/10"
                    }`}
                  />
                  {/* Show/Hide Password Button */}
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

                {/* Live Password Strength / Length Feedback */}
                <div className="mt-1.5 min-h-[18px]">
                  {passwordTouched && password.length === 0 ? (
                    <p className="text-[11px] font-semibold text-rose-600 flex items-center space-x-1">
                      <span>{t.passwordRequired || "Password is required (minimum 6 characters)."}</span>
                    </p>
                  ) : password.length > 0 && password.length < 6 ? (
                    <p className="text-[11px] font-semibold text-amber-600 flex items-center space-x-1">
                      <span>
                        Password must be at least 6 characters ({password.length}/6 characters entered).
                      </span>
                    </p>
                  ) : password.length >= 6 ? (
                    <p className="text-[11px] font-semibold text-emerald-600 flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>✓ Password meets minimum length requirement.</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 font-medium">
                      Must be at least 6 characters.
                    </p>
                  )}
                </div>
              </div>

              {/* Terms of Service & Privacy Policy Consent */}
              <div className="text-[11px] text-slate-500 text-center leading-relaxed px-2">
                {t.termsAndPrivacy}{" "}
                <Link
                  to="/terms"
                  className="text-orange-600 hover:text-orange-700 font-bold underline focus-visible:ring-2 focus-visible:ring-orange-500 rounded-sm"
                >
                  {t.termsOfService}
                </Link>{" "}
                {t.andText}{" "}
                <Link
                  to="/privacy"
                  className="text-orange-600 hover:text-orange-700 font-bold underline focus-visible:ring-2 focus-visible:ring-orange-500 rounded-sm"
                >
                  {t.privacyPolicy}
                </Link>
                .
              </div>

              {/* Submit Button with Loading & Duplicate-Submission Guard */}
              <button
                type="submit"
                disabled={isAnyLoading}
                aria-busy={isSubmitting}
                className="w-full py-3.5 min-h-[44px] rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition-all shadow-md shadow-orange-600/20 flex items-center justify-center space-x-2 disabled:opacity-50 btn-tactile active:scale-[0.98] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)] focus-visible:ring-2 focus-visible:ring-orange-500 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" aria-hidden="true" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>{`${t.createAccount} (${getRoleLabel(selectedRole).split(" ")[0]})`}</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            {/* Link to Login */}
            <div className="pt-2 text-center text-xs text-slate-500">
              {t.alreadyHaveAccount}{" "}
              <Link
                to="/login"
                className="text-orange-600 font-extrabold hover:underline focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                {t.loginBtn}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
