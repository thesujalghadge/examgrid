import fs from "fs";

let content = fs.readFileSync("src/lib/exam-bootstrap.ts", "utf-8");

content = content.replace(
  `export type BootstrapResult =
  | { status: "not_found" }
  | { status: "already_submitted"; attempt: PersistedExamAttempt }
  | { status: "resumed"; attempt: PersistedExamAttempt }
  | { status: "started" };`,
  `export type BootstrapResult =
  | { status: "not_found" }
  | { status: "already_submitted"; attempt: PersistedExamAttempt }
  | { status: "resumed"; attempt: PersistedExamAttempt }
  | { status: "instructions" }
  | { status: "started" };`
);

const oldInit = `  useQuestionStore.getState().loadExam(exam, firstQuestionId);
  useTimerStore
    .getState()
    .start(activeSchedule?.durationMinutes ?? exam.durationMinutes);
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

  return { status: "started" };
}`;

const newInit = `  useQuestionStore.getState().loadExam(exam, firstQuestionId);
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
}`;

content = content.replace(oldInit.replace(/\r\n/g, '\n'), newInit);
content = content.replace(oldInit, newInit);

fs.writeFileSync("src/lib/exam-bootstrap.ts", content);
console.log("Updated exam-bootstrap.ts");
