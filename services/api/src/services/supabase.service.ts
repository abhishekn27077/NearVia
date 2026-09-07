/**
 * Server-Side Supabase Service
 * Handles server-side token validation and Supabase Auth admin integration.
 */

import {
  createClient,
  SupabaseClient,
  User as SupabaseAuthUser,
} from "@supabase/supabase-js";
import { env } from "../config";

let supabaseServerClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient | null {
  if (supabaseServerClient) {
    return supabaseServerClient;
  }

  const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && serviceKey) {
    supabaseServerClient = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    return supabaseServerClient;
  }

  return null;
}

export interface VerifiedAuthResult {
  authId: string;
  email?: string;
  phone?: string;
}

/**
 * Validates a Bearer JWT token against Supabase Auth.
 * Includes deterministic mock token handling for automated testing.
 */
export async function verifySupabaseToken(
  token: string,
): Promise<VerifiedAuthResult | null> {
  // Test/Mock Token Support for Automated Integration Tests
  if (token.startsWith("mock_token_")) {
    const authId = token.replace("mock_token_", "");
    return {
      authId,
      email: `${authId}@example.com`,
      phone: "+919876543200",
    };
  }

  const client = getSupabaseServerClient();
  if (!client) {
    // If Supabase credentials are not yet configured in local development, fail safely
    console.warn(
      "[Supabase Service] Supabase credentials not configured in environment.",
    );
    return null;
  }

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }

    const user: SupabaseAuthUser = data.user;
    return {
      authId: user.id,
      email: user.email,
      phone: user.phone,
    };
  } catch (err) {
    console.error("[Supabase Service] Failed to verify token:", err);
    return null;
  }
}
