import { createHmac, timingSafeEqual } from "crypto";
import { getSessionSecret } from "@/lib/session-crypto";
import type { ExamDefinition } from "@/types/exam";
import type { TestAnswerKey } from "@/types/test-session";

export function buildAnswerKeyFromExam(exam: ExamDefinition): TestAnswerKey {
  const key: TestAnswerKey = {};
  for (const qid of Object.keys(exam.questions)) {
    const q = exam.questions[qid];
    key[qid] = {
      type: q.type,
      correctOptionId: q.correctOptionId,
      correctNumericalAnswer: q.correctNumericalAnswer,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      bankQuestionId: q.bankQuestionId,
    };
  }
  return key;
}

function encodePayload(payload: string): string {
  return Buffer.from(payload, "utf8").toString("base64url");
}

export function signAnswerKey(answerKey: TestAnswerKey, testId: string): string {
  const body = JSON.stringify({ testId, answerKey });
  const payload = encodePayload(body);
  const sig = createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySignedAnswerKey(
  token: string,
  testId: string,
): TestAnswerKey | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { testId: string; answerKey: TestAnswerKey };
    if (parsed.testId !== testId) return null;
    return parsed.answerKey;
  } catch {
    return null;
  }
}
