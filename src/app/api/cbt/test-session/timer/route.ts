import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  CBT_TEST_TIMER_COOKIE,
  decodeTestTimerCookie,
  getRemainingSecondsFromClaims,
} from "@/lib/cbt/test-session-token";
import { logCbtGuard, logCbtWarning, logSessionWarning } from "@/lib/logging/runtime-logger";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ws = await readVerifiedWorkspaceSession();
  if (!ws || ws.role !== "student") {
    logSessionWarning("cbt timer denied", { reason: "unauthorized" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const testId = new URL(request.url).searchParams.get("testId");
  const cookieStore = await cookies();
  const raw = cookieStore.get(CBT_TEST_TIMER_COOKIE)?.value;
  const claims = decodeTestTimerCookie(raw ? decodeURIComponent(raw) : null);

  if (!claims || claims.studentId !== ws.userId) {
    logCbtWarning("cbt timer missing", {
      testId,
      studentId: ws.userId,
      instituteId: ws.instituteId,
    });
    return NextResponse.json({ error: "No active timer" }, { status: 404 });
  }
  if (testId && claims.testId !== testId) {
    logSessionWarning("cbt timer denied", {
      reason: "test_mismatch",
      studentId: ws.userId,
      expectedTestId: claims.testId,
      receivedTestId: testId,
    });
    return NextResponse.json({ error: "Test mismatch" }, { status: 403 });
  }
  if (claims.instituteId !== ws.instituteId) {
    logSessionWarning("cbt timer denied", {
      reason: "tenant_mismatch",
      studentId: ws.userId,
      expectedInstituteId: claims.instituteId,
      receivedInstituteId: ws.instituteId,
      testId: claims.testId,
    });
    return NextResponse.json({ error: "Tenant mismatch" }, { status: 403 });
  }

  const remainingSeconds = getRemainingSecondsFromClaims(claims);
  const expired = remainingSeconds <= 0;
  logCbtGuard("cbt timer checked", {
    sessionId: claims.sessionId,
    testId: claims.testId,
    studentId: ws.userId,
    remainingSeconds,
    expired,
  });

  return NextResponse.json({
    sessionId: claims.sessionId,
    testId: claims.testId,
    startedAt: claims.startedAt,
    endsAt: claims.endsAt,
    remainingSeconds,
    expired,
  });
}
