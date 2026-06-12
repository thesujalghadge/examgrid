import { getRepositories } from "@/lib/repositories/provider";
import { getQuestionBank } from "@/services/question-bank-service";

type WeakArea = {
  label: string;
  misses: number;
};

export interface StudentInsights {
  completedCount: number;
  upcomingCount: number;
  averageScore: number;
  bestScore: number;
  lastScore: number;
  averageDurationMinutes: number;
  weakAreas: WeakArea[];
  recentResults: Array<{
    testId: string;
    title: string;
    score: number;
    attempted: number;
    correct: number;
    durationSeconds: number;
    submittedAt: number;
    integrityScore?: number;
    flagged?: boolean;
  }>;
}

export function buildStudentInsights(
  rollNumber: string,
  instituteId: string,
): StudentInsights {
  const repos = getRepositories();
  const questionBank = new Map(getQuestionBank().map((question) => [question.id, question]));
  const tests = new Map(repos.cbtTests.list().map((test) => [test.id, test]));
  const sessions = repos.testSessions
    .list()
    .filter(
      (session) =>
        session.studentId === rollNumber &&
        session.instituteId === instituteId &&
        (session.status === "submitted" || session.status === "auto_submitted"),
    )
    .sort((a, b) => b.startedAt - a.startedAt);
  const schedules = repos.schedules.list().filter((schedule) => schedule.instituteId === instituteId);

  const weakAreaMap = new Map<string, number>();

  for (const session of sessions) {
    const test = tests.get(session.testId);
    const sectionNameById = new Map(test?.sections.map((section) => [section.id, section.name]) ?? []);
    const testQuestionById = new Map(test?.questions.map((question) => [question.questionId, question]) ?? []);

    for (const result of session.resultBreakdown?.perQuestion ?? []) {
      if (result.correct) continue;
      const testQuestion = testQuestionById.get(result.questionId);
      if (!testQuestion) continue;
      const bankQuestion = testQuestion.bankQuestionId
        ? questionBank.get(testQuestion.bankQuestionId)
        : null;
      const label = bankQuestion
        ? `${bankQuestion.subject} - ${bankQuestion.chapter}`
        : sectionNameById.get(testQuestion.sectionId) ?? "Manual section";
      weakAreaMap.set(label, (weakAreaMap.get(label) ?? 0) + 1);
    }
  }

  const recentResults = sessions.map((session) => ({
    testId: session.testId,
    title: tests.get(session.testId)?.title ?? session.testId,
    score: session.resultBreakdown?.finalScore ?? 0,
    attempted: session.resultBreakdown?.attempted ?? 0,
    correct: session.resultBreakdown?.correct ?? 0,
    durationSeconds: session.resultBreakdown?.durationSeconds ?? 0,
    submittedAt: session.lastSavedAt,
    integrityScore: session.integrityScore,
    flagged: session.flagged,
  }));

  const averageScore =
    recentResults.length > 0
      ? recentResults.reduce((sum, result) => sum + result.score, 0) / recentResults.length
      : 0;
  const averageDurationMinutes =
    recentResults.length > 0
      ? recentResults.reduce((sum, result) => sum + result.durationSeconds, 0) /
        recentResults.length /
        60
      : 0;

  const now = Date.now();
  const upcomingCount = schedules.filter(
    (schedule) =>
      schedule.active &&
      new Date(schedule.endAt).getTime() >= now &&
      schedule.batchIds.some((batchId) =>
        repos.students.list().some(
          (student) =>
            student.rollNumber === rollNumber &&
            student.batchId === batchId &&
            student.instituteId === instituteId,
        ),
      ),
  ).length;

  return {
    completedCount: recentResults.length,
    upcomingCount,
    averageScore,
    bestScore: Math.max(0, ...recentResults.map((result) => result.score)),
    lastScore: recentResults[0]?.score ?? 0,
    averageDurationMinutes,
    weakAreas: [...weakAreaMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, misses]) => ({ label, misses })),
    recentResults,
  };
}
