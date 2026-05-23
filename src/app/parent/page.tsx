"use client";

import Link from "next/link";
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
        <h2 className="text-2xl font-semibold text-[#14213d]">Overview</h2>
        <p className="text-sm text-[#5e5a52]">
          {linkedStudent?.fullName} ({linkedStudent?.rollNumber})
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Upcoming tests" value={String(insights?.upcomingCount ?? 0)} />
        <MetricCard label="Completed tests" value={String(insights?.completedCount ?? 0)} />
        <MetricCard label="Average score" value={insights ? insights.averageScore.toFixed(1) : "—"} />
        <MetricCard label="Best score" value={insights ? insights.bestScore.toFixed(1) : "—"} />
      </div>

      <Card className="border-[#d8d2c7]">
        <CardHeader>
          <CardTitle className="text-base text-[#14213d]">Attendance</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[#5e5a52]">
          Attendance tracking connects when institute marks daily presence. For now, use test
          completion and scores as progress signals.
        </CardContent>
      </Card>

      <Card className="border-[#d8d2c7]">
        <CardHeader>
          <CardTitle className="text-base text-[#14213d]">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!insights || insights.recentResults.length === 0 ? (
            <p className="text-sm text-[#5e5a52]">No submitted tests yet.</p>
          ) : (
            insights.recentResults.slice(0, 5).map((result) => (
              <div key={result.testId} className="rounded-xl border border-[#ece6da] p-4">
                <p className="font-medium text-[#14213d]">{result.title}</p>
                <p className="text-sm text-[#5e5a52]">
                  Score {result.score.toFixed(1)} · {result.correct} correct ·{" "}
                  {Math.round(result.durationSeconds / 60)} min
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Link href="/parent/reports" className="text-sm font-medium text-[#8a6f3e] hover:underline">
        View full test reports →
      </Link>
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
