import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_PROJECT_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://uqyjtlndgnvfqjcdwbop.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_fjenVMXelWDkrC8CEu3XeQ_xxrpxzOu";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxeWp0bG5kZ252ZnFqY2R3Ym9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMDU3MTQsImV4cCI6MjEwNTU4MTcxNH0.e82cv5ugvYRgkDqRYW5Nw8dZ1R4RskEJIjrTw9d22H0";

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function isSupabaseConfigured(): boolean {
  return (
    Boolean(SUPABASE_PROJECT_URL) &&
    Boolean(SUPABASE_ANON_KEY) &&
    SUPABASE_PROJECT_URL.startsWith("https://")
  );
}

let publicClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

/**
 * Browser / Public Supabase Client connected to sadhyarbazar (uqyjtlndgnvfqjcdwbop).
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!publicClient) {
    publicClient = createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true },
    });
  }
  return publicClient;
}

/**
 * Admin Supabase Client.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  const keyToUse =
    supabaseServiceKey && !supabaseServiceKey.includes("your-supabase")
      ? supabaseServiceKey
      : SUPABASE_ANON_KEY;

  if (!adminClient) {
    adminClient = createClient(SUPABASE_PROJECT_URL, keyToUse, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}
