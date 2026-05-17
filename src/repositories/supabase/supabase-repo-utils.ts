import { RepositoryError } from "@/lib/errors/repository-error";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export function requireSupabaseClient(operation: string): SupabaseClient {
  const client = createSupabaseClient();
  if (!client) {
    throw new RepositoryError({
      code: "NOT_CONFIGURED",
      repository: "supabase",
      operation,
      message:
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    });
  }
  return client;
}

export function throwIfSupabaseError(
  error: { message: string } | null,
  repository: string,
  operation: string,
): void {
  if (!error) return;
  throw new RepositoryError({
    code: "OPERATION_FAILED",
    repository,
    operation,
    message: error.message,
    cause: error,
  });
}
