"use client";

import { CalendarClock, CheckCircle2, CircleDashed, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

import { CTAButton } from "@/components/ui/student/cta-button";
import { SectionHeader } from "@/components/ui/student/section-header";
import { UpcomingTestCard, FeaturedTestCard, CompletedTestCard } from "@/components/ui/student/test-card";
import { loadExamAttempt } from "@/lib/persistence";
import { getRepositories } from "@/lib/repositories/provider";
import { logCbtGuard } from "@/lib/logging/runtime-logger";
import { hydrateSupabaseRepositories } from "@/lib/supabase/hydrate-repositories";
import { cn } from "@/lib/utils";
import { listAssignedExams } from "@/services/cbt-test-service";
import { findStudentForCandidate, isOperationalSchedulingActive } from "@/services/institute-ops-service";
import { listSessionsLocal } from "@/services/test-session-engine";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const TABS = [
  { label: "Upcoming", icon: CalendarClock },
  { label: "In Progress", icon: CircleDashed },
  { label: "Completed", icon: CheckCircle2 },
  { label: "All Tests", icon: Clock3 },
] as const;

type TestTab = (typeof TABS)[number]["label"];

function dateBox(startAt: string) {
  const date = new Date(startAt);
  return {
    month: date.toLocaleString("en-US", { month: "short" }),
    day: date.getDate().toString().padStart(2, "0"),
    weekday: date.toLocaleString("en-US", { weekday: "short" }),
  };
}

function startsInLabel(startAt: string) {
  const diffMs = new Date(startAt).getTime() - Date.now();
  if (diffMs <= 0) return undefined;
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 1) return "1 day";
  if (days < 7) return `${days} days`;
  return undefined;
}

