"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Clock, FileText, Calendar as CalendarIcon, ArrowRight } from "lucide-react";
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
      <div className="mb-6">
        <SectionHeader
          title="My assigned examinations"
          description="Review active and upcoming CBT sessions scheduled by your institute."
        />
      </div>

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
      <h2 className="text-meta mb-4 text-muted-foreground">{title}</h2>
      {items.length === 0 ? (
        <EmptyState
          title="No exams in this section"
          description="Assigned exams appear here when their schedule matches this state."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map(({ exam, schedule }) => {
            const status = getScheduleStatus(schedule);
            const active = status === "active";
            const startsIn = new Date(schedule.startAt).getTime() - now;
            const hoursUntil =
              startsIn > 0 ? Math.max(1, Math.ceil(startsIn / 3600000)) : 0;

            return (
              <article
                key={`${exam.id}-${schedule.id}`}
                className={cn(
                  "flex flex-col rounded-xl border bg-card shadow-sm transition-all",
                  active ? "border-primary/30 ring-1 ring-primary/10 shadow-md" : "border-border hover:border-border/80 hover:shadow-md"
                )}
              >
                <div className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
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
                      <h3 className="text-lg font-semibold text-foreground tracking-tight leading-tight">
                        {exam.title}
                      </h3>
                    </div>
                    {status === "upcoming" && now > 0 && startsIn > 0 && (
                      <CountdownPill
                        label="Opens in"
                        value={`${hoursUntil}h`}
                        urgent={hoursUntil <= 24}
                      />
                    )}
                  </div>
                  
                  {exam.subtitle && (
                    <p className="text-sm text-muted-foreground">{exam.subtitle}</p>
                  )}
                  
                  <div className="mt-2 grid grid-cols-2 gap-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-muted-foreground/70" />
                      {exam.durationMinutes} minutes
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-muted-foreground/70" />
                      {exam.totalQuestions} questions
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground/70" />
                      <span className="truncate">
                        Opens: {new Date(schedule.startAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-auto border-t border-border bg-muted/20 px-5 py-4">
                  {active ? (
                    <Link
                      href={`/exam/${exam.id}/instructions`}
                      className={cn(
                        buttonVariants(),
                        "w-full bg-primary hover:bg-primary/90 text-primary-foreground group"
                      )}
                    >
                      Proceed to instructions
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  ) : (
                    <div className="flex h-10 w-full items-center justify-center rounded-md border border-border bg-background text-sm font-medium text-muted-foreground">
                      {status === "upcoming" ? "Not open yet" : "Window closed"}
                    </div>
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
