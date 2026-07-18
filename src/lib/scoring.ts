import { isNumericalAnswerCorrect, isNumericalAnswerAttempted } from "@/lib/numerical";
import type {
  ExamDefinition,
  ExamQuestion,
  ExamResult,
  PersistedExamAttempt,
  SectionScore,
} from "@/types/exam";

function isAnswerAttempted(
  question: ExamQuestion,
  answer: string | null,
): boolean {
  const normalized = typeof answer === "string" ? answer.trim() : answer;
  if (!normalized) return false;
  if (question.type === "NUMERICAL") {
    return isNumericalAnswerAttempted(normalized);
  }
  return normalized.length > 0;
}

function isAnswerCorrect(question: ExamQuestion, answer: string): boolean {
  const normalized = answer.trim();
  if (question.type === "NUMERICAL") {
    return isNumericalAnswerCorrect(normalized, question.correctNumericalAnswer);
  }
  return normalized === question.correctOptionId;
}

export function computeExamResult(
  exam: ExamDefinition,
  attempt: PersistedExamAttempt,
  candidateName: string,
): ExamResult {
  const allQuestionIds = exam.sections.flatMap((s) => s.questionIds);
  let correct = 0;
  let incorrect = 0;
  let attempted = 0;
  let totalScore = 0;
  let maxScore = 0;

  const sectionScores: SectionScore[] = exam.sections.map((section) => {
    let sCorrect = 0;
    let sIncorrect = 0;
    let sAttempted = 0;
    let sScore = 0;

    for (const qId of section.questionIds) {
      const q = exam.questions[qId];
      if (!q) continue;
      maxScore += q.marks;
      const answer = attempt.answers[qId] ?? null;
      if (isAnswerAttempted(q, answer)) {
        sAttempted++;
        attempted++;
        if (isAnswerCorrect(q, answer!)) {
          sCorrect++;
          correct++;
          sScore += q.marks;
          totalScore += q.marks;
        } else {
          sIncorrect++;
          incorrect++;
          const penalty = Math.abs(q.negativeMarks || 0);
          sScore -= penalty;
          totalScore -= penalty;
        }
      }
    }

    return {
      sectionId: section.id,
      sectionName: section.name,
      total: section.questionIds.length,
      attempted: sAttempted,
      correct: sCorrect,
      incorrect: sIncorrect,
      unattempted: section.questionIds.length - sAttempted,
      score: Math.round(sScore * 100) / 100,
    };
  });

  const submittedAt = attempt.submittedAt ?? Date.now();
  const durationUsedSeconds = Math.min(
    exam.durationMinutes * 60,
    Math.max(0, Math.floor((submittedAt - attempt.startedAt) / 1000)),
  );

  return {
    examId: exam.id,
    examTitle: exam.title,
    candidateName,
    rollNumber: attempt.candidateRoll,
    submittedAt,
    durationUsedSeconds,
    totalQuestions: allQuestionIds.length,
    attempted,
    correct,
    incorrect,
    unattempted: allQuestionIds.length - attempted,
    totalScore: Math.round(totalScore * 100) / 100,
    maxScore,
    sectionScores,
    violationCount: attempt.violations?.length ?? 0,
  };
}
