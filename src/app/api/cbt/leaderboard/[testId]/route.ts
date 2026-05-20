import { NextResponse } from "next/server";
import { listCachedSubmissions } from "@/lib/server/cbt-results-cache";
import {
  buildTestLeaderboard,
  findStudentRank,
} from "@/services/test-leaderboard";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";
import type { TestSession } from "@/types/test-session";

export async function GET(
  request: Request,
  context: { params: Promise<{ testId: string }> },
) {
  const ws = await readVerifiedWorkspaceSession();
  if (!ws) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { testId } = await context.params;
  const instituteId = ws.instituteId;
  if (!instituteId) {
    return NextResponse.json({ error: "Missing institute" }, { status: 403 });
  }

  const url = new URL(request.url);
  const topN = Math.min(50, Math.max(1, Number(url.searchParams.get("top") ?? 20)));

  const cached = listCachedSubmissions(instituteId, testId);
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
    flagged: c.flagged,
    score: c.score,
    resultBreakdown: c.resultBreakdown,
  }));

  const leaderboard = buildTestLeaderboard(testId, sessions, {}, topN);
  const selfRank =
    ws.role === "student"
      ? findStudentRank(testId, ws.userId, sessions)
      : null;

  return NextResponse.json({ testId, leaderboard, selfRank });
}
