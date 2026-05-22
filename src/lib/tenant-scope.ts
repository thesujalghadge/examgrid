import type { WorkspaceSession } from "@/types/access-control";

export function scopeByInstituteId<T extends { instituteId?: string }>(
  rows: T[],
  instituteId: string,
) {
  return rows.filter((row) => !row.instituteId || row.instituteId === instituteId);
}

export function getScopedQuery<T extends { instituteId?: string }>(
  rows: T[],
  session: WorkspaceSession | null,
) {
  if (!session) return [];
  if (session.role === "platform_admin") return rows;
  if (!session.instituteId) return [];
  return rows.filter((row) => row.instituteId === session.instituteId);
}

export function withInstituteId<T extends object>(
  payload: T,
  instituteId: string,
): T & { instituteId: string } {
  return {
    ...payload,
    instituteId,
  };
}

export function guardTenantWrite<T extends { instituteId?: string }>(
  payload: T,
  session: WorkspaceSession | null,
) {
  if (!session) throw new Error("Unauthenticated tenant write denied.");
  if (!session.instituteId) throw new Error("Institute context required.");
  if (payload.instituteId && payload.instituteId !== session.instituteId) {
    throw new Error("Cross-institute write blocked.");
  }
  return {
    ...payload,
    instituteId: session.instituteId,
  };
}
