import { createHmac, timingSafeEqual } from "crypto";
import type { WorkspaceSession } from "@/types/access-control";

const DEV_FALLBACK_SECRET = "examgrid-dev-session-secret-change-me";

export function getSessionSecret(): string {
  return process.env.WORKSPACE_SESSION_SECRET ?? DEV_FALLBACK_SECRET;
}

function encodePayload(session: WorkspaceSession): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

function decodePayload(payload: string): WorkspaceSession | null {
  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as WorkspaceSession;
    if (!parsed.userId || !parsed.role || typeof parsed.expiresAt !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function signSessionToken(session: WorkspaceSession, secret = getSessionSecret()): string {
  const payload = encodePayload(session);
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(
  token: string | null | undefined,
  secret = getSessionSecret(),
): WorkspaceSession | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const session = decodePayload(payload);
  if (!session) return null;
  if (Date.now() > session.expiresAt) return null;
  return session;
}

export function isSessionExpired(session: WorkspaceSession): boolean {
  return Date.now() > session.expiresAt;
}

export const WORKSPACE_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function createSessionExpiry(): number {
  return Date.now() + WORKSPACE_SESSION_TTL_MS;
}
