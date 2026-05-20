import { buildStudentResponsesFromAttempt } from "@/lib/cbt/cbt-eval";
import { makeCbtId } from "@/lib/cbt/cbt-ids";
import { logCbtGuard, logCbtWarning } from "@/lib/logging/runtime-logger";
import { getRepositories } from "@/lib/repositories/provider";
import type { CbtFinalAttempt, StudentAttempt } from "@/types/cbt";
import type { ExamDefinition, PersistedExamAttempt } from "@/types/exam";

export function persistCbtFinalAttempt(
  exam: ExamDefinition,
  attempt: PersistedExamAttempt,
  instituteId: string,
): void {
  const test = getRepositories().cbtTests.getById(exam.id);
  if (!test) {
    logCbtWarning("final CBT attempt skipped because test metadata was missing", {
      examId: exam.id,
      candidateRoll: attempt.candidateRoll,
    });
    return;
  }

  const attemptId = makeCbtId("cbt-att");
  const responses = buildStudentResponsesFromAttempt(exam, attempt, attemptId);
  const score = attempt.result?.totalScore;

  const entity: StudentAttempt = {
    id: attemptId,
    testId: test.id,
    studentId: attempt.candidateRoll,
    instituteId,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt ?? Date.now(),
    score,
  };

  const record: CbtFinalAttempt = { attempt: entity, responses };
  getRepositories().cbtAttempts.save(record);
  logCbtGuard("final CBT attempt persisted", {
    testId: test.id,
    studentId: entity.studentId,
    instituteId,
    responseCount: responses.length,
    submittedAt: entity.submittedAt,
  });
}
