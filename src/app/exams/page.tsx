"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="min-h-screen bg-gray-100">
      <header className="border-b bg-[#1a3c6e] px-6 py-4 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Upcoming Examinations</h1>
            <p className="text-sm text-blue-100">
              Welcome, {candidate.name} (Roll: {candidate.rollNumber})
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-white/40 bg-transparent text-white hover:bg-white/10"
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        <p className="mb-4 text-sm text-gray-600">
          Select an active assigned examination to view instructions and begin
          your CBT session.
        </p>
        <ExamGroup
          title="Active Exams"
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
              title="Upcoming Exams"
              items={scheduledExams.filter((item) => item.status === "upcoming")}
            />
            <ExamGroup
              title="Completed Exams"
              items={scheduledExams.filter(
                (item) =>
                  item.status === "completed" ||
                  completedExamIds.has(item.exam.id),
              )}
            />
          </>
        )}
      </main>
    </div>
  );
}

function ExamGroup({
  title,
  items,
}: {
  title: string;
  items: ScheduledExamView[];
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      {items.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
          No exams in this section.
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map(({ exam, schedule }) => {
            const status = getScheduleStatus(schedule);
            const active = status === "active";
            return (
            <Card key={exam.id} className="border-gray-300">
              <CardHeader>
                <CardTitle className="text-[#1a3c6e]">{exam.title}</CardTitle>
                <CardDescription>
                  {exam.subtitle}
                  {exam.id.startsWith("exam-") && (
                    <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800">
                      Institute
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <ul className="text-sm text-gray-600">
                  <li>Duration: {exam.durationMinutes} minutes</li>
                  <li>Questions: {exam.totalQuestions}</li>
                  <li>Sections: {exam.sections.map((s) => s.name).join(", ")}</li>
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
                      "bg-[#1a3c6e] text-white hover:bg-[#152d52]",
                    )}
                  >
                    Proceed to Instructions
                  </Link>
                ) : (
                  <span className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-500">
                    {status === "upcoming" ? "Not open yet" : "Window closed"}
                  </span>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
