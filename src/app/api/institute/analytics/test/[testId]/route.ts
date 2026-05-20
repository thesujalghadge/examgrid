import { NextResponse } from "next/server";
import { listCachedSubmissions } from "@/lib/server/cbt-results-cache";
import { computeTestAnalytics } from "@/services/test-analytics";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";
import type { TestSession } from "@/types/test-session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ testId: string }> },
) {
  const ws = await readVerifiedWorkspaceSession();
  if (
    !ws ||
    (ws.role !== "institute_admin" && ws.role !== "teacher" && ws.role !== "super_admin")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ws.instituteId) {
    return NextResponse.json({ error: "Missing institute" }, { status: 403 });
  }

  const { testId } = await context.params;
  const cached = listCachedSubmissions(ws.instituteId, testId);
  const sessions: TestSession[] = cached.map((c) => ({
    id: c.sessionId,
    studentId: c.studentId,
    testId: c.testId,
    instituteId: c.instituteId,
    status: "submitted",
    startedAt: c.submittedAt - c.durationSeconds * 1000,
    endsAt: c.submittedAt,
    lastSavedAt: c.submittedAt,
    questionOrder: [],
    optionOrderMap: {},
    integrityScore: c.integrityScore,
    flagged: c.flagged,
    score: c.score,
    resultBreakdown: c.resultBreakdown,
  }));

  const analytics = computeTestAnalytics(testId, sessions);
  return NextResponse.json(analytics);
}
