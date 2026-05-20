import { cookies } from "next/headers";
import {
  logSessionEvent,
  logSessionWarning,
} from "@/lib/logging/runtime-logger";
import { verifySessionToken } from "@/lib/session-crypto";
import { WORKSPACE_SESSION_COOKIE } from "@/lib/workspace-session";
import type { WorkspaceSession } from "@/types/access-control";

export { WORKSPACE_SESSION_COOKIE };

export async function readVerifiedWorkspaceSession(): Promise<WorkspaceSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(WORKSPACE_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const token = decodeURIComponent(raw);
  const session = verifySessionToken(token);
  if (!session) {
    logSessionWarning("workspace session verification failed", {
      reason: "invalid_or_expired_signature",
    });
    return null;
  }
  return session;
}

export function logRouteAccessDenied(
  pathname: string,
  reason: string,
  detail?: Record<string, unknown>,
): void {
  logSessionWarning("route access denied", { pathname, reason, ...detail });
}

export function logTenantMismatch(
  expectedInstituteId: string | undefined,
  actualInstituteId: string | undefined,
  userId: string,
): void {
  logSessionWarning("tenant mismatch attempt", {
    expectedInstituteId,
    actualInstituteId,
    userId,
  });
}

export function logSessionCreated(session: WorkspaceSession): void {
  logSessionEvent("session created", {
    userId: session.userId,
    role: session.role,
    instituteId: session.instituteId ?? null,
    expiresAt: session.expiresAt,
  });
}
