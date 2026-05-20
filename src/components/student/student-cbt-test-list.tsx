"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRepositories } from "@/lib/repositories/provider";
import { listAssignedCbtTests } from "@/services/cbt-test-service";
import {
  findStudentForCandidate,
  isOperationalSchedulingActive,
} from "@/services/institute-ops-service";
import { logCbtGuard } from "@/lib/logging/runtime-logger";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

export function StudentCbtTestList() {
  const candidate = useAuthStore((s) => s.candidate);
  const ws = useWorkspaceAuthStore((s) => s.session);
  const hydrateWs = useWorkspaceAuthStore((s) => s.hydrate);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    hydrateWs();
  }, [hydrateWs]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 15000);
    return () => window.clearInterval(t);
  }, []);

  const rows = useMemo(() => {
    if (!candidate) return [];
    const repos = getRepositories();
    const student = findStudentForCandidate(candidate);
    const latestByTestId = new Map(
      repos.cbtAttempts
        .listByStudentId(candidate.rollNumber)
        .map((record) => [record.attempt.testId, record]),
    );
    const tests = repos.cbtTests.list();
    const schedules = repos.schedules.list();
    const assigned = listAssignedCbtTests(student, tests, schedules).filter(
      ({ test, schedule }) =>
        (!ws?.instituteId || test.instituteId === ws.instituteId) &&
        (!schedule.instituteId ||
          !ws?.instituteId ||
          schedule.instituteId === ws.instituteId),
    );
    return assigned.map((row) => {
      const latestAttempt = latestByTestId.get(row.test.id);
      const hasSubmitted = Boolean(latestAttempt?.attempt.submittedAt);
      const hasInProgress = !hasSubmitted &&
        Boolean(repos.attempts.load(row.test.id, candidate.rollNumber));
      return { ...row, hasSubmitted, hasInProgress };
    });
  }, [candidate, tick, ws?.instituteId]);

  useEffect(() => {
    if (!candidate) return;
    logCbtGuard("student test list loaded", {
      candidateRoll: candidate.rollNumber,
      instituteId: ws?.instituteId ?? null,
      rowCount: rows.length,
    });
  }, [candidate, rows.length, ws?.instituteId]);

  if (!candidate) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Institute CBT tests</h2>
        <Link
          href="/exams"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Other exam catalog
        </Link>
      </div>

      {!isOperationalSchedulingActive() ? (
        <p className="text-sm text-gray-600">
          No schedules configured — institute tests appear when your coordinator publishes a
          window.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-600">No institute tests assigned to you right now.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map(({ test, schedule, status, hasSubmitted, hasInProgress }) => {
            const active = status === "active";
            const ctaLabel = hasSubmitted
              ? "View result"
              : hasInProgress
                ? "Resume test"
                : "Start test";
            return (
              <Card key={`${test.id}-${schedule.id}`}>
                <CardHeader>
                  <CardTitle className="text-base text-[#1a3c6e]">{test.title}</CardTitle>
                  <CardDescription>
                    {test.durationMinutes} min · {test.questions.length} questions ·{" "}
                    <span className="capitalize">{status}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hasSubmitted ? (
                    <Link
                      href={`/student/tests/${test.id}/result`}
                      className={cn(buttonVariants({ variant: "outline" }))}
                    >
                      {ctaLabel}
                    </Link>
                  ) : active ? (
                    <Link
                      href={`/student/tests/${test.id}`}
                      className={cn(
                        buttonVariants(),
                        "bg-[#1a3c6e] text-white hover:bg-[#152d52]",
                      )}
                    >
                      {ctaLabel}
                    </Link>
                  ) : status === "upcoming" ? (
                    <span className="text-sm text-gray-500">
                      Opens{" "}
                      {new Date(schedule.startAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">Window closed</span>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
