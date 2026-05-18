"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Clock, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  CountdownPill,
  EmptyState,
  SectionHeader,
  StatusBadge,
} from "@/components/shared/product-ui";
import { StudentPortalShell } from "@/components/student/student-portal-shell";
import { cn } from "@/lib/utils";
import { listAllExams } from "@/lib/exam-catalog";
import { getRepositories } from "@/lib/repositories/provider";
import {
  findStudentForCandidate,
  getScheduleStatus,
  isOperationalSchedulingActive,
  listAssignedScheduledExams,
} from "@/services/institute-ops-service";
import { useAuthStore } from "@/stores/auth-store";
import type { ScheduledExamView } from "@/types/institute-ops";

export default function ExamsPage() {
  const router = useRouter();
  const candidate = useAuthStore((s) => s.candidate);
  const logout = useAuthStore((s) => s.logout);
  const exams = useMemo(() => listAllExams(), []);
  const opsActive = useMemo(() => isOperationalSchedulingActive(), []);
  const scheduledExams = useMemo<ScheduledExamView[]>(() => {
    if (!opsActive) return [];
    const student = findStudentForCandidate(candidate);
    const schedules = getRepositories().schedules.list();
    return listAssignedScheduledExams(student, exams, schedules);
  }, [candidate, exams, opsActive]);
  const completedExamIds = useMemo(() => {
    if (!opsActive || !candidate) return new Set<string>();
    const repos = getRepositories();
    return new Set(
      scheduledExams
        .filter((item) => {
          const attempt = repos.attempts.load(item.exam.id, candidate.rollNumber);
          return attempt?.lifecycle === "submitted" || attempt?.result;
        })
        .map((item) => item.exam.id),
    );
  }, [candidate, opsActive, scheduledExams]);

  useEffect(() => {
    if (!candidate) router.replace("/login");
  }, [candidate, router]);

  if (!candidate) return null;

  return (
    <StudentPortalShell
      candidate={candidate}
      onLogout={() => logout()}
    >
      <SectionHeader
        title="My examinations"
        description="Select an active assigned test to review instructions and begin your CBT session."
      />
      <ExamGroup
        title="Active exams"
        items={
          opsActive
            ? scheduledExams.filter((item) => item.status === "active")
            : exams.map((exam) => ({
                exam,
                schedule: {
                  id: exam.id,
                  examId: exam.id,
                  batchIds: [],
                  startAt: exam.scheduledAt,
                  endAt: "9999-12-31T23:59:59.000Z",
                  durationMinutes: exam.durationMinutes,
                  visibilityRule: "all_active_students",
                  active: true,
                  createdAt: 0,
                  updatedAt: 0,
                },
                status: "active" as const,
              }))
        }
      />
      {opsActive && (
        <>
          <ExamGroup
            title="Upcoming exams"
            items={scheduledExams.filter((item) => item.status === "upcoming")}
          />
          <ExamGroup
            title="Completed exams"
            items={scheduledExams.filter(
              (item) =>
                item.status === "completed" ||
                completedExamIds.has(item.exam.id),
            )}
          />
        </>
      )}
    </StudentPortalShell>
  );
}

function ExamGroup({
  title,
  items,
}: {
  title: string;
  items: ScheduledExamView[];
}) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <section className="mb-10">
      <h2 className="eg-section-title mb-4">{title}</h2>
      {items.length === 0 ? (
        <EmptyState
          title="No exams in this section"
          description="Assigned exams appear here when their schedule matches this state."
        />
      ) : (
        <div className="grid gap-4">
          {items.map(({ exam, schedule }) => {
            const status = getScheduleStatus(schedule);
            const active = status === "active";
            const startsIn = new Date(schedule.startAt).getTime() - now;
            const hoursUntil =
              startsIn > 0 ? Math.max(1, Math.ceil(startsIn / 3600000)) : 0;

            return (
              <article
                key={`${exam.id}-${schedule.id}`}
                className="eg-card overflow-hidden transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--eg-border)] bg-slate-50/50 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-[var(--eg-brand)]">
                        {exam.title}
                      </h3>
                      <StatusBadge
                        tone={
                          status === "active"
                            ? "green"
                            : status === "upcoming"
                              ? "blue"
                              : "neutral"
                        }
                      >
                        {status}
                      </StatusBadge>
                      {exam.id.startsWith("exam-") && (
                        <StatusBadge tone="violet">Institute</StatusBadge>
                      )}
                    </div>
                    {exam.subtitle && (
                      <p className="mt-1 text-sm text-slate-600">{exam.subtitle}</p>
                    )}
                  </div>
                  {status === "upcoming" && now > 0 && startsIn > 0 && (
                    <CountdownPill
                      label="Opens in"
                      value={`${hoursUntil}h`}
                      urgent={hoursUntil <= 24}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-6 px-5 py-4">
                  <ul className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <li className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      {exam.durationMinutes} minutes
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      {exam.totalQuestions} questions
                    </li>
                    <li className="sm:col-span-2">
                      Sections: {exam.sections.map((s) => s.name).join(", ")}
                    </li>
                    <li>
                      Opens:{" "}
                      {new Date(schedule.startAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </li>
                    <li>
                      Closes:{" "}
                      {new Date(schedule.endAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </li>
                  </ul>
                  {active ? (
                    <Link
                      href={`/exam/${exam.id}/instructions`}
                      className={cn(
                        buttonVariants(),
                        "shrink-0 bg-[var(--eg-cbt)] hover:bg-[var(--eg-cbt-hover)]",
                      )}
                    >
                      Proceed to instructions
                    </Link>
                  ) : (
                    <span className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
                      {status === "upcoming" ? "Not open yet" : "Window closed"}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
