import { createSupabaseClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

const LOG_PREFIX = "[ExamGrid:SupabaseRepo]";

export function getSupabaseOrWarn(context: string): SupabaseClient | null {
  const client = createSupabaseClient();
  if (!client) {
    console.warn(
      `${LOG_PREFIX} ${context}: Supabase client not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.`,
    );
  }
  return client;
}

export function logSupabaseNotImplemented(method: string): void {
  console.warn(
    `${LOG_PREFIX} ${method} is not implemented yet — Phase 4B migration pending.`,
  );
}
