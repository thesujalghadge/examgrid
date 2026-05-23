"use client";

import Link from "next/link";
import { useMemo } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildStudentInsights } from "@/lib/student-insights";
import { getRepositories } from "@/lib/repositories/provider";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

export default function StudentReportsPage() {
  const candidate = useAuthStore((s) => s.candidate);
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId ?? "");

  const insights = useMemo(() => {
    if (!candidate || !instituteId) return null;
    return buildStudentInsights(candidate.rollNumber, instituteId);
  }, [candidate, instituteId]);

  const rankByTest = useMemo(() => {
    if (!candidate || !instituteId) return new Map<string, number>();
    const repos = getRepositories();
    const map = new Map<string, number>();
    for (const result of insights?.recentResults ?? []) {
      const sessions = repos.testSessions
        .list()
        .filter(
          (s) =>
            s.testId === result.testId &&
            s.instituteId === instituteId &&
            (s.status === "submitted" || s.status === "auto_submitted"),
        )
        .sort(
          (a, b) =>
            (b.resultBreakdown?.finalScore ?? 0) - (a.resultBreakdown?.finalScore ?? 0),
        );
      const idx = sessions.findIndex((s) => s.studentId === candidate.rollNumber);
      if (idx >= 0) map.set(result.testId, idx + 1);
    }
    return map;
  }, [candidate, instituteId, insights]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Reports</h2>
        <p className="text-sm text-[#5e5a52]">
          Score, rank, marks, and subject breakdown from submitted tests.
        </p>
      </div>

      {!insights || insights.recentResults.length === 0 ? (
        <Card className="border-[#d8d2c7]">
          <CardContent className="py-8 text-sm text-[#5e5a52]">
            Complete a test to see your report here.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {insights.recentResults.map((result) => (
            <Card key={result.testId} className="border-[#d8d2c7]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-[#14213d]">{result.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="grid gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-[#5e5a52]">Score</p>
                    <p className="text-lg font-semibold text-[#14213d]">
                      {result.score.toFixed(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#5e5a52]">Correct</p>
                    <p className="text-lg font-semibold text-green-800">{result.correct}</p>
                  </div>
                  <div>
                    <p className="text-[#5e5a52]">Rank</p>
                    <p className="text-lg font-semibold text-[#14213d]">
                      {rankByTest.get(result.testId) ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#5e5a52]">Time</p>
                    <p className="text-lg font-semibold text-[#14213d]">
                      {Math.round(result.durationSeconds / 60)} min
                    </p>
                  </div>
                </div>
                <Link
                  href={`/student/tests/${result.testId}/result`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Solutions & breakdown
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
