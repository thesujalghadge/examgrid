"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ExamResult, PersistedExamAttempt } from "@/types/exam";
import { saveExamAttempt } from "@/lib/persistence";
import { logAutosaveFailure } from "@/lib/logging/runtime-logger";
import { parsePersistedExamAttempt } from "@/lib/validation/attempt-schema";
import { useAuthStore } from "@/stores/auth-store";
import { useExamLifecycleStore } from "@/stores/exam-lifecycle-store";
import { useExamSessionStore } from "@/stores/exam-session-store";
import { useQuestionStore } from "@/stores/question-store";
import { useTimerStore } from "@/stores/timer-store";

export function useExamPersistence() {
  const candidate = useAuthStore((s) => s.candidate);
  const phase = useExamLifecycleStore((s) => s.phase);
  const examId = useExamLifecycleStore((s) => s.examId);
  const exam = useQuestionStore((s) => s.exam);
  const answers = useQuestionStore((s) => s.answers);
  const visited = useQuestionStore((s) => s.visited);
  const markedForReview = useQuestionStore((s) => s.markedForReview);
  const currentQuestionId = useQuestionStore((s) => s.currentQuestionId);
  const currentSectionId = useQuestionStore((s) => s.currentSectionId);
  const violations = useExamSessionStore((s) => s.violations);
  const examEndsAt = useTimerStore((s) => s.examEndsAt);
  const startedAtRef = useRef<number>(0);
  const resultRef = useRef<ExamResult | undefined>(undefined);

  const setStartedAt = useCallback((ts: number) => {
    startedAtRef.current = ts;
  }, []);

  const setResult = useCallback((result: ExamResult | undefined) => {
    resultRef.current = result;
  }, []);

  const persistNow = useCallback(() => {
    if (
      !candidate ||
      !examId ||
      !exam ||
      !currentQuestionId ||
      !currentSectionId ||
      !examEndsAt
    ) {
      return;
    }

    if (!exam.questions[currentQuestionId]) {
      return;
    }

    const attempt: PersistedExamAttempt = {
      version: 1,
      examId,
      candidateRoll: candidate.rollNumber,
      lifecycle: phase,
      examEndsAt,
      startedAt: startedAtRef.current,
      currentQuestionId,
      currentSectionId,
      answers,
      visited,
      markedForReview,
      violations,
      submittedAt: phase === "submitted" ? Date.now() : undefined,
      result: resultRef.current,
    };

    const valid = parsePersistedExamAttempt(attempt);
    if (!valid.success) {
      logAutosaveFailure(examId, valid.error);
      return;
    }

    const ok = saveExamAttempt(valid.data);
    if (!ok) {
      logAutosaveFailure(examId, "saveExamAttempt returned false");
    }
  }, [
    candidate,
    examId,
    exam,
    currentQuestionId,
    currentSectionId,
    examEndsAt,
    phase,
    answers,
    visited,
    markedForReview,
    violations,
  ]);

  useEffect(() => {
    if (phase !== "in_progress" && phase !== "submitted") return;
    persistNow();
  }, [
    phase,
    answers,
    visited,
    markedForReview,
    violations,
    currentQuestionId,
    currentSectionId,
    examEndsAt,
    persistNow,
  ]);

  return { persistNow, setStartedAt, setResult };
}
