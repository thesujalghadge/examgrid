import { NextResponse } from "next/server";
import { signAnswerKey, verifySignedAnswerKey } from "@/lib/cbt/answer-key";
import {
  CBT_TEST_TIMER_COOKIE,
  encodeTestTimerCookie,
} from "@/lib/cbt/test-session-token";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";
import type { TestAnswerKey, TestSessionTimerClaims } from "@/types/test-session";

const COOKIE_OPTS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

export async function POST(request: Request) {
  const ws = await readVerifiedWorkspaceSession();
  if (!ws || ws.role !== "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    testId: string;
    durationMinutes: number;
    sessionId: string;
    instituteId: string;
    answerKey?: TestAnswerKey;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.testId || !body.sessionId || !body.durationMinutes) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (body.instituteId !== ws.instituteId) {
    return NextResponse.json({ error: "Tenant mismatch" }, { status: 403 });
  }

  const startedAt = Date.now();
  const endsAt = startedAt + body.durationMinutes * 60 * 1000;
  const claims: TestSessionTimerClaims = {
    testId: body.testId,
    studentId: ws.userId,
    instituteId: ws.instituteId!,
    startedAt,
    endsAt,
    sessionId: body.sessionId,
  };

  let signedAnswerKey: string | undefined;
  if (body.answerKey && Object.keys(body.answerKey).length > 0) {
    signedAnswerKey = signAnswerKey(body.answerKey, body.testId);
    if (!verifySignedAnswerKey(signedAnswerKey, body.testId)) {
      return NextResponse.json({ error: "Invalid answer key" }, { status: 400 });
    }
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
    maxAge: Math.max(1, Math.floor((endsAt - Date.now()) / 1000)),
  });
  return res;
}
