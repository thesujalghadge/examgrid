import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySignedAnswerKey } from "@/lib/cbt/answer-key";
import {
  computeIntegrityScore,
  isSessionFlagged,
} from "@/lib/cbt/integrity-engine";
import { logCbtGuard, logCbtWarning, logSessionWarning } from "@/lib/logging/runtime-logger";
import {
  CBT_TEST_TIMER_COOKIE,
  decodeTestTimerCookie,
} from "@/lib/cbt/test-session-token";
import { saveCbtSubmission } from "@/lib/server/cbt-submissions-store";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";
import { evaluateTestSession } from "@/services/test-evaluation";
import type {
  TestSessionIntegrityEvent,
} from "@/types/test-session";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const integrityEventSchema = z.object({
  type: z.enum([
    "tab_switch",
    "fullscreen_exit",
    "window_blur",
    "copy_attempt",
    "paste_attempt",
    "rapid_navigation",
    "browser_back",
  ]),
  at: z.number().int().nonnegative(),
  meta: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

const submitSessionSchema = z.object({
  testId: z.string().min(1).max(120),
  sessionId: z.string().min(1).max(120),
  instituteId: z.string().min(1).max(120),
  answers: z.record(z.string(), z.union([z.string().max(200), z.null()])),
  signedAnswerKey: z.string().min(1),
  integrityEvents: z.array(integrityEventSchema).max(250).optional(),
  status: z.enum(["in_progress", "submitted", "auto_submitted"]).optional(),
  submittedAt: z.number().int().nonnegative().optional(),
});

import { createSupabaseClientFromEnv } from "@/lib/supabase/client";

export async function POST(request: Request) {
  require('fs').appendFileSync('cbt_submit_debug.log', `[${new Date().toISOString()}] POST /submit reached\n`);
  const ws = await readVerifiedWorkspaceSession();
  if (!ws || ws.role !== "student") {
    require('fs').appendFileSync('cbt_submit_debug.log', `[${new Date().toISOString()}] Failed: Unauthorized (ws: ${JSON.stringify(ws)})\n`);
    logSessionWarning("cbt submit denied", { reason: "unauthorized" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    require('fs').appendFileSync('cbt_submit_debug.log', `[${new Date().toISOString()}] Failed: Invalid JSON\n`);
    logCbtWarning("cbt submit rejected", { reason: "invalid_json", userId: ws.userId });
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = submitSessionSchema.safeParse(payload);
  if (!parsed.success) {
    require('fs').appendFileSync('cbt_submit_debug.log', `[${new Date().toISOString()}] Failed: Invalid Payload\n`);
    logCbtWarning("cbt submit rejected", {
      reason: "invalid_payload",
      userId: ws.userId,
      issues: parsed.error.issues.map((issue) => issue.message),
    });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;

  if (body.instituteId !== ws.instituteId) {
    require('fs').appendFileSync('cbt_submit_debug.log', `[${new Date().toISOString()}] Failed: Tenant mismatch\n`);
    logSessionWarning("cbt submit denied", {
      reason: "tenant_mismatch",
      userId: ws.userId,
      expectedInstituteId: ws.instituteId,
      receivedInstituteId: body.instituteId,
      testId: body.testId,
    });
    return NextResponse.json({ error: "Tenant mismatch" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const timerRaw = cookieStore.get(CBT_TEST_TIMER_COOKIE)?.value;
  const timer = decodeTestTimerCookie(timerRaw ? decodeURIComponent(timerRaw) : null, {
    allowExpired: true,
  });
  if (
    !timer ||
    timer.testId !== body.testId ||
    timer.sessionId !== body.sessionId ||
    timer.studentId !== ws.userId ||
    timer.instituteId !== ws.instituteId
  ) {
    require('fs').appendFileSync('cbt_submit_debug.log', `[${new Date().toISOString()}] Failed: Invalid timer session\n`);
    logSessionWarning("cbt submit denied", {
      reason: "invalid_timer_session",
      userId: ws.userId,
      testId: body.testId,
      sessionId: body.sessionId,
    });
    return NextResponse.json({ error: "Invalid timer session" }, { status: 403 });
  }

  const answerKey = verifySignedAnswerKey(body.signedAnswerKey, body.testId);
  if (!answerKey) {
    require('fs').appendFileSync('cbt_submit_debug.log', `[${new Date().toISOString()}] Failed: Invalid answer key signature\n`);
    logCbtWarning("cbt submit rejected", {
      reason: "invalid_answer_key_signature",
      testId: body.testId,
      studentId: ws.userId,
      sessionId: body.sessionId,
    });
    require('fs').writeFileSync('cbt_submit_log.txt', 'Submit Error: Invalid answer key token');
    return NextResponse.json({ error: "Invalid answer key token" }, { status: 400 });
  }

  const normalizedAnswers = Object.fromEntries(
    Object.entries(body.answers)
      .filter(([questionId]) => questionId in answerKey)
      .map(([questionId, value]) => [
        questionId,
        typeof value === "string" ? value.trim().slice(0, 200) : null,
      ]),
  );
  
  require('fs').appendFileSync('cbt_submit_debug.log', `[${new Date().toISOString()}] SUBMIT DIAGNOSTICS:\nbody.answers keys: ${Object.keys(body.answers).length}\nanswerKey keys: ${Object.keys(answerKey).length}\nnormalizedAnswers keys: ${Object.keys(normalizedAnswers).length}\n`);
  const integrityEvents: TestSessionIntegrityEvent[] = (body.integrityEvents ?? [])
    .filter((event) => event.at >= timer.startedAt && event.at <= Date.now() + 60_000)
    .sort((left, right) => left.at - right.at);
  const submittedAt = Math.min(
    Math.max(body.submittedAt ?? Date.now(), timer.startedAt),
    Date.now() + 60_000,
  );
  const integrityScore = computeIntegrityScore(integrityEvents);
  const flagged = isSessionFlagged(integrityScore);
  const resultBreakdown = evaluateTestSession({
    sessionId: body.sessionId,
    answers: normalizedAnswers,
    answerKey,
    startedAt: timer.startedAt,
    submittedAt,
    integrityEvents,
    useCache: false,
  });

  const status: "submitted" | "auto_submitted" =
    body.status === "auto_submitted" ? "auto_submitted" : "submitted";

  const submission = {
    sessionId: body.sessionId,
    testId: body.testId,
    instituteId: body.instituteId,
    studentId: ws.userId,
    status,
    startedAt: timer.startedAt,
    submittedAt,
    score: resultBreakdown.finalScore,
    maxScore: resultBreakdown.maxScore,
    durationSeconds: resultBreakdown.durationSeconds,
    flagged,
    integrityScore,
    answers: normalizedAnswers,
    resultBreakdown,
  };

  try {
    require('fs').appendFileSync('cbt_submit_debug.log', `[${new Date().toISOString()}] Calling saveCbtSubmission\n`);
    await saveCbtSubmission(submission);
    require('fs').appendFileSync('cbt_submit_debug.log', `[${new Date().toISOString()}] saveCbtSubmission SUCCESS\n`);
    require('fs').writeFileSync('cbt_submit_log.txt', 'Submit Success!');
  } catch (error) {
    require('fs').appendFileSync('cbt_submit_debug.log', `[${new Date().toISOString()}] Failed: saveCbtSubmission threw error: ${error instanceof Error ? error.message : "unknown"}\n`);
    require('fs').writeFileSync('cbt_submit_log.txt', 'Submit Error: ' + (error instanceof Error ? error.message : "unknown"));
    logCbtWarning("cbt submit persistence failed", {
      testId: body.testId,
      sessionId: body.sessionId,
      studentId: ws.userId,
      instituteId: body.instituteId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Submission could not be saved. Retrying is safe." },
      { status: 503 },
    );
  }

  logCbtGuard("cbt submit accepted", {
    testId: body.testId,
    sessionId: body.sessionId,
    studentId: ws.userId,
    instituteId: body.instituteId,
    status,
    answeredCount: Object.values(normalizedAnswers).filter((value) => value !== null).length,
    integrityEvents: integrityEvents.length,
    integrityScore,
    flagged,
    score: resultBreakdown.finalScore,
  });

  require('fs').appendFileSync('cbt_submit_debug.log', `[${new Date().toISOString()}] POST /submit Completed successfully\n`);
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
