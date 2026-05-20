import {
  computeIntegrityScore,
  integrityPenaltyPoints,
} from "@/lib/cbt/integrity-engine";
import type {
  TestAnswerKey,
  TestResultBreakdown,
  TestSessionIntegrityEvent,
} from "@/types/test-session";

const evaluationCache = new Map<string, TestResultBreakdown>();

export function clearEvaluationCache(sessionId?: string): void {
  if (sessionId) evaluationCache.delete(sessionId);
  else evaluationCache.clear();
}

export function evaluateTestSession(input: {
  sessionId: string;
  answers: Record<string, string | null>;
  answerKey: TestAnswerKey;
  startedAt: number;
  submittedAt: number;
  integrityEvents?: TestSessionIntegrityEvent[];
  useCache?: boolean;
}): TestResultBreakdown {
  const { sessionId, useCache = true } = input;
  if (useCache) {
    const cached = evaluationCache.get(sessionId);
    if (cached) return cached;
  }

  const questionIds = Object.keys(input.answerKey);
  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;
  let rawScore = 0;
  let maxScore = 0;
  const perQuestion = questionIds.map((questionId) => {
    const key = input.answerKey[questionId];
    const selected = input.answers[questionId] ?? null;
    maxScore += key.marks;

    if (!selected) {
      unattempted += 1;
      return {
        questionId,
        selected,
        correct: false,
        marksAwarded: 0,
        maxMarks: key.marks,
      };
    }

    let isCorrect = false;
    if (key.type === "MCQ_SINGLE") {
      isCorrect = selected === key.correctOptionId;
    } else {
      const norm = (s: string) => s.trim().toLowerCase();
      isCorrect =
        key.correctNumericalAnswer != null &&
        norm(selected) === norm(key.correctNumericalAnswer);
    }

    let marksAwarded = 0;
    if (isCorrect) {
      correct += 1;
      marksAwarded = key.marks;
      rawScore += key.marks;
    } else {
      incorrect += 1;
      marksAwarded = key.negativeMarks > 0 ? -key.negativeMarks : 0;
      rawScore += marksAwarded;
    }

    return {
      questionId,
      selected,
      correct: isCorrect,
      marksAwarded,
      maxMarks: key.marks,
    };
  });

  const integrityScore = input.integrityEvents
    ? computeIntegrityScore(input.integrityEvents)
    : 100;
  const penalty = integrityPenaltyPoints(integrityScore, maxScore);
  const finalScore = Math.max(0, Math.round((rawScore - penalty) * 100) / 100);
  const durationSeconds = Math.max(
    0,
    Math.floor((input.submittedAt - input.startedAt) / 1000),
  );

  const breakdown: TestResultBreakdown = {
    correct,
    incorrect,
    unattempted,
    attempted: correct + incorrect,
    maxScore,
    rawScore: Math.round(rawScore * 100) / 100,
    integrityPenalty: penalty,
    finalScore,
    durationSeconds,
    perQuestion,
  };

  if (useCache) evaluationCache.set(sessionId, breakdown);
  return breakdown;
}
