import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  CBT_TEST_TIMER_COOKIE,
  decodeTestTimerCookie,
  getRemainingSecondsFromClaims,
} from "@/lib/cbt/test-session-token";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";

export async function GET(request: Request) {
  const ws = await readVerifiedWorkspaceSession();
  if (!ws || ws.role !== "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const testId = new URL(request.url).searchParams.get("testId");
  const cookieStore = await cookies();
  const raw = cookieStore.get(CBT_TEST_TIMER_COOKIE)?.value;
  const claims = decodeTestTimerCookie(raw ? decodeURIComponent(raw) : null);

  if (!claims || claims.studentId !== ws.userId) {
    return NextResponse.json({ error: "No active timer" }, { status: 404 });
  }
  if (testId && claims.testId !== testId) {
    return NextResponse.json({ error: "Test mismatch" }, { status: 403 });
  }

  const remainingSeconds = getRemainingSecondsFromClaims(claims);
  const expired = remainingSeconds <= 0;

  return NextResponse.json({
    sessionId: claims.sessionId,
    testId: claims.testId,
    startedAt: claims.startedAt,
    endsAt: claims.endsAt,
    remainingSeconds,
    expired,
  });
}
