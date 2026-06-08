"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getRepositories } from "@/lib/repositories/provider";
import { listAssignedExams } from "@/services/cbt-test-service";
import {
  findStudentForCandidate,
  isOperationalSchedulingActive,
} from "@/services/institute-ops-service";
import { logCbtGuard } from "@/lib/logging/runtime-logger";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { hydrateSupabaseRepositories } from "@/lib/supabase/hydrate-repositories";

export function StudentCbtTestList() {
  const candidate = useAuthStore((s) => s.candidate);
  const ws = useWorkspaceAuthStore((s) => s.session);
  const instituteId = ws?.instituteId;
  const hydrateWs = useWorkspaceAuthStore((s) => s.hydrate);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    hydrateWs();
  }, [hydrateWs]);

  useEffect(() => {
    hydrateSupabaseRepositories().finally(() => {
      setTick((value) => value + 1);
    });
    const timer = window.setInterval(() => {
      hydrateSupabaseRepositories().finally(() => {
        setTick((value) => value + 1);
      });
    }, 15000);
    const onFocus = () => {
      hydrateSupabaseRepositories().finally(() => {
        setTick((value) => value + 1);
      });
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const rows = useMemo(() => {
    void tick;
    if (!candidate) return [];
    const repos = getRepositories();
    const student = findStudentForCandidate(candidate);
    const latestByTestId = new Map(
      repos.cbtAttempts
        .listByStudentId(candidate.rollNumber)
        .map((record) => [record.attempt.testId, record]),
    );
    const exams = repos.exams.list();
    const schedules = repos.schedules.list();
    const assigned = listAssignedExams(student, exams, schedules).filter(
      ({ schedule }) =>
        (!schedule.instituteId || !instituteId || schedule.instituteId === instituteId),
    );

    return assigned.map((row) => {
      const latestAttempt = latestByTestId.get(row.exam.id);
      const hasSubmitted = Boolean(latestAttempt?.attempt.submittedAt);
      const hasInProgress =
        !hasSubmitted && Boolean(repos.attempts.load(row.exam.id, candidate.rollNumber));
      
      const testProxy = {
        id: row.exam.id,
        title: row.exam.title,
        durationMinutes: row.exam.durationMinutes,
        questions: Object.keys(row.exam.questions),
      };

      return { ...row, test: testProxy, hasSubmitted, hasInProgress };
    });
  }, [candidate, instituteId, tick]);

  useEffect(() => {
    if (!candidate) return;
    logCbtGuard("student test list loaded", {
      candidateRoll: candidate.rollNumber,
      instituteId: instituteId ?? null,
      rowCount: rows.length,
    });
  }, [candidate, instituteId, rows.length]);

  if (!candidate) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-[#14213d]">Upcoming tests</h2>
        <p className="text-sm text-[#5e5a52]">
          Start live tests, resume unfinished attempts, or wait for upcoming windows to open.
        </p>
      </div>

      {!isOperationalSchedulingActive() ? (
        <p className="text-sm text-[#5e5a52]">
          No CBT windows are active yet. Your institute will publish tests here when they are ready.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[#5e5a52]">No institute tests are assigned to you right now.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map(({ test, schedule, status, hasSubmitted, hasInProgress }) => {
            const startLimit = new Date(schedule.startAt).getTime() + 10 * 60 * 1000;
            const isLate = Date.now() > startLimit;
            const missed = status === "active" && !hasSubmitted && !hasInProgress && isLate;
            const active = status === "active" && !missed;
            
            const ctaLabel = hasSubmitted
              ? "View result"
              : hasInProgress
                ? "Resume test"
                : "Start test";

            return (
              <Card key={`${test.id}-${schedule.id}`} className="border-[#d8d2c7]">
                <CardHeader>
                  <CardTitle className="text-base text-[#14213d]">{test.title}</CardTitle>
                  <CardDescription className="text-[#5e5a52]">
                    {test.durationMinutes} min | {test.questions.length} questions |{" "}
                    <span className="capitalize">{missed ? "Missed" : status}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hasSubmitted ? (
                    <Link
                      href={`/student/tests/${test.id}/result`}
                      className={cn(buttonVariants({ variant: "outline" }), "bg-white")}
                    >
                      {ctaLabel}
                    </Link>
                  ) : active ? (
                    <Link
                      href={`/student/tests/${test.id}`}
                      className={cn(
                        buttonVariants(),
                        "bg-[#14213d] text-white hover:bg-[#0f1a31]",
                      )}
                    >
                      {ctaLabel}
                    </Link>
                  ) : missed ? (
                    <span className="text-sm text-red-500 font-medium">
                      Missed (joined more than 10 mins late)
                    </span>
                  ) : status === "upcoming" ? (
                    <span className="text-sm text-[#5e5a52]">
                      Opens{" "}
                      {new Date(schedule.startAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  ) : (
                    <span className="text-sm text-[#5e5a52]">Window closed</span>
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
