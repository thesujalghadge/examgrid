import { createHmac, timingSafeEqual } from "crypto";
import { getSessionSecret } from "@/lib/session-crypto";
import type { TestSessionTimerClaims } from "@/types/test-session";

export const CBT_TEST_TIMER_COOKIE = "eg_cbt_test_timer";

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function encodeTestTimerCookie(claims: TestSessionTimerClaims): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const sig = signPayload(payload, getSessionSecret());
  return `${payload}.${sig}`;
}

export function decodeTestTimerCookie(
  token: string | null | undefined,
  options?: { allowExpired?: boolean },
): TestSessionTimerClaims | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = signPayload(payload, getSessionSecret());
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as TestSessionTimerClaims;
    if (!options?.allowExpired && Date.now() > claims.endsAt) return null;
    if (!claims.testId || !claims.studentId || !claims.sessionId) return null;
    return claims;
  } catch {
    return null;
  }
}

export function getRemainingSecondsFromClaims(claims: TestSessionTimerClaims): number {
  return Math.max(0, Math.floor((claims.endsAt - Date.now()) / 1000));
}
