import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { AuthUserContext, UserRole } from "@nearvia/types";
import { webConfig } from "../config";
import { supabase } from "../lib/supabaseClient";

export const DEMO_CREDENTIALS: Partial<
  Record<UserRole, { email: string; password?: string; label: string }>
> = {
  [UserRole.WORKER]: {
    email: "demo.worker@nearvia.test",
    password: import.meta.env.VITE_DEMO_PASSWORD || "",
    label: "Demo Worker (Suresh Patel)",
  },
  [UserRole.PROVIDER]: {
    email: "demo.provider@nearvia.test",
    password: import.meta.env.VITE_DEMO_PASSWORD || "",
    label: "Demo Provider (Indiranagar Bakery)",
  },
  [UserRole.AGENT]: {
    email: "demo.agent@nearvia.test",
    password: import.meta.env.VITE_DEMO_PASSWORD || "",
    label: "Demo Agent (Sunita Rao)",
  },
};

interface AuthContextType {
  user: AuthUserContext | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  signInWithGoogle: (preferredRole?: UserRole) => Promise<void>;
  signInWithEmailPassword: (email: string, password: string) => Promise<AuthUserContext>;
  signUpWithEmailPassword: (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    role: UserRole,
  ) => Promise<AuthUserContext>;
  loginWithDemoAccount: (role: UserRole) => Promise<AuthUserContext>;
  verifyMobile: (phone: string) => Promise<AuthUserContext>;
  verifyIdentity: (reference?: string) => Promise<AuthUserContext>;
  resendVerificationEmail: (email: string) => Promise<void>;
  refreshProfile: () => Promise<AuthUserContext | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUserContext | null>(() => {
    const saved = localStorage.getItem("nearvia_auth_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("nearvia_auth_token");
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state to local storage for persistence
  useEffect(() => {
    if (user && token) {
      localStorage.setItem("nearvia_auth_user", JSON.stringify(user));
      localStorage.setItem("nearvia_auth_token", token);
    } else {
      localStorage.removeItem("nearvia_auth_user");
      localStorage.removeItem("nearvia_auth_token");
    }
  }, [user, token]);

  const fetchUserProfile = useCallback(
    async (authToken: string): Promise<AuthUserContext | null> => {
      try {
        const res = await fetch(`${webConfig.apiBaseUrl}/auth/me`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (res.ok) {
          const json = await res.json();
          setUser(json.data);
          setToken(authToken);
          return json.data;
        }
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
      }
      return null;
    },
    [],
  );

  const syncBackendGoogleProfile = useCallback(
    async (
      supabaseAccessToken: string,
      googleUser: {
        id: string;
        email?: string;
        user_metadata?: {
          full_name?: string;
          name?: string;
          avatar_url?: string;
          picture?: string;
        };
      },
      preferredRole?: UserRole,
    ) => {
      try {
        const rawRole = (localStorage.getItem("nearvia_pending_role") as UserRole) || preferredRole;
        const safeRole = [UserRole.WORKER, UserRole.PROVIDER, UserRole.AGENT].includes(rawRole)
          ? rawRole
          : UserRole.WORKER;

        const res = await fetch(`${webConfig.apiBaseUrl}/auth/sync-google-profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAccessToken}`,
          },
          body: JSON.stringify({
            authId: googleUser.id,
            email: googleUser.email,
            fullName:
              googleUser.user_metadata?.full_name ||
              googleUser.user_metadata?.name ||
              googleUser.email?.split("@")[0] ||
              "Google User",
            avatarUrl:
              googleUser.user_metadata?.avatar_url ||
              googleUser.user_metadata?.picture,
            role: safeRole,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          setUser(json.data);
          setToken(supabaseAccessToken);
          localStorage.removeItem("nearvia_pending_role");
        }
      } catch (err: unknown) {
        console.error("Failed to sync Google profile with NEARVIA backend:", err);
      }
    },
    [],
  );

  // Listen to Supabase Auth State changes and keep access tokens fresh
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        setToken(session.access_token);
        if (session.user && !user) {
          fetchUserProfile(session.access_token);
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.access_token) {
        setToken(session.access_token);
        if (session.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
          if (session.provider_token || session.user.app_metadata?.provider === "google") {
            await syncBackendGoogleProfile(session.access_token, session.user);
          } else {
            await fetchUserProfile(session.access_token);
          }
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setToken(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [syncBackendGoogleProfile, fetchUserProfile, user]);

  const signInWithGoogle = async (preferredRole: UserRole = UserRole.WORKER): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      localStorage.setItem("nearvia_pending_role", preferredRole);
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/login`,
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : "Google authentication failed";
      const friendlyMsg =
        rawMsg.toLowerCase().includes("not enabled") ||
        rawMsg.toLowerCase().includes("unsupported provider")
          ? "Google sign-in is not enabled in this project environment. Please register or sign in with Email & Password."
          : rawMsg;
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithEmailPassword = async (
    email: string,
    pass: string,
  ): Promise<AuthUserContext> => {
    setIsLoading(true);
    setError(null);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) {
        throw new Error("Please enter your email address.");
      }
      if (!pass) {
        throw new Error("Please enter your password.");
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: pass,
      });

      if (authError) {
        const rawMsg = authError.message || "";
        const lowerMsg = rawMsg.toLowerCase();
        if (
          lowerMsg.includes("not confirmed") ||
          lowerMsg.includes("email_not_confirmed") ||
          (authError as any).code === "email_not_confirmed"
        ) {
          throw new Error("Please confirm your email address before signing in.");
        }
        if (lowerMsg.includes("invalid login credentials")) {
          throw new Error("Invalid email or password.");
        }
        if (lowerMsg.includes("rate limit") || authError.status === 429) {
          throw new Error("Too many login attempts. Please wait a few moments and try again.");
        }
        throw new Error("Invalid email or password.");
      }

      if (!data?.session || !data.user) {
        throw new Error("Authentication failed. Please check your credentials.");
      }

      // Verify that user email is confirmed
      const isConfirmed = Boolean(
        data.user.email_confirmed_at ||
        (data.user as any).confirmed_at ||
        (data.user as any).email_verified
      );

      if (!isConfirmed) {
        // Sign out unconfirmed session immediately to prevent unconfirmed access
        await supabase.auth.signOut().catch(() => {});
        throw new Error("Please confirm your email address before signing in.");
      }

      const authToken = data.session.access_token;
      setToken(authToken);

      const profile = await fetchUserProfile(authToken);
      if (!profile) {
        throw new Error("Unable to retrieve user profile from backend.");
      }

      setUser(profile);
      return profile;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerificationEmail = async (email: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) {
        throw new Error("Please enter your email address.");
      }

      const redirectUrl = `${window.location.origin}/login`;
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: trimmedEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (resendError) {
        const rawMsg = resendError.message || "";
        const lowerMsg = rawMsg.toLowerCase();
        if (
          lowerMsg.includes("rate limit") ||
          resendError.status === 429 ||
          (resendError as any).code === "over_email_send_rate_limit"
        ) {
          throw new Error(
            "Email rate limit exceeded. Supabase limits outgoing verification emails per hour. Please wait a few minutes before trying again.",
          );
        }
        throw new Error(rawMsg || "Failed to resend confirmation email.");
      }

      // Also notify backend resend handler (rate-limited log/audit)
      await fetch(`${webConfig.apiBaseUrl}/auth/resend-verification-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      }).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resend confirmation email";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmailPassword = async (
    email: string,
    pass: string,
    fullName: string,
    phone: string,
    role: UserRole,
  ): Promise<AuthUserContext> => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Local field validation
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedFullName = fullName.trim();
      const trimmedPhone = phone.trim() || undefined;

      if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new Error("Please enter a valid email address.");
      }
      if (!pass || pass.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
      }
      if (!trimmedFullName) {
        throw new Error("Full name is required.");
      }
      if (![UserRole.WORKER, UserRole.PROVIDER, UserRole.AGENT].includes(role)) {
        throw new Error("Please select a valid role (Worker, Provider, or Agent).");
      }

      // 2. Call Supabase Auth native signup with redirect destination
      const redirectUrl = `${window.location.origin}/login`;
      const { data, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: pass,
        options: {
          data: {
            full_name: trimmedFullName,
            role,
            phone: trimmedPhone,
          },
          emailRedirectTo: redirectUrl,
        },
      });

      if (authError) {
        const rawMsg = authError.message || "";
        const lowerMsg = rawMsg.toLowerCase();
        if (
          lowerMsg.includes("rate limit") ||
          authError.status === 429 ||
          (authError as any).code === "over_email_send_rate_limit"
        ) {
          throw new Error(
            "Email rate limit exceeded. Supabase's default email service limits outgoing confirmation emails per hour. Please wait a few minutes before trying again.",
          );
        }
        if (lowerMsg.includes("already registered") || lowerMsg.includes("already exists")) {
          throw new Error(
            "An account with this email address already exists. Please log in or reset your password.",
          );
        }
        if (lowerMsg.includes("password")) {
          throw new Error("Password does not meet security requirements. Please choose a stronger password.");
        }
        if (lowerMsg.includes("invalid email") || lowerMsg.includes("valid email")) {
          throw new Error("Please enter a valid email address.");
        }
        throw new Error(rawMsg || "Registration failed. Please check your information and try again.");
      }

      // In Supabase, if email enumeration protection is ON, existing users return an empty identities array
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error(
          "An account with this email address already exists. Please log in or reset your password.",
        );
      }

      // Check if session returned (e.g. if email confirmation is disabled or pre-confirmed test environment)
      if (data.session) {
        setToken(data.session.access_token);
        const profile = await fetchUserProfile(data.session.access_token);
        if (profile) {
          setUser(profile);
          return profile;
        }
      }

      // When confirmation is required, session is null — expected behavior
      const unconfirmedUser: AuthUserContext = {
        id: data.user?.id || `user_${Date.now()}`,
        authId: data.user?.id || `user_${Date.now()}`,
        fullName: trimmedFullName,
        email: trimmedEmail,
        role,
        phone: trimmedPhone,
        emailVerified: false,
        isActive: true,
        profileCompleted: false,
        mobileVerified: false,
        identityVerified: false,
      };

      return unconfirmedUser;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign up failed";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithDemoAccount = async (role: UserRole): Promise<AuthUserContext> => {
    if (import.meta.env.PROD && !import.meta.env.VITE_ENABLE_DEMO_ACCOUNTS) {
      throw new Error("Demo accounts are strictly disabled in production builds.");
    }
    const creds = DEMO_CREDENTIALS[role];
    if (!creds || !creds.password) {
      throw new Error(`No demo account credentials configured for role: ${role}`);
    }
    return signInWithEmailPassword(creds.email, creds.password);
  };

  const verifyMobile = async (phone: string): Promise<AuthUserContext> => {
    if (!token) throw new Error("Not authenticated");
    setIsLoading(true);
    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/auth/verify-mobile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Mobile verification failed");
      }

      const json = await res.json();
      setUser(json.data);
      return json.data;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyIdentity = async (reference?: string): Promise<AuthUserContext> => {
    if (!token) throw new Error("Not authenticated");
    setIsLoading(true);
    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/auth/verify-identity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reference }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Identity verification failed");
      }

      const json = await res.json();
      setUser(json.data);
      return json.data;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async (): Promise<AuthUserContext | null> => {
    if (!token) return null;
    return fetchUserProfile(token);
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut().catch(() => {});
      if (token) {
        await fetch(`${webConfig.apiBaseUrl}/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {});
      }
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem("nearvia_pending_role");
      localStorage.removeItem("nearvia_auth_user");
      localStorage.removeItem("nearvia_auth_token");
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        signInWithGoogle,
        signInWithEmailPassword,
        signUpWithEmailPassword,
        loginWithDemoAccount,
        verifyMobile,
        verifyIdentity,
        resendVerificationEmail,
        refreshProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
