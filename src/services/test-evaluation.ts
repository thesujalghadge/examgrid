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
  telemetry?: {
    timeSpentSeconds?: Record<string, number>;
    visitedCount?: Record<string, number>;
    answerChangedCount?: Record<string, number>;
    firstAnswer?: Record<string, string | null>;
  };
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
  let negativeMarksTotal = 0;
  const perQuestion = questionIds.map((questionId) => {
    const key = input.answerKey[questionId];
    const selected = input.answers[questionId] ?? null;
    maxScore += key.marks;

    if (!selected) {
      unattempted += 1;
      return {
        questionId,
        bankQuestionId: key.bankQuestionId ?? null,
        legacyClientKey: questionId,
        selected,
        correct: false,
        marksAwarded: 0,
        maxMarks: key.marks,
        timeSpentSeconds: input.telemetry?.timeSpentSeconds?.[questionId] ?? 0,
        visitedCount: input.telemetry?.visitedCount?.[questionId] ?? 0,
        answerChangedCount: input.telemetry?.answerChangedCount?.[questionId] ?? 0,
        firstAnswer: input.telemetry?.firstAnswer?.[questionId] ?? null,
      };
    }

    let isCorrect = false;
    if (key.type === "MCQ_SINGLE") {
      isCorrect = selected === key.correctOptionId;
      if (!isCorrect && key.correctOptionId) {
        const selectedLabel = optionLabelFromAnswer(selected);
        const correctLabel = optionLabelFromAnswer(key.correctOptionId);
        isCorrect = Boolean(selectedLabel && correctLabel && selectedLabel === correctLabel);
      }
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
      const penalty = Math.abs(key.negativeMarks || 0);
      marksAwarded = penalty > 0 ? -penalty : 0;
      if (marksAwarded < 0) {
        negativeMarksTotal += penalty;
      }
      rawScore += marksAwarded;
    }

    return {
      questionId,
      bankQuestionId: key.bankQuestionId ?? null,
      legacyClientKey: questionId,
      selected,
      correct: isCorrect,
      marksAwarded,
      maxMarks: key.marks,
      timeSpentSeconds: input.telemetry?.timeSpentSeconds?.[questionId] ?? 0,
      visitedCount: input.telemetry?.visitedCount?.[questionId] ?? 0,
      answerChangedCount: input.telemetry?.answerChangedCount?.[questionId] ?? 0,
      firstAnswer: input.telemetry?.firstAnswer?.[questionId] ?? null,
    };
  });

  const integrityScore = input.integrityEvents
    ? computeIntegrityScore(input.integrityEvents)
    : 100;
  const penalty = integrityPenaltyPoints(integrityScore, maxScore);
  const hasNegativeMarking = Object.values(input.answerKey).some((k) => k.negativeMarks > 0);
  const calculatedScore = Math.round((rawScore - penalty) * 100) / 100;
  const finalScore = hasNegativeMarking ? calculatedScore : Math.max(0, calculatedScore);
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
    negativeMarks: Math.round(negativeMarksTotal * 100) / 100,
    integrityPenalty: penalty,
    finalScore,
    durationSeconds,
    perQuestion,
  };

  if (useCache) evaluationCache.set(sessionId, breakdown);
  return breakdown;
}

function optionLabelFromAnswer(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  if (/^[A-D]$/.test(normalized)) return normalized;
  const numericLabels: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D" };
  if (numericLabels[normalized]) return numericLabels[normalized];
  const match = normalized.match(/-OPT-([A-D])$/);
  return match?.[1] ?? null;
}
