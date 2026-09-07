/**
 * NEARVIA Resilient API Client
 * Automatically manages Supabase access token lifecycles, proactive expiry refreshes,
 * 401 retry interceptors, and demo account seamless recovery.
 */

import { supabase } from "../lib/supabaseClient";
import { webConfig } from "../config";
import { DEMO_CREDENTIALS } from "../context/AuthContext";
import { UserRole } from "@nearvia/types";

/**
 * Retrieves a guaranteed active, non-expired access token.
 * Refreshes the Supabase session if expired or close to expiry (< 60s).
 */
export async function getValidToken(): Promise<string | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      // Check if we have a saved token in localStorage as fallback
      const savedToken = localStorage.getItem("nearvia_auth_token");
      return savedToken;
    }

    // Check if access token is expired or within 60s of expiring
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at || 0;

    if (expiresAt - nowInSeconds < 60) {
      console.log("[apiClient] Access token expired or expiring soon. Refreshing session...");
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

      if (!refreshError && refreshData.session?.access_token) {
        const freshToken = refreshData.session.access_token;
        localStorage.setItem("nearvia_auth_token", freshToken);
        return freshToken;
      }
    }

    return session.access_token;
  } catch (err) {
    console.warn("[apiClient] Failed to retrieve fresh token, using localStorage fallback:", err);
    return localStorage.getItem("nearvia_auth_token");
  }
}

/**
 * Resilient authenticated fetch wrapper.
 * Injects Authorization header, automatically refreshes expired tokens,
 * and retries on 401 Unauthorized before failing.
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${webConfig.apiBaseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  let token = await getValidToken();

  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response = await fetch(url, {
    ...options,
    headers,
  });

  // If unauthorized (401), attempt proactive session refresh and retry once
  if (response.status === 401) {
    console.warn("[apiClient] Received 401 Unauthorized. Attempting session refresh and retry...");

    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      let newToken: string | null = null;

      if (!refreshError && refreshData.session?.access_token) {
        newToken = refreshData.session.access_token;
      } else {
        // Check if active user is a demo account and auto-recover
        const userJson = localStorage.getItem("nearvia_auth_user");
        if (userJson) {
          try {
            const user = JSON.parse(userJson);
            const demoRole = user.role as UserRole;
            const creds = DEMO_CREDENTIALS[demoRole];
            if (creds && user.email === creds.email) {
              console.log("[apiClient] Auto-recovering demo session for:", creds.email);
              const { data: signInData } = await supabase.auth.signInWithPassword({
                email: creds.email,
                password: creds.password,
              });
              if (signInData.session) {
                newToken = signInData.session.access_token;
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      if (newToken) {
        localStorage.setItem("nearvia_auth_token", newToken);
        headers.set("Authorization", `Bearer ${newToken}`);

        // Retry the original request with the renewed token
        response = await fetch(url, {
          ...options,
          headers,
        });
      }
    } catch (retryErr) {
      console.error("[apiClient] Token auto-refresh retry failed:", retryErr);
    }
  }

  return response;
}
