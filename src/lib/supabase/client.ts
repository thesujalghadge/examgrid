import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseEnv();
  return Boolean(url.trim() && anonKey.trim());
}

/**
 * Browser-safe Supabase client. Returns null if env vars are missing.
 * Do not use for server secrets — anon key only.
 */
export function createSupabaseClient(): SupabaseClient | null {
  if (typeof window === "undefined") {
    return createSupabaseClientFromEnv();
  }
  if (!browserClient) {
    browserClient = createSupabaseClientFromEnv();
  }
  return browserClient;
}

export function createSupabaseClientFromEnv(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
