import type { ExamDefinition, PersistedExamAttempt } from "@/types/exam";
import { logCbtWarning } from "@/lib/logging/runtime-logger";
import {
  getSafeFirstQuestionId,
  sanitizePersistedAttempt,
} from "@/lib/validation/exam-integrity";

export function canSubmitExam(params: {
  lifecyclePhase: string;
  submitInProgress: boolean;
  existingAttempt: PersistedExamAttempt | null;
}): boolean {
  if (params.submitInProgress) return false;
  if (params.lifecyclePhase === "submitted") return false;
  if (params.existingAttempt?.lifecycle === "submitted") return false;
  return true;
}

export function prepareResumeAttempt(
  attempt: PersistedExamAttempt,
  exam: ExamDefinition,
): PersistedExamAttempt | null {
  const sanitized = sanitizePersistedAttempt(attempt, exam);
  if (!sanitized) {
    logCbtWarning("resume rejected — corrupt or incompatible attempt");
    return null;
  }
  return sanitized;
}

export function ensureExamReadyForCbt(exam: ExamDefinition): boolean {
  const first = getSafeFirstQuestionId(exam);
  if (!first) {
    logCbtWarning("exam not ready — no valid first question", {
      examId: exam.id,
    });
    return false;
  }
  if (exam.sections.length === 0) {
    logCbtWarning("exam not ready — no sections", { examId: exam.id });
    return false;
  }
  return true;
}
