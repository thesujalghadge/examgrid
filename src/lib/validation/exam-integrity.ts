import type { ExamDefinition, PersistedExamAttempt } from "@/types/exam";
import { logValidationFailure } from "@/lib/logging/runtime-logger";
import { parseExamDefinition } from "@/lib/validation/exam-schema";

export interface ExamIntegrityResult {
  valid: boolean;
  errors: string[];
}

export function validateExamStructure(
  exam: ExamDefinition,
): ExamIntegrityResult {
  const parsed = parseExamDefinition(exam);
  if (!parsed.success) {
    return { valid: false, errors: [parsed.error] };
  }

  const errors: string[] = [];
  const questionIds = new Set(Object.keys(exam.questions));

  for (const section of exam.sections) {
    if (!section.name.trim()) {
      errors.push(`Section ${section.id}: missing name`);
    }
    for (const qid of section.questionIds) {
      if (!questionIds.has(qid)) {
        errors.push(
          `Section ${section.id}: question ${qid} not in questions map`,
        );
      }
    }
  }

  for (const qid of questionIds) {
    const q = exam.questions[qid];
    if (q.sectionId && !exam.sections.some((s) => s.id === q.sectionId)) {
      errors.push(`Question ${qid}: unknown sectionId ${q.sectionId}`);
    }
  }

  if (exam.sections.length === 0) {
    errors.push("Exam has no sections");
  }

  return { valid: errors.length === 0, errors };
}

export function getSafeFirstQuestionId(exam: ExamDefinition): string | null {
  const firstSection = exam.sections[0];
  if (!firstSection?.questionIds.length) return null;
  const qid = firstSection.questionIds[0];
  if (!exam.questions[qid]) return null;
  return qid;
}

export function sanitizePersistedAttempt(
  attempt: PersistedExamAttempt,
  exam: ExamDefinition,
): PersistedExamAttempt | null {
  if (attempt.examId !== exam.id) {
    logValidationFailure("attempt", "examId mismatch");
    return null;
  }

  const integrity = validateExamStructure(exam);
  if (!integrity.valid) {
    logValidationFailure("exam", integrity.errors.join("; "));
    return null;
  }

  let currentQuestionId = attempt.currentQuestionId;
  let currentSectionId = attempt.currentSectionId;

  if (!exam.questions[currentQuestionId]) {
    const fallback = getSafeFirstQuestionId(exam);
    if (!fallback) return null;
    logValidationFailure(
      "attempt",
      `invalid currentQuestionId ${currentQuestionId}, reset to ${fallback}`,
    );
    currentQuestionId = fallback;
    currentSectionId =
      exam.sections.find((s) => s.questionIds.includes(fallback))?.id ??
      exam.sections[0].id;
  }

  if (!exam.sections.some((s) => s.id === currentSectionId)) {
    currentSectionId =
      exam.sections.find((s) =>
        s.questionIds.includes(currentQuestionId),
      )?.id ?? exam.sections[0].id;
  }

  const validQuestionIds = new Set(Object.keys(exam.questions));
  const filterRecord = <T>(rec: Record<string, T>): Record<string, T> => {
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (validQuestionIds.has(k)) out[k] = v;
    }
    return out;
  };

  return {
    ...attempt,
    currentQuestionId,
    currentSectionId,
    answers: filterRecord(attempt.answers),
    visited: filterRecord(attempt.visited),
    markedForReview: filterRecord(attempt.markedForReview),
  };
}
