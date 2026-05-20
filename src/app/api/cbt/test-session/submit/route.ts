import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySignedAnswerKey } from "@/lib/cbt/answer-key";
import {
  computeIntegrityScore,
  isSessionFlagged,
} from "@/lib/cbt/integrity-engine";
import {
  CBT_TEST_TIMER_COOKIE,
  decodeTestTimerCookie,
} from "@/lib/cbt/test-session-token";
import { cacheCbtSubmission } from "@/lib/server/cbt-results-cache";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";
import { evaluateTestSession } from "@/services/test-evaluation";
import type {
  TestSessionIntegrityEvent,
  TestSessionStatus,
} from "@/types/test-session";

export async function POST(request: Request) {
  const ws = await readVerifiedWorkspaceSession();
  if (!ws || ws.role !== "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    testId: string;
    sessionId: string;
    instituteId: string;
    answers: Record<string, string | null>;
    signedAnswerKey: string;
    integrityEvents?: TestSessionIntegrityEvent[];
    status?: TestSessionStatus;
    submittedAt?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (
    !body.testId ||
    !body.sessionId ||
    !body.signedAnswerKey ||
    !body.instituteId
  ) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (body.instituteId !== ws.instituteId) {
    return NextResponse.json({ error: "Tenant mismatch" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const timerRaw = cookieStore.get(CBT_TEST_TIMER_COOKIE)?.value;
  const timer = decodeTestTimerCookie(timerRaw, { allowExpired: true });
  if (
    !timer ||
    timer.testId !== body.testId ||
    timer.sessionId !== body.sessionId ||
    timer.studentId !== ws.userId ||
    timer.instituteId !== ws.instituteId
  ) {
    return NextResponse.json({ error: "Invalid timer session" }, { status: 403 });
  }

  const answerKey = verifySignedAnswerKey(body.signedAnswerKey, body.testId);
  if (!answerKey) {
    return NextResponse.json({ error: "Invalid answer key token" }, { status: 400 });
  }

  const submittedAt = body.submittedAt ?? Date.now();
  const integrityEvents = body.integrityEvents ?? [];
  const integrityScore = computeIntegrityScore(integrityEvents);
  const flagged = isSessionFlagged(integrityScore);
  const resultBreakdown = evaluateTestSession({
    sessionId: body.sessionId,
    answers: body.answers ?? {},
    answerKey,
    startedAt: timer.startedAt,
    submittedAt,
    integrityEvents,
    useCache: false,
  });

  const status =
    body.status === "auto_submitted" ? "auto_submitted" : "submitted";

  cacheCbtSubmission({
    sessionId: body.sessionId,
    testId: body.testId,
    instituteId: body.instituteId,
    studentId: ws.userId,
    submittedAt,
    score: resultBreakdown.finalScore,
    maxScore: resultBreakdown.maxScore,
    durationSeconds: resultBreakdown.durationSeconds,
    flagged,
    integrityScore,
    resultBreakdown,
  });

  const res = NextResponse.json({
    status,
    score: resultBreakdown.finalScore,
    maxScore: resultBreakdown.maxScore,
    integrityScore,
    flagged,
    resultBreakdown,
  });
  res.cookies.delete(CBT_TEST_TIMER_COOKIE);
  return res;
}
