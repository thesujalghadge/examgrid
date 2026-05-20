"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getExamById } from "@/data/mock-exams";
import { useExamPersistence } from "@/hooks/use-exam-persistence";
import { useExamGuard } from "@/hooks/useExamGuard";
import { bootstrapExamSession } from "@/lib/exam-bootstrap";
import { canSubmitExam, ensureExamReadyForCbt } from "@/lib/cbt/session-safety";
import { requestExamFullscreen } from "@/lib/fullscreen";
import { loadExamAttempt, saveExamAttempt } from "@/lib/persistence";
import { logCbtGuard, logCbtWarning } from "@/lib/logging/runtime-logger";
import { computeExamResult } from "@/lib/scoring";
import {
  canCandidateAccessExam,
  isOperationalSchedulingActive,
} from "@/services/institute-ops-service";
import { persistCbtFinalAttempt } from "@/services/cbt-attempt-persist";
import { recordAuditEvent } from "@/services/audit-service";
import { useTestSessionEngine } from "@/hooks/use-test-session-engine";
import { getRepositories } from "@/lib/repositories/provider";
import { useAuthStore } from "@/stores/auth-store";
import { useExamLifecycleStore } from "@/stores/exam-lifecycle-store";
import { useExamSessionStore } from "@/stores/exam-session-store";
import { useQuestionStore } from "@/stores/question-store";
import { useTimerStore } from "@/stores/timer-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import type { PersistedExamAttempt } from "@/types/exam";
import { ExamCalculator } from "./ExamCalculator";
import { ExamGuardDialogs } from "./ExamGuardDialogs";
import { ExamHeader } from "./ExamHeader";
import { QuestionCard } from "./QuestionCard";
import { QuestionNavigator } from "./QuestionNavigator";
import { QuestionPalette } from "./QuestionPalette";
import { SectionTabs } from "./SectionTabs";
import { SubmitModal } from "./SubmitModal";

export type ExamInterfaceNavigate = {
  result: (examId: string) => string;
  unauthorized: string;
  login: string;
};

const DEFAULT_EXAM_NAV: ExamInterfaceNavigate = {
  result: (id) => `/exam/${id}/result`,
  unauthorized: "/exams",
  login: "/login",
};

interface ExamInterfaceProps {
  examId: string;
  navigate?: Partial<ExamInterfaceNavigate>;
}

