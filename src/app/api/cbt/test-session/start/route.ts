import { NextResponse } from "next/server";
import { buildAnswerKeyFromExam, signAnswerKey, verifySignedAnswerKey } from "@/lib/cbt/answer-key";
import { getExamByIdServer } from "@/lib/exam-catalog";
import { logCbtGuard, logCbtWarning, logSessionWarning } from "@/lib/logging/runtime-logger";
import {
  CBT_TEST_TIMER_COOKIE,
  encodeTestTimerCookie,
} from "@/lib/cbt/test-session-token";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";
import type { TestAnswerKey, TestSessionTimerClaims } from "@/types/test-session";
import { z } from "zod";

export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

const startSessionSchema = z.object({
  testId: z.string().min(1).max(120),
  durationMinutes: z.number().int().min(1).max(360),
  sessionId: z.string().min(1).max(120),
  instituteId: z.string().min(1).max(120),
  answerKey: z.record(z.string(), z.object({
    type: z.enum(["MCQ_SINGLE", "NUMERICAL"]),
    correctOptionId: z.string().optional(),
    correctNumericalAnswer: z.string().optional(),
    marks: z.number().nonnegative(),
    negativeMarks: z.number().nonnegative(),
  })).optional(),
});

export async function POST(request: Request) {
  const ws = await readVerifiedWorkspaceSession();
  if (!ws || ws.role !== "student") {
    logSessionWarning("cbt start denied", { reason: "unauthorized" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    logCbtWarning("cbt start rejected", { reason: "invalid_json", userId: ws.userId });
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = startSessionSchema.safeParse(payload);
  if (!parsed.success) {
    logCbtWarning("cbt start rejected", {
      reason: "invalid_payload",
      userId: ws.userId,
      issues: parsed.error.issues.map((issue) => issue.message),
    });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;

  if (body.instituteId !== ws.instituteId) {
    logSessionWarning("cbt start denied", {
      reason: "tenant_mismatch",
      userId: ws.userId,
      expectedInstituteId: ws.instituteId,
      receivedInstituteId: body.instituteId,
      testId: body.testId,
    });
    return NextResponse.json({ error: "Tenant mismatch" }, { status: 403 });
  }

  const authoritativeExam = await getExamByIdServer(body.testId);
  const durationMinutes = authoritativeExam?.durationMinutes ?? body.durationMinutes;
  const startedAt = Date.now();
  const endsAt = startedAt + durationMinutes * 60 * 1000;
  const claims: TestSessionTimerClaims = {
    testId: body.testId,
    studentId: ws.userId,
    instituteId: ws.instituteId!,
    startedAt,
    endsAt,
    sessionId: body.sessionId,
  };

  let signedAnswerKey: string | undefined;
  const answerKey: TestAnswerKey | undefined = authoritativeExam
    ? buildAnswerKeyFromExam(authoritativeExam)
    : body.answerKey;
  
  require('fs').writeFileSync('cbt_start_log.txt', 'AnswerKey: ' + JSON.stringify(answerKey));

  if (answerKey && Object.keys(answerKey).length > 0) {
    signedAnswerKey = signAnswerKey(answerKey, body.testId);
    if (!verifySignedAnswerKey(signedAnswerKey, body.testId)) {
      logCbtWarning("cbt start rejected", {
        reason: "answer_key_signature_verification_failed",
        testId: body.testId,
        studentId: ws.userId,
      });
      return NextResponse.json({ error: "Invalid answer key" }, { status: 400 });
    }
  }

  if (!authoritativeExam) {
    logCbtWarning("cbt start used fallback answer key source", {
      testId: body.testId,
      studentId: ws.userId,
      instituteId: ws.instituteId,
      source: body.answerKey ? "client_payload" : "none",
    });
  } else if (durationMinutes !== body.durationMinutes) {
    logCbtGuard("cbt start normalized duration from exam catalog", {
      testId: body.testId,
      studentId: ws.userId,
      requestedDurationMinutes: body.durationMinutes,
      authoritativeDurationMinutes: durationMinutes,
    });
  }

  const token = encodeTestTimerCookie(claims);
  const res = NextResponse.json({
    startedAt,
    endsAt,
    remainingSeconds: Math.max(0, Math.floor((endsAt - Date.now()) / 1000)),
    signedAnswerKey,
  });
  res.cookies.set(CBT_TEST_TIMER_COOKIE, token, {
    ...COOKIE_OPTS,
    maxAge: Math.max(1, Math.floor((endsAt - Date.now()) / 1000)) + 86400, // +24h to survive auto-submit
  });
  logCbtGuard("cbt start issued timer", {
    testId: body.testId,
    studentId: ws.userId,
    instituteId: ws.instituteId,
    sessionId: body.sessionId,
    durationMinutes,
    answerKeyMode: authoritativeExam ? "server_exam" : body.answerKey ? "client_fallback" : "none",
  });
  return res;
}
