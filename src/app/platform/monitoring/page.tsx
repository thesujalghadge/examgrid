"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRepositoryMode, getRepositories } from "@/lib/repositories/provider";

export default function PlatformMonitoringPage() {
  const monitoring = useMemo(() => {
    const repos = getRepositories();
    const flagged = repos.testSessions.list().filter((session) => session.flagged);
    return {
      repositoryMode: getRepositoryMode(),
      flagged,
      activeSchedules: repos.schedules.list().filter((schedule) => schedule.active).length,
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Monitoring</h2>
        <p className="text-sm text-[#5e5a52]">
          Keep a narrow watch on test health, repository mode, and sessions that need review.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Repository mode" value={monitoring.repositoryMode} />
        <MetricCard label="Active schedules" value={String(monitoring.activeSchedules)} />
        <MetricCard label="Flagged sessions" value={String(monitoring.flagged.length)} />
      </div>

      <Card className="border-[#d8d2c7]">
        <CardHeader>
          <CardTitle className="text-base text-[#14213d]">Operational watchlist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {monitoring.flagged.length === 0 ? (
            <p className="text-sm text-[#5e5a52]">No flagged sessions right now.</p>
          ) : (
            monitoring.flagged.map((session) => (
              <div key={session.id} className="rounded-2xl border border-[#ece6da] p-4">
                <p className="font-medium text-[#14213d]">{session.testId}</p>
                <p className="text-sm text-[#5e5a52]">
                  Student {session.studentId} | integrity {session.integrityScore ?? 0}
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