export function StudentCbtTestList() {
  const candidate = useAuthStore((s) => s.candidate);
  const ws = useWorkspaceAuthStore((s) => s.session);
  const instituteId = ws?.instituteId;
  const [tick, setTick] = useState(0);
  const [submittedTestIds, setSubmittedTestIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TestTab>("Upcoming");

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

  const [recentTestsData, setRecentTestsData] = useState<any[]>([]);

  useEffect(() => {
    if (!candidate) return;
    async function loadAttempts() {
      try {
        if (!candidate?.studentId) return;
        
        const [attemptsRes, recentRes] = await Promise.all([
          supabase
            .from("cbt_attempts")
            .select("test_id, submitted_at")
            .eq("student_id", candidate.studentId)
            .not("submitted_at", "is", null),
          import("@/app/student/actions/analytics-fetch").then(m => m.fetchStudentAttemptedExams())
        ]);

        if (attemptsRes.data) {
          setSubmittedTestIds(new Set(attemptsRes.data.map((r) => r.test_id)));
        }
        if (recentRes) {
          setRecentTestsData(recentRes);
        }
      } catch {}
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
        !schedule.instituteId || !instituteId || schedule.instituteId === instituteId,
    );

    const activeLocalSessions = listSessionsLocal().filter(
      (s) => s.status === "in_progress" && s.studentId === candidate.rollNumber,
    );

    return assigned.map((row) => {
      const hasSubmitted =
        submittedTestIds.has(row.exam.id) ||
        listSessionsLocal().some(
          (s) =>
            (s.status === "submitted" || s.status === "auto_submitted") &&
            s.testId === row.exam.id &&
            s.studentId === candidate.rollNumber,
        );
      const hasInProgress =
        !hasSubmitted &&
        (activeLocalSessions.some((s) => s.testId === row.exam.id) ||
          Boolean(loadExamAttempt(row.exam.id, candidate.rollNumber)));

      const recentResult = recentTestsData.find((r) => r.cbt_attempts?.test_id === row.exam.id);

      const testProxy = {
        id: row.exam.id,
        title: row.exam.title,
        durationMinutes: row.exam.durationMinutes,
        questions: Object.keys(row.exam.questions),
      };

      return { 
        ...row, 
        test: testProxy, 
        hasSubmitted, 
        hasInProgress,
        score: recentResult?.score,
        rank: recentResult?.rank,
        resultDateStr: recentResult?.generated_at ? new Date(recentResult.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : undefined,
        resultId: recentResult?.id
      };
    });
  }, [candidate, instituteId, submittedTestIds, recentTestsData]);

  useEffect(() => {
    if (!candidate) return;
    logCbtGuard("student test list loaded", {
      candidateRoll: candidate.rollNumber,
      instituteId: instituteId ?? null,
      rowCount: rows.length,
    });
  }, [candidate, instituteId, rows.length]);

  if (!candidate) return null;

  const filteredRows = rows.filter((r) => {
    if (activeTab === "All Tests") return true;
    if (activeTab === "Upcoming") {
      return r.status === "upcoming" || (r.status === "active" && !r.hasSubmitted && !r.hasInProgress);
    }
    if (activeTab === "In Progress") return r.hasInProgress;
    if (activeTab === "Completed") return r.hasSubmitted || (r.status === "completed" && !r.hasSubmitted);
    return true;
  });

  const nextUp = activeTab === "Upcoming" ? filteredRows.find((r) => r.status === "active") || filteredRows[0] : null;
  const listRows = activeTab === "Upcoming" && nextUp ? filteredRows.filter((r) => r.test.id !== nextUp.test.id) : filteredRows;
  const liveCount = rows.filter((r) => r.status === "active" && !r.hasSubmitted).length;
  const upcomingCount = rows.filter((r) => r.status === "upcoming").length;
  const completedCount = rows.filter((r) => r.hasSubmitted || r.status === "completed").length;

  return (
    <div className="mx-auto max-w-[900px] pb-16">
      {/* Hero */}
      <section className="mb-10 mt-6 text-center sm:text-left px-2">
        <h1 className="text-[32px] sm:text-[40px] font-bold leading-tight tracking-tight text-[var(--eg-text-primary)]">
          Ready for your next paper?
        </h1>
      </section>

      {/* Sticky Tabs */}
      <div 
        className="sticky top-0 z-20 flex gap-2 overflow-x-auto bg-[#fafbfa] py-4 px-2 -mx-2 mb-8" 
        style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.label;
          return (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label)}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[14px] px-5 text-[14px] font-semibold transition-colors duration-200",
                selected ? "text-[#ffffff] bg-[var(--eg-accent)]" : "text-[var(--eg-text-secondary)] hover:text-[var(--eg-text-primary)] bg-transparent hover:bg-[rgba(0,0,0,0.04)]",
              )}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {!isOperationalSchedulingActive() ? (
        <CalmNotice title="No CBT windows are active yet." body="Your institute will publish tests here when they are ready." />
      ) : filteredRows.length === 0 ? (
        <CalmNotice title="Nothing here right now." body="Switch tabs to review older attempts or wait for your next assigned test." />
      ) : (
        <div className="space-y-8">
          {nextUp && (
            <section className="mb-12">
              <h2 className="mb-4 text-[14px] font-bold uppercase tracking-[0.12em] text-[var(--eg-text-tertiary)] ml-2">
                Featured
              </h2>
              <FeaturedTestCard
                title={nextUp.test.title}
                dateBox={dateBox(nextUp.schedule.startAt)}
                duration={`${nextUp.test.durationMinutes} min`}
                questions={nextUp.test.questions.length}
                isActive={nextUp.status === "active" || nextUp.hasInProgress}
                startsIn={nextUp.status === "upcoming" ? startsInLabel(nextUp.schedule.startAt) : undefined}
                ctaHref={`/student/tests/${nextUp.test.id}`}
                ctaText={nextUp.hasInProgress ? "Resume Test" : nextUp.status === "active" ? "Start Test" : "View Details"}
              />
            </section>
          )}

          {listRows.length > 0 && (
            <section>
              <h2 className="mb-4 text-[14px] font-bold uppercase tracking-[0.12em] text-[var(--eg-text-tertiary)] ml-2">
                {activeTab === "Upcoming" ? "Upcoming tests" : activeTab}
              </h2>
              <div className="space-y-3">
                {listRows.map((row) => {
                  const { test, schedule, status, hasSubmitted, hasInProgress, score, rank, resultDateStr, resultId } = row;
                  const date = new Date(schedule.startAt);
                  const isLate = Date.now() > date.getTime() + 10 * 60 * 1000;
                  const missed = status === "active" && !hasSubmitted && !hasInProgress && isLate;
                  const isReady = status === "active" && !missed && !hasSubmitted;

                  if (hasSubmitted || status === "completed") {
                    // Route contract:
                    // /student/tests/[examId]/solutions
                    // Always pass examId (test.id).
                    // Student attempt is resolved server-side using (examId + authenticated student).
                    return (
                      <CompletedTestCard
                        key={test.id}
                        title={test.title}
                        dateStr={resultDateStr || date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        score={score}
                        rank={rank}
                        ctaHref={`/student/tests/${test.id}/solutions`}
                      />
                    );
                  }

                  return (
                    <UpcomingTestCard
                      key={test.id}
                      title={test.title}
                      dateBox={dateBox(schedule.startAt)}
                      duration={`${test.durationMinutes} min`}
                      questions={test.questions.length}
                      isActive={isReady || hasInProgress}
                      startsIn={status === "upcoming" ? startsInLabel(schedule.startAt) : undefined}
                      ctaHref={
                        missed
                          ? `/student/tests/${test.id}/solutions`
                          : status === "active" || hasInProgress
                            ? `/student/tests/${test.id}`
                            : undefined
                      }
                      ctaText={
                        hasInProgress
                          ? "Resume Test"
                          : missed
                            ? "Review"
                            : isReady
                              ? "Start Test"
                              : "Details"
                      }
                      bottomText={status === "upcoming" ? `Opens ${date.toLocaleDateString()}` : missed ? "Missed" : undefined}
                    />
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="rounded-[28px] bg-white p-5 sm:flex sm:items-center sm:justify-between sm:gap-4" style={{ border: "1px solid rgba(232,234,243,0.9)", boxShadow: "var(--eg-shadow-rest)" }}>
        <div>
          <p className="text-sm font-semibold text-[var(--eg-text-primary)]">Looking for an older paper?</p>
          <p className="mt-1 text-sm text-[var(--eg-text-secondary)]">Past tests live in Completed with results and solution review.</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <CTAButton onClick={() => setActiveTab("Completed")} variant="secondary">
            View Completed
          </CTAButton>
        </div>
      </div>
    </div>
  );
}

function CalmNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-44 items-center justify-center rounded-[28px] bg-white p-6 text-center" style={{ border: "1px dashed var(--eg-border)" }}>
      <div>
        <p className="text-base font-semibold text-[var(--eg-text-primary)]">{title}</p>
        <p className="mt-2 text-sm text-[var(--eg-text-secondary)]">{body}</p>
      </div>
    </div>
  );
}
