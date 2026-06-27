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
import { listSessionsLocal } from "@/services/test-session-engine";
import { createClient } from "@supabase/supabase-js";
import { loadExamAttempt } from "@/lib/persistence";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function StudentCbtTestList() {
  const candidate = useAuthStore((s) => s.candidate);
  const ws = useWorkspaceAuthStore((s) => s.session);
  const instituteId = ws?.instituteId;
  const hydrateWs = useWorkspaceAuthStore((s) => s.hydrate);
  const [tick, setTick] = useState(0);
  const [submittedTestIds, setSubmittedTestIds] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    if (!candidate) return;
    async function loadAttempts() {
      try {
        const { data } = await supabase
          .from("cbt_attempts")
          .select("exam_id, submitted_at")
          .eq("student_id", candidate?.rollNumber)
          .not("submitted_at", "is", null);
        
        if (data) {
          setSubmittedTestIds(new Set(data.map((r) => r.exam_id)));
        }
      } catch (err) {}
    }
    loadAttempts();
  }, [candidate, tick]);

  const rows = useMemo(() => {
    if (!candidate) return [];
    const repos = getRepositories();
    const student = findStudentForCandidate(candidate);
    const exams = repos.exams.list();
    const schedules = repos.schedules.list();
    const assigned = listAssignedExams(student, exams, schedules).filter(
      ({ schedule }) =>
        (!schedule.instituteId || !instituteId || schedule.instituteId === instituteId),
    );

    const activeLocalSessions = listSessionsLocal().filter(s => s.status === "in_progress" && s.studentId === candidate.rollNumber);

    return assigned.map((row) => {
      const hasSubmitted = submittedTestIds.has(row.exam.id) || listSessionsLocal().some(s => (s.status === "submitted" || s.status === "auto_submitted") && s.testId === row.exam.id && s.studentId === candidate.rollNumber);
      const hasInProgress =
        !hasSubmitted && (activeLocalSessions.some(s => s.testId === row.exam.id) || Boolean(loadExamAttempt(row.exam.id, candidate.rollNumber)));
      
      const testProxy = {
        id: row.exam.id,
        title: row.exam.title,
        durationMinutes: row.exam.durationMinutes,
        questions: Object.keys(row.exam.questions),
      };

      return { ...row, test: testProxy, hasSubmitted, hasInProgress };
    });
  }, [candidate, instituteId, tick, submittedTestIds]);

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
    <div className="space-y-6">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">Upcoming tests</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Start live tests, resume unfinished attempts, or wait for upcoming windows to open.
        </p>
      </div>

      {!isOperationalSchedulingActive() ? (
        <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20">
          <p className="text-sm text-muted-foreground">
            No CBT windows are active yet. Your institute will publish tests here when they are ready.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20">
          <p className="text-sm text-muted-foreground">No institute tests are assigned to you right now.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ test, schedule, status, hasSubmitted, hasInProgress }, index) => {
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
              <Card key={`${test.id}-${schedule.id}`} className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-clay-md border-2 border-border bg-card rounded-2xl animate-in fade-in slide-in-from-bottom-4" style={{ animationFillMode: 'backwards', animationDelay: `${index * 100}ms` }}>
                <CardHeader className="pb-4 border-b-2 border-border bg-muted/50">
                  <CardTitle className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">{test.title}</CardTitle>
                  <CardDescription className="text-muted-foreground flex flex-wrap items-center gap-2 mt-2">
                    <span className="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-xs font-bold text-foreground">
                      {test.durationMinutes} min
                    </span>
                    <span className="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-xs font-bold text-foreground">
                      {test.questions.length} Qs
                    </span>
                    <span className="ml-auto text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-muted-foreground/10 px-2 py-1 rounded-md">
                      {missed ? "Missed" : status}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {hasSubmitted ? (
                    <Link
                      href={`/student/tests/${test.id}/result`}
                      className={cn(buttonVariants({ variant: "outline" }), "w-full font-bold border-2 border-border shadow-clay-sm hover:shadow-clay transition-all hover:-translate-y-1")}
                    >
                      {ctaLabel}
                    </Link>
                  ) : active ? (
                    <Link
                      href={`/student/tests/${test.id}`}
                      className={cn(
                        buttonVariants(),
                        "w-full bg-primary text-primary-foreground font-bold border-2 border-border shadow-clay-sm hover:bg-primary/90 hover:shadow-clay transition-all hover:-translate-y-1",
                      )}
                    >
                      {ctaLabel}
                    </Link>
                  ) : missed ? (
                    <span className="text-sm text-destructive font-bold block text-center bg-destructive/10 border-2 border-destructive/20 p-2 rounded-xl">
                      Missed (joined more than 10 mins late)
                    </span>
                  ) : status === "upcoming" ? (
                    <span className="text-sm font-bold text-muted-foreground block text-center bg-muted/50 border-2 border-border/10 p-2 rounded-xl">
                      Opens{" "}
                      {new Date(schedule.startAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground block text-center bg-muted/50 border-2 border-border/10 p-2 rounded-xl">Window closed</span>
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
