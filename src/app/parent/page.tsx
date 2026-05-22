"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildStudentInsights } from "@/lib/student-insights";
import { useParentAccessStore } from "@/stores/parent-access-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

export default function ParentOverviewPage() {
  const linkedStudent = useParentAccessStore((s) => s.linkedStudent);
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId ?? "");

  const insights = useMemo(() => {
    if (!linkedStudent || !instituteId) return null;
    return buildStudentInsights(linkedStudent.rollNumber, instituteId);
  }, [instituteId, linkedStudent]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Parent overview</h2>
        <p className="text-sm text-[#5e5a52]">
          Clear visibility into attendance, performance, and next academic attention areas.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Upcoming tests" value={String(insights?.upcomingCount ?? 0)} />
        <MetricCard label="Completed tests" value={String(insights?.completedCount ?? 0)} />
        <MetricCard label="Average score" value={insights ? insights.averageScore.toFixed(1) : "-"} />
        <MetricCard label="Best score" value={insights ? insights.bestScore.toFixed(1) : "-"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-[#d8d2c7]">
          <CardHeader>
            <CardTitle className="text-base text-[#14213d]">Recent progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!insights || insights.recentResults.length === 0 ? (
              <p className="text-sm text-[#5e5a52]">No submitted tests yet.</p>
            ) : (
              insights.recentResults.slice(0, 3).map((result) => (
                <div key={result.testId} className="rounded-2xl border border-[#ece6da] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[#14213d]">{result.title}</p>
                      <p className="text-sm text-[#5e5a52]">
                        {result.correct} correct | {Math.round(result.durationSeconds / 60)} min
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-[#14213d]">{result.score.toFixed(1)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-[#d8d2c7]">
          <CardHeader>
            <CardTitle className="text-base text-[#14213d]">Weak-topic summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!insights || insights.weakAreas.length === 0 ? (
              <p className="text-sm text-[#5e5a52]">Weak-topic summaries will appear after test attempts.</p>
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
    <Card className="border-[#d8d2c7]">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-[#5e5a52]">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold text-[#14213d]">{value}</CardContent>
    </Card>
  );
}
