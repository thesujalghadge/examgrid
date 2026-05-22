"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRepositories } from "@/lib/repositories/provider";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { getLocalTestAnalytics } from "@/lib/cbt/client-test-analytics";
import { scopeByInstituteId } from "@/lib/tenant-scope";
import { getScheduleStatus } from "@/services/institute-ops-service";

export default function InstituteOverviewPage() {
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId);

  const overview = useMemo(() => {
    if (!instituteId) {
      return {
        students: 0,
        batches: 0,
        liveTests: 0,
        reportsReady: 0,
      };
    }

    const repos = getRepositories();
    const tests = repos.cbtTests.list();
    const schedules = repos.schedules.list();

    return {
      students: scopeByInstituteId(repos.students.list(), instituteId).length,
      batches: scopeByInstituteId(repos.batches.list(), instituteId).length,
      liveTests: schedules.filter((schedule) => getScheduleStatus(schedule) === "active").length,
      reportsReady: tests.filter(
        (test) => getLocalTestAnalytics(test.id, instituteId).attemptCount > 0,
      ).length,
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

      <Card className="border-[#d8d2c7]">
        <CardHeader>
          <CardTitle className="text-base text-[#14213d]">Primary workflow</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <FlowLink href="/institute/students" title="1. Add students" />
          <FlowLink href="/institute/batches" title="2. Organize batches" />
          <FlowLink href="/institute/tests" title="3. Configure and publish CBTs" />
          <FlowLink href="/institute/reports" title="4. Review reports" />
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
