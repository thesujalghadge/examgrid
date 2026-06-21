/**
 * Default institute until multi-tenant auth (Phase 5+).
 * Must match a row in `public.institutes` (see supabase/schema/seed.sql).
 */
export const DEFAULT_INSTITUTE_ID =
  process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID ??
  "00000000-0000-0000-0000-000000000001";

export function isUuid(value: string | undefined | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function assertInstituteUuid(value: string | undefined | null, fieldName = "instituteId"): asserts value is string {
  if (!value || typeof value !== "string" || value.trim() === "") {
    throw new Error(`[ExamGrid] Invalid or missing ${fieldName}: Value is empty.`);
  }
  const trimmed = value.trim();
  if (!isUuid(trimmed)) {
    throw new Error(`[ExamGrid] Invalid ${fieldName}: Must be a valid UUID. Received slug/malformed value: "${trimmed}"`);
  }
}
