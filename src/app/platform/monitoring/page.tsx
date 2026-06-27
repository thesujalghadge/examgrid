"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listPlatformInstitutes } from "@/lib/platform-institute-registry";
import { getRepositoryMode, getRepositories } from "@/lib/repositories/provider";
import { getScheduleStatus } from "@/services/institute-ops-service";
import { listSessionsLocal } from "@/services/test-session-engine";

export default function PlatformMonitoringPage() {
  const monitoring = useMemo(() => {
    const repos = getRepositories();
    const institutes = listPlatformInstitutes();
    const schedules = repos.schedules.list();
    const activeSchedules = schedules.filter((s) => getScheduleStatus(s) === "active");
    const sessions = listSessionsLocal();
    const inProgress = sessions.filter((s) => s.status === "in_progress");
    const flagged = sessions.filter((s) => s.flagged);
    const students = repos.students.list().length;

    return {
      repositoryMode: getRepositoryMode(),
      institutes,
      activeSchedules,
      inProgress,
      flagged,
      students,
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Monitoring</h2>
        <p className="text-sm text-[#5e5a52]">
          Active tests, student activity, and sessions needing review.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Storage mode" value={monitoring.repositoryMode} />
        <MetricCard label="Students" value={String(monitoring.students)} />
        <MetricCard label="Live windows" value={String(monitoring.activeSchedules.length)} />
        <MetricCard label="In-progress" value={String(monitoring.inProgress.length)} />
      </div>

      <Card className="border-[#d8d2c7]">
        <CardHeader>
          <CardTitle className="text-base text-[#14213d]">Active test windows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {monitoring.activeSchedules.length === 0 ? (
            <p className="text-[#5e5a52]">No live windows.</p>
          ) : (
            monitoring.activeSchedules.map((s) => (
              <p key={s.id} className="text-[#14213d]">
                {s.examId} · institute {s.instituteId ?? "—"}
              </p>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-[#d8d2c7]">
        <CardHeader>
          <CardTitle className="text-base text-[#14213d]">Flagged sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {monitoring.flagged.length === 0 ? (
            <p className="text-sm text-[#5e5a52]">No flagged sessions.</p>
          ) : (
            monitoring.flagged.map((session) => (
              <div key={session.id} className="rounded-xl border border-[#ece6da] p-4 text-sm">
                <p className="font-medium text-[#14213d]">{session.testId}</p>
                <p className="text-[#5e5a52]">
                  {session.studentId} · integrity {session.integrityScore ?? 0}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
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
