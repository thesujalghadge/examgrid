import type { LeaderboardEntry, TestSession } from "@/types/test-session";

export function buildTestLeaderboard(
  testId: string,
  sessions: TestSession[],
  studentNames: Record<string, string> = {},
  topN = 20,
): LeaderboardEntry[] {
  const done = sessions
    .filter(
      (s) =>
        s.testId === testId &&
        (s.status === "submitted" || s.status === "auto_submitted") &&
        s.resultBreakdown != null,
    )
    .sort((a, b) => {
      const sa = a.resultBreakdown!.finalScore;
      const sb = b.resultBreakdown!.finalScore;
      if (sb !== sa) return sb - sa;
      return (
        a.resultBreakdown!.durationSeconds - b.resultBreakdown!.durationSeconds
      );
    });

  return done.slice(0, topN).map((s, i) => ({
    rank: i + 1,
    studentId: s.studentId,
    studentName: studentNames[s.studentId],
    score: s.resultBreakdown!.finalScore,
    maxScore: s.resultBreakdown!.maxScore,
    durationSeconds: s.resultBreakdown!.durationSeconds,
    flagged: s.flagged ?? false,
  }));
}

export function findStudentRank(
  testId: string,
  studentId: string,
  sessions: TestSession[],
): LeaderboardEntry | null {
  const done = sessions
    .filter(
      (s) =>
        s.testId === testId &&
        (s.status === "submitted" || s.status === "auto_submitted") &&
        s.resultBreakdown != null,
    )
    .sort((a, b) => {
      const sa = a.resultBreakdown!.finalScore;
      const sb = b.resultBreakdown!.finalScore;
      if (sb !== sa) return sb - sa;
      return (
        a.resultBreakdown!.durationSeconds - b.resultBreakdown!.durationSeconds
      );
    });

  const idx = done.findIndex((s) => s.studentId === studentId);
  if (idx < 0) return null;
  const s = done[idx];
  return {
    rank: idx + 1,
    studentId: s.studentId,
    score: s.resultBreakdown!.finalScore,
    maxScore: s.resultBreakdown!.maxScore,
    durationSeconds: s.resultBreakdown!.durationSeconds,
    flagged: s.flagged ?? false,
  };
}
