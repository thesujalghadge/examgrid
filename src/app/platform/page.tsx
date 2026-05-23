"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listPlatformInstitutes } from "@/lib/platform-institute-registry";
import { getRepositories } from "@/lib/repositories/provider";
import { getScheduleStatus } from "@/services/institute-ops-service";

export default function PlatformOverviewPage() {
  const stats = useMemo(() => {
    const institutes = listPlatformInstitutes();
    const repos = getRepositories();
    const active = institutes.filter((i) => i.status === "active").length;
    const liveTests = repos.schedules.list().filter((s) => getScheduleStatus(s) === "active").length;
    const submissions = repos.testSessions.list().filter(
      (s) => s.status === "submitted" || s.status === "auto_submitted",
    ).length;
    return {
      total: institutes.length,
      active,
      liveTests,
      submissions,
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Platform overview</h2>
        <p className="text-sm text-[#5e5a52]">
          Manage institutes and monitor operational health across tenants.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Institutes" value={String(stats.total)} />
        <Metric label="Active institutes" value={String(stats.active)} />
        <Metric label="Live test windows" value={String(stats.liveTests)} />
        <Metric label="Submissions" value={String(stats.submissions)} />
      </div>

      <Card className="border-[#d8d2c7]">
        <CardHeader>
          <CardTitle className="text-base text-[#14213d]">Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link
            href="/platform/institutes"
            className="rounded-xl border border-[#ece6da] px-4 py-3 text-sm font-medium text-[#14213d] hover:border-[#8a6f3e]"
          >
            Manage institutes
          </Link>
          <Link
            href="/platform/monitoring"
            className="rounded-xl border border-[#ece6da] px-4 py-3 text-sm font-medium text-[#14213d] hover:border-[#8a6f3e]"
          >
            Operational monitoring
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-[#d8d2c7]">
      <CardHeader>
        <CardTitle className="text-sm text-[#5e5a52]">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold text-[#14213d]">{value}</CardContent>
    </Card>
  );
}
