"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_INSTITUTE } from "@/config/demo";
import { getRepositories } from "@/lib/repositories/provider";
import { getScheduleStatus } from "@/services/institute-ops-service";

export default function PlatformOverviewPage() {
  const stats = useMemo(() => {
    const repos = getRepositories();
    const tests = repos.cbtTests.list();
    const schedules = repos.schedules.list();
    const liveWindows = schedules.filter((schedule) => getScheduleStatus(schedule) === "active").length;
    const upcomingWindows = schedules.filter((schedule) => getScheduleStatus(schedule) === "upcoming").length;
    const submissions = tests.reduce(
      (count, test) => count + repos.cbtAttempts.listByTestId(test.id).length,
      0,
    );
    const flaggedSessions = repos.testSessions.list().filter((session) => session.flagged).length;

    return {
      institutes: 1,
      liveWindows,
      upcomingWindows,
      submissions,
      flaggedSessions,
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Platform overview</h2>
        <p className="text-sm text-[#5e5a52]">
          Minimal operational visibility for institute access, test delivery, and issue response.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard label="Institutes" value={String(stats.institutes)} />
        <MetricCard label="Live tests" value={String(stats.liveWindows)} />
        <MetricCard label="Upcoming windows" value={String(stats.upcomingWindows)} />
        <MetricCard label="Submissions" value={String(stats.submissions)} />
        <MetricCard label="Flagged sessions" value={String(stats.flaggedSessions)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-[#d8d2c7]">
          <CardHeader>
            <CardTitle className="text-base text-[#14213d]">Institute directory snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-[#ece6da] bg-[#fbf9f4] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[#14213d]">{DEMO_INSTITUTE.name}</p>
                  <p className="text-sm text-[#5e5a52]">
                    {DEMO_INSTITUTE.city} | Operational Beta plan
                  </p>
                </div>
                <span className="rounded-full bg-[#e9f3ea] px-3 py-1 text-xs font-medium text-[#2f6a37]">
                  Active
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#d8d2c7]">
          <CardHeader>
            <CardTitle className="text-base text-[#14213d]">Support queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[#5e5a52]">
            <p className="rounded-2xl border border-[#ece6da] p-4">
              Onboarding follow-up: confirm institute test publishing checklist.
            </p>
            <p className="rounded-2xl border border-[#ece6da] p-4">
              Monitoring task: review flagged sessions before score release.
            </p>
            <p className="rounded-2xl border border-[#ece6da] p-4">
              Health task: keep active CBT windows and attempt submissions under observation.
            </p>
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
