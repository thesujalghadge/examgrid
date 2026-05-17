"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Calendar,
  GraduationCap,
  PlusCircle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DashboardPanel,
  MetricCard,
  PageHeader,
  QuickActionCard,
  SectionHeader,
  StatusBadge,
} from "@/components/shared/product-ui";
import { DEMO_INSTITUTE } from "@/config/demo";
import { listAllExams } from "@/lib/exam-catalog";
import { getRepositories } from "@/lib/repositories/provider";
import { resetAndReseedDemoEnvironment } from "@/services/demo-environment-service";
import { getScheduleStatus } from "@/services/institute-ops-service";
import { getQuestionBank } from "@/services/question-bank-service";

export default function AdminOverviewPage() {
  const [stats] = useState(() => {
    const repos = getRepositories();
    const schedules = repos.schedules.list();
    const activeSchedules = schedules.filter(
      (schedule) => schedule.active && getScheduleStatus(schedule) === "active",
    );
    const upcomingSchedules = schedules.filter(
      (schedule) => schedule.active && getScheduleStatus(schedule) === "upcoming",
    );
    return {
      questions: getQuestionBank().length,
      exams: listAllExams().length,
      students: repos.students.list().length,
      batches: repos.batches.list().length,
      schedules: schedules.length,
      activeSchedules: activeSchedules.length,
      upcomingSchedules: upcomingSchedules.length,
      recentAudit: repos.audit.list({ pageSize: 5 }).rows,
      alerts: [
        schedules.length === 0 ? "No schedules configured" : null,
        repos.students.list().length === 0 ? "No students in roster" : null,
        repos.batches.list().length === 0 ? "No active batches configured" : null,
      ].filter((item): item is string => item !== null),
    };
  });
  const [seeding, setSeeding] = useState(false);

  const reseedDemo = async () => {
    if (
      !confirm(
        `Reset and reseed the ${DEMO_INSTITUTE.name} demo environment?`,
      )
    )
      return;
    setSeeding(true);
    await resetAndReseedDemoEnvironment();
    window.location.reload();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Academic operations command center"
        title="Institute Dashboard"
        description={`${DEMO_INSTITUTE.name} · ${DEMO_INSTITUTE.tagline}`}
        action={
          <Button onClick={() => void reseedDemo()} disabled={seeding}>
            {seeding ? "Seeding…" : "Reset & Seed Demo"}
          </Button>
        }
      />

      <section>
        <SectionHeader
          title="Operational snapshot"
          description="Live counts across roster, content, and scheduling."
        />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Students" value={stats.students} hint="Active roster" />
          <MetricCard label="Batches" value={stats.batches} hint="Operational groups" />
          <MetricCard label="Question Bank" value={stats.questions} hint="Reusable items" />
          <MetricCard label="Exams" value={stats.exams} hint="Published catalog" />
          <MetricCard
            label="Live schedules"
            value={stats.activeSchedules}
            hint={`${stats.upcomingSchedules} upcoming`}
            tone={stats.activeSchedules > 0 ? "good" : "default"}
          />
          <MetricCard
            label="Alerts"
            value={stats.alerts.length}
            hint="Operational checks"
            tone={stats.alerts.length > 0 ? "warn" : "good"}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <DashboardPanel>
          <SectionHeader title="Quick actions" />
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickActionCard
              href="/admin/students"
              title="Manage students"
              description="Add or import candidates"
              icon={<Users className="h-5 w-5" />}
            />
            <QuickActionCard
              href="/admin/batches"
              title="Manage batches"
              description="Create and archive batches"
              icon={<GraduationCap className="h-5 w-5" />}
            />
            <QuickActionCard
              href="/admin/create-exam"
              title="Create exam"
              description="Build a CBT from question bank"
              icon={<PlusCircle className="h-5 w-5" />}
            />
            <QuickActionCard
              href="/admin/schedules"
              title="Schedule exams"
              description="Assign windows to batches"
              icon={<Calendar className="h-5 w-5" />}
            />
          </div>
        </DashboardPanel>

        <DashboardPanel>
          <SectionHeader title="Operational alerts" />
          <div className="space-y-3">
            {stats.alerts.length === 0 ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/80 p-3">
                <span className="text-sm text-emerald-800">
                  Demo environment is ready.
                </span>
                <StatusBadge tone="green">Healthy</StatusBadge>
              </div>
            ) : (
              stats.alerts.map((alert) => (
                <div
                  key={alert}
                  className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900"
                >
                  {alert}
                </div>
              ))
            )}
            <div className="rounded-lg border border-[var(--eg-border)] bg-slate-50/80 p-3 text-sm text-slate-600">
              <p className="font-medium text-slate-950">Demo environment</p>
              <p className="mt-1 leading-relaxed">
                Seeds {DEMO_INSTITUTE.name} data for institute walkthroughs and
                CBT rehearsals.
              </p>
            </div>
          </div>
        </DashboardPanel>
      </div>

      <DashboardPanel>
        <SectionHeader
          title="Recent audit activity"
          description="Last five institute operations events."
          action={
            <Link
              href="/admin/audit-logs"
              className="text-sm font-medium text-[var(--eg-brand)] hover:underline"
            >
              View all
            </Link>
          }
        />
        <div className="space-y-2">
          {stats.recentAudit.length === 0 ? (
            <p className="text-sm text-slate-500">
              No audit activity yet. Login, seed demo data, or schedule an exam
              to populate this feed.
            </p>
          ) : (
            stats.recentAudit.map((entry) => (
              <div
                key={entry.eventId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--eg-border)] p-3 text-sm transition hover:bg-slate-50/80"
              >
                <div>
                  <p className="font-medium text-slate-950">{entry.actionType}</p>
                  <p className="text-xs text-slate-500">
                    {entry.actorId} · {entry.resourceType}/{entry.resourceId}
                  </p>
                </div>
                <StatusBadge
                  tone={entry.outcome === "success" ? "green" : "amber"}
                >
                  {entry.outcome}
                </StatusBadge>
              </div>
            ))
          )}
        </div>
      </DashboardPanel>
    </div>
  );
}

