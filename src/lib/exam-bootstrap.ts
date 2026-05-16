import { getExamById, getFirstQuestionId } from "@/data/mock-exams";
import { loadExamAttempt, saveExamAttempt } from "@/lib/persistence";
import { useExamLifecycleStore } from "@/stores/exam-lifecycle-store";
import { useExamSessionStore } from "@/stores/exam-session-store";
import { useQuestionStore } from "@/stores/question-store";
import { useTimerStore } from "@/stores/timer-store";
import type { PersistedExamAttempt } from "@/types/exam";

export type BootstrapResult =
  | { status: "not_found" }
  | { status: "already_submitted"; attempt: PersistedExamAttempt }
  | { status: "resumed"; attempt: PersistedExamAttempt }
  | { status: "started" };

export function bootstrapExamSession(
  examId: string,
  candidateRoll: string,
  startedAt: number,
): BootstrapResult {
  const exam = getExamById(examId);
  if (!exam) return { status: "not_found" };

  const existing = loadExamAttempt(examId, candidateRoll);

  if (existing?.lifecycle === "submitted") {
    return { status: "already_submitted", attempt: existing };
  }

  if (existing?.lifecycle === "in_progress") {
    useQuestionStore.getState().restoreState({
      exam,
      answers: existing.answers,
      visited: existing.visited,
      markedForReview: existing.markedForReview,
      currentQuestionId: existing.currentQuestionId,
      currentSectionId: existing.currentSectionId,
    });
    useTimerStore.getState().restore(existing.examEndsAt);
    useExamLifecycleStore.getState().setExamId(examId);
    useExamLifecycleStore.getState().setPhase("in_progress");
    useExamSessionStore
      .getState()
      .restoreViolations(existing.violations ?? []);
    return { status: "resumed", attempt: existing };
  }

  useExamSessionStore.getState().reset();

  const firstQuestionId = getFirstQuestionId(exam);
  useQuestionStore.getState().loadExam(exam, firstQuestionId);
  useTimerStore.getState().start(exam.durationMinutes);
  useExamLifecycleStore.getState().setExamId(examId);
  useExamLifecycleStore.getState().setPhase("in_progress");

  const examEndsAt = useTimerStore.getState().examEndsAt!;
  const attempt: PersistedExamAttempt = {
    version: 1,
    examId,
    candidateRoll,
    lifecycle: "in_progress",
    examEndsAt,
    startedAt,
    currentQuestionId: firstQuestionId,
    currentSectionId: exam.sections[0].id,
    answers: {},
    visited: { [firstQuestionId]: true },
    markedForReview: {},
    violations: [],
  };
  saveExamAttempt(attempt);

  return { status: "started" };
}
