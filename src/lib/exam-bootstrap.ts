import { getExamById } from "@/lib/exam-catalog";
import {
  clearExamAttempt,
  loadExamAttempt,
  saveExamAttempt,
} from "@/lib/persistence";
import {
  ensureExamReadyForCbt,
  prepareResumeAttempt,
} from "@/lib/cbt/session-safety";
import { logCbtGuard, logCbtWarning } from "@/lib/logging/runtime-logger";
import { useExamLifecycleStore } from "@/stores/exam-lifecycle-store";
import { useExamSessionStore } from "@/stores/exam-session-store";
import { useQuestionStore } from "@/stores/question-store";
import { useTimerStore } from "@/stores/timer-store";
import type { PersistedExamAttempt } from "@/types/exam";
import {
  getActiveScheduleForRoll,
  isOperationalSchedulingActive,
} from "@/services/institute-ops-service";
import { getOrCreateSessionId, recordAuditEvent } from "@/services/audit-service";
import { STORAGE_KEYS } from "@/repositories/storage-keys";
import { getSafeFirstQuestionId } from "@/lib/validation/exam-integrity";

const ACTIVE_EXAM_SESSION_TTL_MS = 6 * 60 * 60 * 1000;

function registerActiveExamSession(examId: string, candidateRoll: string): void {
  if (typeof window === "undefined") return;
  const key = `${examId}:${candidateRoll}`;
  const sessionId = getOrCreateSessionId();
  const now = Date.now();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.activeExamSessions);
    const sessions = raw
      ? (JSON.parse(raw) as Record<string, { sessionId: string; updatedAt: number }>)
      : {};
    for (const [id, value] of Object.entries(sessions)) {
      if (now - value.updatedAt > ACTIVE_EXAM_SESSION_TTL_MS) delete sessions[id];
    }
    const existing = sessions[key];
    if (
      existing &&
      existing.sessionId !== sessionId &&
      now - existing.updatedAt < 30_000
    ) {
      recordAuditEvent({
        actorId: candidateRoll,
        actorRole: "student",
        actionType: "operation_blocked",
        resourceType: "exam_session",
        resourceId: key,
        metadata: { reason: "duplicate_session_detected" },
        outcome: "warning",
      });
    }
    sessions[key] = { sessionId, updatedAt: now };
    localStorage.setItem(STORAGE_KEYS.activeExamSessions, JSON.stringify(sessions));
  } catch {
    localStorage.removeItem(STORAGE_KEYS.activeExamSessions);
  }
}

export type BootstrapResult =
  | { status: "not_found" }
  | { status: "already_submitted"; attempt: PersistedExamAttempt }
  | { status: "resumed"; attempt: PersistedExamAttempt }
  | { status: "instructions" }
  | { status: "started" };

export function bootstrapExamSession(
  examId: string,
  candidateRoll: string,
  startedAt: number,
): BootstrapResult {
  const exam = getExamById(examId);
  if (!exam || !ensureExamReadyForCbt(exam)) {
    return { status: "not_found" };
  }

  const activeSchedule = getActiveScheduleForRoll(examId, candidateRoll);
  if (isOperationalSchedulingActive() && !activeSchedule) {
    return { status: "not_found" };
  }

  const existing = loadExamAttempt(examId, candidateRoll);
  registerActiveExamSession(examId, candidateRoll);

  if (existing?.lifecycle === "submitted") {
    logCbtGuard("attempt already submitted", { examId, candidateRoll });
    return { status: "already_submitted", attempt: existing };
  }

  if (existing?.lifecycle === "in_progress") {
    const sanitized = prepareResumeAttempt(existing, exam);
    if (!sanitized) {
      clearExamAttempt(examId, candidateRoll);
      logCbtGuard("corrupt attempt cleared — starting fresh", { examId });
    } else {
      useQuestionStore.getState().restoreState({
        exam,
        answers: sanitized.answers,
        visited: sanitized.visited,
        markedForReview: sanitized.markedForReview,
        currentQuestionId: sanitized.currentQuestionId,
        currentSectionId: sanitized.currentSectionId,
      });
      useTimerStore.getState().restore(sanitized.examEndsAt);
      useExamLifecycleStore.getState().setExamId(examId);
      useExamLifecycleStore.getState().setPhase("in_progress");
      useExamSessionStore
        .getState()
        .restoreViolations(sanitized.violations ?? []);
      logCbtGuard("exam attempt resumed", {
        examId,
        candidateRoll,
        startedAt: sanitized.startedAt,
        examEndsAt: sanitized.examEndsAt,
      });
      return { status: "resumed", attempt: sanitized };
    }
  }

  useExamSessionStore.getState().reset();

  const firstQuestionId = getSafeFirstQuestionId(exam);
  if (!firstQuestionId) {
    return { status: "not_found" };
  }
  useQuestionStore.getState().loadExam(exam, firstQuestionId);
  useExamLifecycleStore.getState().setExamId(examId);
  useExamLifecycleStore.getState().setPhase("instructions_viewed");

  return { status: "instructions" };
}

export function startExamAttempt(
  examId: string,
  candidateRoll: string,
  startedAt: number,
) {
  const exam = getExamById(examId);
  if (!exam) return;
  const activeSchedule = getActiveScheduleForRoll(examId, candidateRoll);
  const firstQuestionId = getSafeFirstQuestionId(exam)!;

  useTimerStore
    .getState()
    .start(activeSchedule?.durationMinutes ?? exam.durationMinutes);
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
  const saved = saveExamAttempt(attempt);
  if (!saved) {
    logCbtWarning("initial exam attempt save failed", { examId, candidateRoll });
  } else {
    logCbtGuard("exam attempt started", {
      examId,
      candidateRoll,
      startedAt,
      examEndsAt,
    });
  }
}
