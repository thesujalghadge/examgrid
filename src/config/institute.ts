/**
 * Default institute until multi-tenant auth (Phase 5+).
 * Must match a row in `public.institutes` (see supabase/schema/seed.sql).
 */
export const DEFAULT_INSTITUTE_ID =
  process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID ??
  "00000000-0000-0000-0000-000000000001";

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
