/**
 * Dedicated Admin Authentication Context
 * Exclusively handles administrator identity verification via Supabase Auth
 * and enforces server-side ADMIN role verification before granting access.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { AuthUserContext, UserRole } from "@nearvia/types";
import { supabase } from "../lib/supabaseClient";
import { adminConfig } from "../config";

interface AdminAuthContextType {
  user: AuthUserContext | null;
  adminUser: AuthUserContext | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<AuthUserContext>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<AuthUserContext | null>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<AuthUserContext | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdminProfile = useCallback(async (authToken: string): Promise<AuthUserContext | null> => {
    try {
      const res = await fetch(`${adminConfig.apiBaseUrl}/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        return null;
      }

      const json = await res.json();
      const profile: AuthUserContext = json.data;

      // STRICT SECURITY: Immediately block and reject any non-ADMIN user
      if (profile.role !== UserRole.ADMIN) {
        await supabase.auth.signOut();
        throw new Error("Access Denied: Account does not possess Platform Administrator privileges.");
      }

      return profile;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to verify administrator profile.";
      throw new Error(msg);
    }
  }, []);

  const login = async (email: string, pass: string): Promise<AuthUserContext> => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (authError || !data?.session) {
        throw new Error(authError?.message || "Invalid administrator credentials.");
      }

      const authToken = data.session.access_token;
      const profile = await fetchAdminProfile(authToken);

      if (!profile) {
        await supabase.auth.signOut();
        throw new Error("Unable to retrieve verified administrator credentials from backend.");
      }

      setAdminUser(profile);
      setToken(authToken);
      localStorage.setItem("nearvia_admin_auth_token", authToken);
      return profile;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Administrator authentication failed.";
      setError(msg);
      setAdminUser(null);
      setToken(null);
      localStorage.removeItem("nearvia_admin_auth_token");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore signout errors
    } finally {
      setAdminUser(null);
      setToken(null);
      setError(null);
      localStorage.removeItem("nearvia_admin_auth_token");
      setIsLoading(false);
    }
  };

  const refreshProfile = async (): Promise<AuthUserContext | null> => {
    if (!token) return null;
    try {
      const profile = await fetchAdminProfile(token);
      setAdminUser(profile);
      return profile;
    } catch {
      await logout();
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const activeSession = sessionData.session;

        if (activeSession && activeSession.access_token) {
          try {
            const profile = await fetchAdminProfile(activeSession.access_token);
            if (isMounted && profile) {
              setAdminUser(profile);
              setToken(activeSession.access_token);
              localStorage.setItem("nearvia_admin_auth_token", activeSession.access_token);
            }
          } catch (err: unknown) {
            if (isMounted) {
              const msg = err instanceof Error ? err.message : "Administrator session invalid.";
              setError(msg);
              setAdminUser(null);
              setToken(null);
              localStorage.removeItem("nearvia_admin_auth_token");
            }
          }
        }
      } catch {
        if (isMounted) {
          setAdminUser(null);
          setToken(null);
          localStorage.removeItem("nearvia_admin_auth_token");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        if (isMounted) {
          setAdminUser(null);
          setToken(null);
          localStorage.removeItem("nearvia_admin_auth_token");
          setIsLoading(false);
        }
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (session.access_token) {
          try {
            const profile = await fetchAdminProfile(session.access_token);
            if (isMounted && profile) {
              setAdminUser(profile);
              setToken(session.access_token);
              localStorage.setItem("nearvia_admin_auth_token", session.access_token);
            }
          } catch {
            if (isMounted) {
              setAdminUser(null);
              setToken(null);
              localStorage.removeItem("nearvia_admin_auth_token");
            }
          }
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchAdminProfile]);

  return (
    <AdminAuthContext.Provider
      value={{
        user: adminUser,
        adminUser,
        token,
        isLoading,
        error,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = (): AdminAuthContextType => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
};
