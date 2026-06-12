"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRepositories } from "@/lib/repositories/provider";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { getLocalTestAnalytics } from "@/lib/cbt/client-test-analytics";
import { scopeByInstituteId } from "@/lib/tenant-scope";
import { getScheduleStatus } from "@/services/institute-ops-service";
import { SolutionHealthWidget } from "@/components/institute/SolutionHealthWidget";

export default function InstituteOverviewPage() {
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId);

  const overview = useMemo(() => {
    if (!instituteId) {
      return {
        students: 0,
        batches: 0,
        liveTests: 0,
        reportsReady: 0,
        recentActivity: [] as { label: string; at: string }[],
      };
    }

    const repos = getRepositories();
    const tests = scopeByInstituteId(repos.cbtTests.list(), instituteId);
    const schedules = scopeByInstituteId(repos.schedules.list(), instituteId);
    const students = scopeByInstituteId(repos.students.list(), instituteId);
    const nameByRoll = new Map(students.map((s) => [s.rollNumber, s.fullName]));

    const recentActivity = tests
      .flatMap((test) =>
        repos.cbtAttempts.listByTestId(test.id).map((row) => ({ row, test })),
      )
      .filter(
        ({ row }) =>
          row.attempt.instituteId === instituteId && row.attempt.submittedAt,
      )
      .sort((a, b) => (b.row.attempt.submittedAt ?? 0) - (a.row.attempt.submittedAt ?? 0))
      .slice(0, 6)
      .map(({ row, test }) => {
        const name = nameByRoll.get(row.attempt.studentId) ?? row.attempt.studentId;
        return {
          label: `${name} submitted ${test.title} — score ${row.attempt.score ?? 0}`,
          at: new Date(row.attempt.submittedAt!).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        };
      });

    return {
      students: students.length,
      batches: scopeByInstituteId(repos.batches.list(), instituteId).length,
      liveTests: schedules.filter((schedule) => getScheduleStatus(schedule) === "active").length,
      reportsReady: tests.filter(
        (test) => getLocalTestAnalytics(test.id, instituteId).attemptCount > 0,
      ).length,
      recentActivity,
    };
  }, [instituteId]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Institute overview</h2>
        <p className="text-sm text-[#5e5a52]">
          The core workflow is simple: organize students, publish tests, monitor attempts, and read reports.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Students" value={String(overview.students)} />
        <MetricCard label="Batches" value={String(overview.batches)} />
        <MetricCard label="Live tests" value={String(overview.liveTests)} />
        <MetricCard label="Reports ready" value={String(overview.reportsReady)} />
      </div>

      {instituteId && <SolutionHealthWidget instituteId={instituteId} />}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-[#d8d2c7]">
          <CardHeader>
            <CardTitle className="text-base text-[#14213d]">Primary workflow</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <FlowLink href="/institute/tests" title="1. Upload paper & publish CBT" />
            <FlowLink href="/institute/students" title="2. Students & batches" />
            <FlowLink href="/institute/analysis" title="3. Analysis" />
            <FlowLink href="/institute/tests" title="4. Live test monitoring" />
          </CardContent>
        </Card>

        <Card className="border-[#d8d2c7]">
          <CardHeader>
            <CardTitle className="text-base text-[#14213d]">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {overview.recentActivity.length === 0 ? (
              <p className="text-[#5e5a52]">Submissions will appear here.</p>
            ) : (
              overview.recentActivity.map((item, i) => (
                <div key={i} className="rounded-xl border border-[#ece6da] p-3">
                  <p className="text-[#14213d]">{item.label}</p>
                  <p className="text-xs text-[#5e5a52]">{item.at}</p>
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

function FlowLink({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-[#ece6da] bg-[#fbf9f4] p-4 text-sm font-medium text-[#14213d] transition hover:border-[#8a6f3e]"
    >
      {title}
    </Link>
  );
}
