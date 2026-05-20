import type { TestAnalytics } from "@/types/test-session";
import type { TestSession } from "@/types/test-session";

function submittedSessions(sessions: TestSession[], testId: string): TestSession[] {
  return sessions.filter(
    (s) =>
      s.testId === testId &&
      (s.status === "submitted" || s.status === "auto_submitted") &&
      s.resultBreakdown != null,
  );
}

export function computeTestAnalytics(
  testId: string,
  sessions: TestSession[],
  studentNames: Record<string, string> = {},
): TestAnalytics {
  const allForTest = sessions.filter((s) => s.testId === testId);
  const started = allForTest.length;
  const done = submittedSessions(sessions, testId);
  const completionRate = started > 0 ? done.length / started : 0;

  let scoreSum = 0;
  let percentSum = 0;
  const questionStats: Record<
    string,
    { incorrect: number; attempts: number }
  > = {};

  for (const s of done) {
    const br = s.resultBreakdown!;
    scoreSum += br.finalScore;
    percentSum += br.maxScore > 0 ? (br.finalScore / br.maxScore) * 100 : 0;
    for (const pq of br.perQuestion) {
      if (!questionStats[pq.questionId]) {
        questionStats[pq.questionId] = { incorrect: 0, attempts: 0 };
      }
      if (pq.selected != null) {
        questionStats[pq.questionId].attempts += 1;
        if (!pq.correct) questionStats[pq.questionId].incorrect += 1;
      }
    }
  }

  const topPerformers = [...done]
    .sort((a, b) => {
      const sa = a.resultBreakdown!.finalScore;
      const sb = b.resultBreakdown!.finalScore;
      if (sb !== sa) return sb - sa;
      return (
        a.resultBreakdown!.durationSeconds - b.resultBreakdown!.durationSeconds
      );
    })
    .slice(0, 10)
    .map((s, i) => ({
      rank: i + 1,
      studentId: s.studentId,
      studentName: studentNames[s.studentId],
      score: s.resultBreakdown!.finalScore,
      maxScore: s.resultBreakdown!.maxScore,
      durationSeconds: s.resultBreakdown!.durationSeconds,
      flagged: s.flagged ?? false,
    }));

  const weakQuestions = Object.entries(questionStats)
    .map(([questionId, st]) => ({
      questionId,
      incorrectRate: st.attempts > 0 ? st.incorrect / st.attempts : 0,
      attemptCount: st.attempts,
    }))
    .filter((w) => w.attemptCount >= 2)
    .sort((a, b) => b.incorrectRate - a.incorrectRate)
    .slice(0, 15);

  return {
    testId,
    attemptCount: done.length,
    completionRate: Math.round(completionRate * 1000) / 1000,
    averageScore: done.length > 0 ? scoreSum / done.length : 0,
    averagePercent: done.length > 0 ? percentSum / done.length : 0,
    topPerformers,
    weakQuestions,
  };
}
