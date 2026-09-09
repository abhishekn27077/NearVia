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
let supabaseAdminClient: SupabaseClient | null = null;

/**
 * Server-side client for public auth calls (e.g. verifying tokens).
 */
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

/**
 * Privileged administrative client strictly requiring SUPABASE_SERVICE_ROLE_KEY.
 * Security: NEVER falls back to SUPABASE_ANON_KEY.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey =
    env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    return supabaseAdminClient;
  }

  return null;
}

/**
 * Resets cached clients (for testing environment variable changes).
 */
export function _resetClientsForTest(): void {
  supabaseServerClient = null;
  supabaseAdminClient = null;
}

export interface VerifiedAuthResult {
  authId: string;
  email?: string;
  phone?: string;
  emailVerified?: boolean;
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
      emailVerified: true,
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
    const isConfirmed = Boolean(
      (user as any).email_confirmed_at ||
      (user as any).confirmed_at ||
      (user as any).email_verified
    );

    return {
      authId: user.id,
      email: user.email,
      phone: user.phone,
      emailVerified: isConfirmed,
    };
  } catch (err) {
    console.error("[Supabase Service] Failed to verify token:", err);
    return null;
  }
}
