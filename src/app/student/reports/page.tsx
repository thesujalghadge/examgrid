"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildStudentInsights } from "@/lib/student-insights";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

export default function StudentReportsPage() {
  const candidate = useAuthStore((s) => s.candidate);
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId ?? "");

  const insights = useMemo(() => {
    if (!candidate || !instituteId) return null;
    return buildStudentInsights(candidate.rollNumber, instituteId);
  }, [candidate, instituteId]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Reports & analysis</h2>
        <p className="text-sm text-[#5e5a52]">
          See your scoring trend, time usage, and the topics that need the next revision pass.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Completed tests"
          value={String(insights?.completedCount ?? 0)}
        />
        <MetricCard
          label="Average score"
          value={insights ? insights.averageScore.toFixed(1) : "-"}
        />
        <MetricCard
          label="Best score"
          value={insights ? insights.bestScore.toFixed(1) : "-"}
        />
        <MetricCard
          label="Average time"
          value={insights ? `${Math.round(insights.averageDurationMinutes)} min` : "-"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-[#d8d2c7]">
          <CardHeader>
            <CardTitle className="text-base text-[#14213d]">Recent performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!insights || insights.recentResults.length === 0 ? (
              <p className="text-sm text-[#5e5a52]">Submit a test to unlock analysis.</p>
            ) : (
              insights.recentResults.slice(0, 4).map((result) => (
                <div
                  key={result.testId}
                  className="rounded-2xl border border-[#ece6da] bg-[#fbf9f4] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[#14213d]">{result.title}</p>
                      <p className="text-sm text-[#5e5a52]">
                        {result.correct} correct out of {result.attempted} attempted
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-[#14213d]">
                        {result.score.toFixed(1)}
                      </p>
                      <p className="text-xs text-[#5e5a52]">
                        {Math.round(result.durationSeconds / 60)} min
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-[#d8d2c7]">
          <CardHeader>
            <CardTitle className="text-base text-[#14213d]">Weak areas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!insights || insights.weakAreas.length === 0 ? (
              <p className="text-sm text-[#5e5a52]">Weak-topic insights will appear after attempts.</p>
            ) : (
              insights.weakAreas.map((area) => (
                <div key={area.label} className="rounded-2xl border border-[#ece6da] p-4">
                  <p className="font-medium text-[#14213d]">{area.label}</p>
                  <p className="text-sm text-[#5e5a52]">{area.misses} incorrect responses</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-[#d8d2c7] bg-white">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-[#5e5a52]">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold text-[#14213d]">{value}</CardContent>
    </Card>
  );
}