export function ExamInterface({
  examId,
  navigate: navigatePartial,
}: ExamInterfaceProps) {
  const router = useRouter();
  const nav = useMemo(
    () => ({ ...DEFAULT_EXAM_NAV, ...navigatePartial }),
    [navigatePartial],
  );
  const candidate = useAuthStore((s) => s.candidate);
  const exam = useQuestionStore((s) => s.exam);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [ready, setReady] = useState(false);
  const submitInProgressRef = useRef(false);
  const finalizeRef = useRef<() => void>(() => {});
  const { persistNow, setStartedAt, setResult } = useExamPersistence();
  const wsSession = useWorkspaceAuthStore((s) => s.session);
  const cbtTest = useMemo(
    () => getRepositories().cbtTests.getById(examId),
    [examId],
  );
  const isInstituteCbt = Boolean(cbtTest);

  const testEngine = useTestSessionEngine({
    enabled: isInstituteCbt && Boolean(candidate && wsSession?.instituteId),
    testId: examId,
    studentId: candidate?.rollNumber ?? "",
    instituteId: wsSession?.instituteId ?? "",
    durationMinutes: cbtTest?.durationMinutes ?? 180,
    onExpired: () => finalizeRef.current(),
  });

  const guard = useExamGuard({
    enabled: ready,
    onPersist: persistNow,
    auditContext: candidate
      ? { actorId: candidate.rollNumber, actorRole: "student", examId }
      : undefined,
  });

  const finalizeSubmit = useCallback(async () => {
    if (!candidate || !exam) return;

    const previous = loadExamAttempt(examId, candidate.rollNumber);
    const lifecyclePhase = useExamLifecycleStore.getState().phase;

    if (
      !canSubmitExam({
        lifecyclePhase,
        submitInProgress: submitInProgressRef.current,
        existingAttempt: previous,
      })
    ) {
      logCbtGuard("submit blocked — duplicate or already submitted");
      if (previous?.lifecycle === "submitted") {
        router.replace(nav.result(examId));
      }
      return;
    }

    submitInProgressRef.current = true;
    if (isInstituteCbt) {
      testEngine.flushSave();
      await testEngine.lockSubmit("submitted");
    }
    logCbtGuard("submit started", {
      examId,
      candidateRoll: candidate.rollNumber,
      lifecyclePhase,
    });

    const qState = useQuestionStore.getState();
    const timerState = useTimerStore.getState();
    timerState.stop();

    const currentQuestionId =
      qState.currentQuestionId &&
      exam.questions[qState.currentQuestionId]
        ? qState.currentQuestionId
        : Object.keys(exam.questions)[0];

    const currentSectionId =
      qState.currentSectionId &&
      exam.sections.some((s) => s.id === qState.currentSectionId)
        ? qState.currentSectionId
        : exam.sections[0].id;

    if (!currentQuestionId) {
      submitInProgressRef.current = false;
      return;
    }

    const sessionViolations = useExamSessionStore.getState().violations;
    const attempt: PersistedExamAttempt = {
      version: 1,
      examId,
      candidateRoll: candidate.rollNumber,
      lifecycle: "submitted",
      examEndsAt: timerState.examEndsAt ?? Date.now(),
      startedAt: previous?.startedAt ?? Date.now(),
      currentQuestionId,
      currentSectionId,
      answers: qState.answers,
      visited: qState.visited,
      markedForReview: qState.markedForReview,
      violations: sessionViolations,
      submittedAt: Date.now(),
    };

    const result = computeExamResult(exam, attempt, candidate.name);
    attempt.result = result;
    const saved = saveExamAttempt(attempt);
    if (!saved) {
      logCbtWarning("submit save failed", {
        examId,
        candidateRoll: candidate.rollNumber,
      });
      submitInProgressRef.current = false;
      return;
    }

    useExamLifecycleStore.getState().setPhase("submitted");
    recordAuditEvent({
      actorId: candidate.rollNumber,
      actorRole: "student",
      actionType: "exam_submit",
      resourceType: "exam",
      resourceId: examId,
      metadata: {
        violationCount: sessionViolations.length,
        attempted: result.attempted,
        totalScore: result.totalScore,
      },
    });
    setResult(result);
    persistNow();
    try {
      const ws = useWorkspaceAuthStore.getState().session;
      if (ws?.instituteId) {
        persistCbtFinalAttempt(exam, attempt, ws.instituteId);
      }
    } catch {
      /* non-fatal */
    }
    logCbtGuard("submit completed", {
      examId,
      candidateRoll: candidate.rollNumber,
      attempted: result.attempted,
      totalScore: result.totalScore,
      submittedAt: result.submittedAt,
    });
    router.replace(nav.result(examId));
  }, [candidate, exam, examId, isInstituteCbt, nav, persistNow, router, setResult, testEngine]);

  useEffect(() => {
    finalizeRef.current = finalizeSubmit;
  }, [finalizeSubmit]);

  useEffect(() => {
    if (!candidate) {
      router.replace(nav.login);
      return;
    }

    const examDef = getExamById(examId);
    if (
      !examDef ||
      !ensureExamReadyForCbt(examDef) ||
      (isOperationalSchedulingActive() &&
        !canCandidateAccessExam(candidate, examId))
    ) {
      logCbtWarning("test load denied", {
        examId,
        candidateRoll: candidate.rollNumber,
      });
      router.replace(nav.unauthorized);
      return;
    }

    logCbtGuard("test load allowed", {
      examId,
      candidateRoll: candidate.rollNumber,
    });

    const startedAt = Date.now();

    const finishBootstrap = (
      result: ReturnType<typeof bootstrapExamSession>,
    ) => {
      if (result.status === "not_found") {
        router.replace(nav.unauthorized);
        return;
      }
      if (result.status === "already_submitted") {
        router.replace(nav.result(examId));
        return;
      }
      if (result.status === "resumed") {
        setResumed(true);
        setStartedAt(result.attempt.startedAt);
        if (useTimerStore.getState().getRemainingSeconds() <= 0) {
          setReady(true);
          queueMicrotask(() => finalizeSubmit());
          return;
        }
      } else {
        setStartedAt(startedAt);
        recordAuditEvent({
          actorId: candidate.rollNumber,
          actorRole: "student",
          actionType: "exam_start",
          resourceType: "exam",
          resourceId: examId,
          metadata: { startedAtUTC: new Date(startedAt).toISOString() },
        });
      }
      void requestExamFullscreen();
      setReady(true);
    };

    if (isInstituteCbt && wsSession?.instituteId) {
      const boot = bootstrapExamSession(examId, candidate.rollNumber, startedAt);
      void testEngine.beginSession().then((ts) => {
        if (!ts && boot.status === "already_submitted") {
          router.replace(nav.result(examId));
          return;
        }
        if (!ts) {
          router.replace(nav.unauthorized);
          return;
        }
        finishBootstrap(boot);
      });
      return;
    }

    finishBootstrap(
      bootstrapExamSession(examId, candidate.rollNumber, startedAt),
    );
  }, [
    candidate,
    examId,
    finalizeSubmit,
    isInstituteCbt,
    nav,
    router,
    setStartedAt,
    testEngine,
    wsSession?.instituteId,
  ]);

  const handleTimeUp = useCallback(() => {
    finalizeSubmit();
  }, [finalizeSubmit]);

  if (!ready || !candidate || !exam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-200 text-sm text-gray-600">
        Preparing examination…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#c8d0dc]">
      <ExamHeader
        examTitle={exam.title}
        candidate={candidate}
        violationCount={guard.violationCount}
        onTimeUp={handleTimeUp}
      />

      {resumed && (
        <Alert className="mx-4 mt-2 border-amber-300 bg-amber-50">
          <AlertTitle>Session restored</AlertTitle>
          <AlertDescription>
            Your previous attempt was recovered from local storage, including
            answers, timer, palette, and integrity violations.
          </AlertDescription>
        </Alert>
      )}

      <SectionTabs />

      <div className="relative flex flex-1 overflow-hidden">
        <main className="flex min-w-0 flex-1 flex-col border-r border-[#1a3c6e]/10 bg-white shadow-sm">
          <QuestionCard />
          <QuestionNavigator onSubmitClick={() => setSubmitOpen(true)} />
        </main>
        <QuestionPalette
          collapsed={paletteCollapsed}
          onToggleCollapse={() => setPaletteCollapsed((c) => !c)}
        />
      </div>

      <ExamCalculator />
      <ExamGuardDialogs guard={guard} />

      <SubmitModal
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        onConfirm={() => {
          setSubmitOpen(false);
          finalizeSubmit();
        }}
      />
    </div>
  );
}
