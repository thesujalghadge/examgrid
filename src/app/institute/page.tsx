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
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">Institute overview</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The core workflow is simple: organize students, publish tests, monitor attempts, and read reports.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Students" value={String(overview.students)} delay="0ms" />
        <MetricCard label="Batches" value={String(overview.batches)} delay="100ms" />
        <MetricCard label="Live tests" value={String(overview.liveTests)} delay="200ms" />
        <MetricCard label="Reports ready" value={String(overview.reportsReady)} delay="300ms" />
      </div>

      {instituteId && <SolutionHealthWidget instituteId={instituteId} />}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="hover:shadow-[var(--shadow-clay-md)] transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-primary">Primary workflow</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FlowLink href="/institute/tests" title="1. Upload paper & publish CBT" />
            <FlowLink href="/institute/students" title="2. Students & batches" />
            <FlowLink href="/institute/analysis" title="3. Analysis" />
            <FlowLink href="/institute/tests" title="4. Live test monitoring" />
          </CardContent>
        </Card>

        <Card className="hover:shadow-[var(--shadow-clay-md)] transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-primary">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {overview.recentActivity.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20">
                <p className="text-muted-foreground">Submissions will appear here.</p>
              </div>
            ) : (
              overview.recentActivity.map((item, i) => (
                <div key={i} className="group flex flex-col justify-center rounded-2xl bg-background p-4 shadow-[var(--shadow-clay-sm)] transition-all duration-300 hover:shadow-[var(--shadow-clay-md)] hover:-translate-y-0.5">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.at}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value, delay }: { label: string; value: string; delay: string }) {
  return (
    <Card className="group relative overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-clay-lg)] animate-in fade-in slide-in-from-bottom-4" style={{ animationFillMode: 'backwards', animationDelay: delay }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground transition-transform duration-300 group-hover:scale-105 group-hover:text-primary origin-left">{value}</div>
      </CardContent>
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </Card>
  );
}

function FlowLink({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="group flex h-full items-center rounded-2xl bg-background p-5 shadow-[var(--shadow-clay-sm)] ring-1 ring-border/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-clay-md)] hover:ring-primary/50"
    >
      <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{title}</span>
    </Link>
  );
}
