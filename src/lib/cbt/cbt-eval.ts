import { isNumericalAnswerCorrect, isNumericalAnswerAttempted } from "@/lib/numerical";
import type { ExamDefinition, ExamQuestion, PersistedExamAttempt } from "@/types/exam";
import type { StudentResponse } from "@/types/cbt";
import { makeCbtId } from "@/lib/cbt/cbt-ids";

function responseCorrect(q: ExamQuestion, answer: string | null): boolean {
  const normalized = typeof answer === "string" ? answer.trim() : answer;
  if (!normalized) return false;
  if (q.type === "NUMERICAL") {
    if (!isNumericalAnswerAttempted(normalized)) return false;
    return isNumericalAnswerCorrect(normalized, q.correctNumericalAnswer);
  }
  return normalized === q.correctOptionId;
}

export function buildStudentResponsesFromAttempt(
  exam: ExamDefinition,
  attempt: PersistedExamAttempt,
  attemptId: string,
): StudentResponse[] {
  const ids = exam.sections.flatMap((s) => s.questionIds);
  return ids.map((questionId) => {
    const q = exam.questions[questionId];
    const selected = attempt.answers[questionId] ?? null;
    return {
      id: makeCbtId("resp"),
      attemptId,
      questionId,
      selectedOption: typeof selected === "string" && selected.trim().length === 0 ? null : selected,
      isCorrect: q ? responseCorrect(q, selected) : false,
    };
  });
}
