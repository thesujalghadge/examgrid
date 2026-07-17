import { STORAGE_KEYS } from "@/repositories/storage-keys";
import {
  logSessionEvent,
  logSessionWarning,
} from "@/lib/logging/runtime-logger";
import {
  isSessionExpired,
  verifySessionToken,
  getSessionSecret,
  createSessionExpiry,
} from "@/lib/session-crypto";
import type { WorkspaceSession } from "@/types/access-control";

export const WORKSPACE_SESSION_COOKIE = "eg_workspace_session";

export { createSessionExpiry };

export function safeParseSession(raw: string | null | undefined): WorkspaceSession | null {
  if (!raw) return null;
  const verified = verifySessionToken(raw, getSessionSecret());
  if (verified) return verified;
  try {
    const legacy = JSON.parse(raw) as WorkspaceSession;
    if (legacy.userId && legacy.role) {
      if (!legacy.expiresAt || isSessionExpired(legacy)) return null;
      return legacy;
    }
  } catch {
    logSessionWarning("workspace session parse failed");
  }
  return null;
}

export function parseWorkspaceSession(raw: string | null | undefined): WorkspaceSession | null {
  return safeParseSession(raw);
}

function readCookieToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${WORKSPACE_SESSION_COOKIE}=([^;]*)`),
  );
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/** Cookie (via API) is source of truth; syncs into sessionStorage. */
export async function hydrateSessionFromServer(): Promise<WorkspaceSession | null> {
  try {
    const res = await fetch("/api/workspace/session", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      clearWorkspaceSessionLocal();
      return null;
    }
    const data = (await res.json()) as { session: WorkspaceSession | null };
    if (!data.session || isSessionExpired(data.session)) {
      clearWorkspaceSessionLocal();
      return null;
    }
    syncSessionToClientStorage(data.session);
    logSessionEvent("hydrateSession synced from server cookie", {
      role: data.session.role,
      userId: data.session.userId,
      instituteId: data.session.instituteId ?? null,
    });
    return data.session;
  } catch {
    logSessionWarning("hydrateSession API failed");
    return null;
  }
}

function syncSessionToClientStorage(session: WorkspaceSession): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEYS.workspaceSession, JSON.stringify(session));
  } catch (error) {
    console.error("[ExamGrid] sessionStorage error:", error);
    logSessionWarning("workspace sessionStorage write failed");
  }
}

export function clearWorkspaceSessionLocal(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEYS.workspaceSession);
  } catch {
    logSessionWarning("workspace sessionStorage clear failed");
  }
}

export async function persistWorkspaceSessionRemote(
  session: WorkspaceSession,
): Promise<boolean> {
  try {
    const res = await fetch("/api/workspace/session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: session.userId,
        role: session.role,
        instituteId: session.instituteId,
      }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (errData.error === "GHOST_INSTITUTE") throw new Error("GHOST_INSTITUTE");
      return false;
    }
    const data = (await res.json()) as { session: WorkspaceSession };
    syncSessionToClientStorage(data.session);
    logSessionEvent("workspace session persisted via API", {
      role: data.session.role,
      userId: data.session.userId,
    });
    return true;
  } catch (error) {
    logSessionWarning("persistWorkspaceSessionRemote failed");
    if (error instanceof Error && error.message === "GHOST_INSTITUTE") throw error;
    return false;
  }
}

export async function clearWorkspaceSessionRemote(): Promise<void> {
  clearWorkspaceSessionLocal();
  try {
    await fetch("/api/workspace/session", {
      method: "DELETE",
      credentials: "include",
    });
    logSessionEvent("workspace session cleared via API");
  } catch {
    logSessionWarning("clearWorkspaceSessionRemote failed");
  }
}

/** @deprecated Use hydrateSessionFromServer via store */
export function initSessionFromCookie(): WorkspaceSession | null {
  const token = readCookieToken();
  const session = token ? verifySessionToken(token, getSessionSecret()) : null;
  if (session) {
    syncSessionToClientStorage(session);
    return session;
  }
  return null;
}

export function getClientWorkspaceSession(): WorkspaceSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.workspaceSession);
    if (raw) {
      const parsed = safeParseSession(raw);
      if (parsed && !isSessionExpired(parsed)) return parsed;
    }
  } catch (error) {
    console.error("[ExamGrid] sessionStorage read error:", error);
    logSessionWarning("workspace sessionStorage read failed");
  }
  const token = readCookieToken();
  return token ? verifySessionToken(token, getSessionSecret()) : null;
}

export function persistWorkspaceSession(session: WorkspaceSession): void {
  syncSessionToClientStorage(session);
}

export function clearWorkspaceSession(): void {
  void clearWorkspaceSessionRemote();
}
