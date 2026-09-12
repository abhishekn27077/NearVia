/**
 * Admin Browser Supabase Client
 * Uses only public environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
 * Service-role keys are strictly server-only and NEVER imported here.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder_anon_key";

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "nearvia_admin_auth_token",
    },
  },
);
