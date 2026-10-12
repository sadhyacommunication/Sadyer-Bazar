import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function isSupabaseConfigured(): boolean {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes("your-project-id") &&
    supabaseUrl.startsWith("https://")
  );
}

let publicClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

/**
 * Browser / Public Supabase Client (respects RLS policies).
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!publicClient) {
    publicClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true },
    });
  }
  return publicClient;
}

/**
 * Server-Only Admin Supabase Client (uses Service Role Key for verified order creation & payment IPN).
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  const keyToUse =
    supabaseServiceKey && !supabaseServiceKey.includes("your-supabase")
      ? supabaseServiceKey
      : supabaseAnonKey;

  if (!adminClient) {
    adminClient = createClient(supabaseUrl, keyToUse, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}
