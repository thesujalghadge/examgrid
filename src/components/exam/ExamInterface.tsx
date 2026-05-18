"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getExamById } from "@/data/mock-exams";
import { useExamPersistence } from "@/hooks/use-exam-persistence";
import { useExamGuard } from "@/hooks/useExamGuard";
import { bootstrapExamSession } from "@/lib/exam-bootstrap";
import { canSubmitExam, ensureExamReadyForCbt } from "@/lib/cbt/session-safety";
import { requestExamFullscreen } from "@/lib/fullscreen";
import { loadExamAttempt, saveExamAttempt } from "@/lib/persistence";
import { logCbtGuard } from "@/lib/logging/runtime-logger";
import { computeExamResult } from "@/lib/scoring";
import {
  canCandidateAccessExam,
  isOperationalSchedulingActive,
} from "@/services/institute-ops-service";
import { recordAuditEvent } from "@/services/audit-service";
import { useAuthStore } from "@/stores/auth-store";
import { useExamLifecycleStore } from "@/stores/exam-lifecycle-store";
import { useExamSessionStore } from "@/stores/exam-session-store";
import { useQuestionStore } from "@/stores/question-store";
import { useTimerStore } from "@/stores/timer-store";
import type { PersistedExamAttempt } from "@/types/exam";
import { ExamCalculator } from "./ExamCalculator";
import { ExamGuardDialogs } from "./ExamGuardDialogs";
import { ExamHeader } from "./ExamHeader";
import { QuestionCard } from "./QuestionCard";
import { QuestionNavigator } from "./QuestionNavigator";
import { QuestionPalette } from "./QuestionPalette";
import { SectionTabs } from "./SectionTabs";
import { SubmitModal } from "./SubmitModal";

interface ExamInterfaceProps {
  examId: string;
}

export function ExamInterface({ examId }: ExamInterfaceProps) {
  const router = useRouter();
  const candidate = useAuthStore((s) => s.candidate);
  const exam = useQuestionStore((s) => s.exam);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [ready, setReady] = useState(false);
  const submitInProgressRef = useRef(false);
  const { persistNow, setStartedAt, setResult } = useExamPersistence();

  const guard = useExamGuard({
    enabled: ready,
    onPersist: persistNow,
    auditContext: candidate
      ? { actorId: candidate.rollNumber, actorRole: "student", examId }
      : undefined,
  });

  const finalizeSubmit = useCallback(() => {
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
        router.replace(`/exam/${examId}/result`);
      }
      return;
    }

    submitInProgressRef.current = true;

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
    router.replace(`/exam/${examId}/result`);
  }, [candidate, exam, examId, persistNow, router, setResult]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!candidate) {
        router.replace("/login");
        return;
      }

      const examDef = getExamById(examId);
      if (
        !examDef ||
        !ensureExamReadyForCbt(examDef) ||
        (isOperationalSchedulingActive() &&
          !canCandidateAccessExam(candidate, examId))
      ) {
        router.replace("/exams");
        return;
      }

      const startedAt = Date.now();
      const result = bootstrapExamSession(
        examId,
        candidate.rollNumber,
        startedAt,
      );

      if (result.status === "not_found") {
        router.replace("/exams");
        return;
      }

      if (result.status === "already_submitted") {
        router.replace(`/exam/${examId}/result`);
        return;
      }

      if (result.status === "resumed") {
        setResumed(true);
        setStartedAt(result.attempt.startedAt);
        if (useTimerStore.getState().getRemainingSeconds() <= 0) {
          router.replace(`/exam/${examId}/result`);
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
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [candidate, examId, router, setStartedAt]);

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
    <div className="flex h-[100dvh] flex-col bg-muted/20 overflow-hidden">
      <ExamHeader
        examTitle={exam.title}
        candidate={candidate}
        violationCount={guard.violationCount}
        onTimeUp={handleTimeUp}
      />

      {resumed && (
        <Alert className="mx-4 mt-4 border-amber-300 bg-amber-50">
          <AlertTitle>Session restored</AlertTitle>
          <AlertDescription>
            Your previous attempt was recovered from local storage, including
            answers, timer, palette, and integrity violations.
          </AlertDescription>
        </Alert>
      )}

      <SectionTabs />

      <div className="relative flex flex-1 overflow-hidden h-full">
        <main className="flex min-w-0 flex-1 flex-col bg-background shadow-sm h-full relative">
          <QuestionCard />
          <QuestionNavigator onSubmitClick={() => setSubmitOpen(true)} />
          
          <button 
            className="md:hidden absolute right-4 top-1/2 -translate-y-1/2 z-30 flex h-12 w-10 items-center justify-center rounded-l-xl bg-primary shadow-lg ring-1 ring-black/5"
            onClick={() => setPaletteCollapsed(false)}
          >
            <span className="sr-only">Open Palette</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>

          {/* Palette Overlay backdrop for mobile */}
          {!paletteCollapsed && (
            <div 
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
              onClick={() => setPaletteCollapsed(true)}
            />
          )}
        </main>
        
        <QuestionPalette
          collapsed={paletteCollapsed}
          onToggleCollapse={() => setPaletteCollapsed((c) => !c)}
          isMobile={true}
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
