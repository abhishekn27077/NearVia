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
  loginWithMockRole: (role: UserRole) => Promise<void>;
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
      const msg = err instanceof Error ? err.message : "Google authentication failed";
      setError(msg);
      throw err;
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
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (
        authError &&
        (authError.message.toLowerCase().includes("not confirmed") ||
          authError.message.toLowerCase().includes("email_not_confirmed"))
      ) {
        throw new Error(
          "Your email address has not been verified yet. Please check your email inbox and verify your account before logging in.",
        );
      }

      if (authError || !data?.session) {
        throw new Error(authError?.message || "Invalid email or password");
      }

      const authToken = data.session.access_token;
      const profile = await fetchUserProfile(authToken);

      if (!profile) {
        throw new Error("Unable to retrieve user profile from backend.");
      }

      setUser(profile);
      setToken(authToken);
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
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });

      // Also call backend rate-limited resend endpoint
      await fetch(`${webConfig.apiBaseUrl}/auth/resend-verification-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      }).catch(() => {});

      if (resendError && !resendError.message.toLowerCase().includes("rate limit")) {
        throw new Error(resendError.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resend verification email";
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
      // 1. Provision account via backend (creates Supabase Auth user & profile)
      const signupRes = await fetch(`${webConfig.apiBaseUrl}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password: pass,
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
          role,
        }),
      });

      if (!signupRes.ok) {
        const errJson = await signupRes.json();
        throw new Error(errJson.error?.message || "Sign up failed");
      }

      const signupJson = await signupRes.json();
      const userProfile = signupJson.data as AuthUserContext;

      // 2. Sign in to Supabase Auth on client if pre-confirmed (demo / test accounts)
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: pass,
        });

      if (!signInError && signInData.session) {
        setToken(signInData.session.access_token);
        setUser(userProfile);
      } else if (email.trim().toLowerCase().endsWith("@nearvia.test")) {
        setToken(`mock_token_${userProfile.authId}`);
        setUser(userProfile);
      }

      return userProfile;
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

  const loginWithMockRole = async (role: UserRole): Promise<void> => {
    await loginWithDemoAccount(role);
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
        loginWithMockRole,
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
