"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getExamById } from "@/lib/exam-catalog";
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
import type { ExamDefinition } from "@/types/exam";
import type { ProcessedPaperStatus } from "@/types/cbt-paper-processing";
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

export interface ExamTeacherReviewConfig {
  exam: ExamDefinition;
  status: ProcessedPaperStatus;
  flaggedQuestionIds: string[];
  questionIssues: Record<string, string[]>;
  onQuestionTextChange: (questionId: string, value: string) => void;
  onOptionTextChange: (questionId: string, label: string, value: string) => void;
  onCorrectAnswerChange: (questionId: string, value: string) => void;
  onMarksChange: (questionId: string, value: string) => void;
  onNegativeMarksChange: (questionId: string, value: string) => void;
  onToggleFlag: (questionId: string) => void;
  onMoveQuestion: (questionId: string, delta: -1 | 1) => void;
  onDeleteQuestion: (questionId: string) => void;
  onAddQuestion: (sectionId: string) => void;
  onContinue: () => void;
}

const DEFAULT_EXAM_NAV: ExamInterfaceNavigate = {
  result: (id) => `/student/tests/${id}/result`,
  unauthorized: "/student/tests",
  login: "/student/login",
};

interface ExamInterfaceProps {
  examId: string;
  navigate?: Partial<ExamInterfaceNavigate>;
  review?: ExamTeacherReviewConfig;
}

export function ExamInterface({
  examId,
  navigate: navigatePartial,
  review,
}: ExamInterfaceProps) {
  const router = useRouter();
  const nav = useMemo(() => ({ ...DEFAULT_EXAM_NAV, ...navigatePartial }), [navigatePartial]);
  const isTeacherReview = Boolean(review);
  const candidate = useAuthStore((s) => s.candidate);
  const exam = useQuestionStore((s) => s.exam);
  const currentQuestionId = useQuestionStore((s) => s.currentQuestionId);
  const currentSectionId = useQuestionStore((s) => s.currentSectionId);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [ready, setReady] = useState(false);
  const submitInProgressRef = useRef(false);
  const finalizeRef = useRef<() => void>(() => {});
  const routerRef = useRef(router);
  const navRef = useRef(nav);
  const { persistNow, setStartedAt, setResult } = useExamPersistence();
  const setStartedAtRef = useRef(setStartedAt);
  const wsSession = useWorkspaceAuthStore((s) => s.session);
  const instituteId = wsSession?.instituteId;
  const candidateRollNumber = candidate?.rollNumber;
  const cbtTest = useMemo(() => getRepositories().cbtTests.getById(examId), [examId]);
  const isInstituteCbt = !isTeacherReview && Boolean(cbtTest);

  const testEngine = useTestSessionEngine({
    enabled: isInstituteCbt && Boolean(candidateRollNumber && instituteId),
    testId: examId,
    studentId: candidateRollNumber ?? "",
    instituteId: instituteId ?? "",
    durationMinutes: cbtTest?.durationMinutes ?? 180,
    onExpired: () => finalizeRef.current(),
  });
  const testEngineRef = useRef(testEngine);

  const guard = useExamGuard({
    enabled: ready && !isTeacherReview,
    onPersist: persistNow,
    auditContext:
      !isTeacherReview && candidate
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
      logCbtGuard("submit blocked - duplicate or already submitted");
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

    const safeCurrentQuestionId =
      qState.currentQuestionId && exam.questions[qState.currentQuestionId]
        ? qState.currentQuestionId
        : Object.keys(exam.questions)[0];

    const safeCurrentSectionId =
      qState.currentSectionId && exam.sections.some((s) => s.id === qState.currentSectionId)
        ? qState.currentSectionId
        : exam.sections[0].id;

    if (!safeCurrentQuestionId) {
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
      currentQuestionId: safeCurrentQuestionId,
      currentSectionId: safeCurrentSectionId,
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
    routerRef.current = router;
    navRef.current = nav;
    setStartedAtRef.current = setStartedAt;
    testEngineRef.current = testEngine;
  }, [nav, router, setStartedAt, testEngine]);

  const reviewExamSignature = useMemo(() => {
    if (!review) return "";
    return review.exam.sections
      .map((section) => `${section.id}:${section.questionIds.map((id) => review.exam.questions[id]?.text ?? "").join("~")}`)
      .join("|");
  }, [review]);

  useEffect(() => {
    if (!review) return;

    const firstQuestionId = review.exam.sections[0]?.questionIds[0];
    if (!firstQuestionId) {
      setReady(false);
      return;
    }

    const state = useQuestionStore.getState();
    const nextQuestionId =
      state.currentQuestionId && review.exam.questions[state.currentQuestionId]
        ? state.currentQuestionId
        : firstQuestionId;
    const nextSectionId =
      state.currentSectionId && review.exam.sections.some((section) => section.id === state.currentSectionId)
        ? state.currentSectionId
        : review.exam.sections.find((section) => section.questionIds.includes(nextQuestionId))?.id ??
          review.exam.sections[0].id;

    if (!state.exam || state.exam.id !== review.exam.id) {
      state.loadExam(review.exam, nextQuestionId);
    } else {
      state.restoreState({
        exam: review.exam,
        answers: state.answers,
        visited: { ...state.visited, [nextQuestionId]: true },
        markedForReview: state.markedForReview,
        currentQuestionId: nextQuestionId,
        currentSectionId: nextSectionId,
      });
    }

    useTimerStore.getState().stop();
    setResumed(false);
    setReady(true);
  }, [review, reviewExamSignature]);

  useEffect(() => {
    if (!isTeacherReview) return;
    return () => {
      useQuestionStore.getState().reset();
      useTimerStore.getState().stop();
    };
  }, [isTeacherReview]);

  useEffect(() => {
    if (isTeacherReview || !candidateRollNumber) {
      if (!isTeacherReview && !candidateRollNumber) {
        routerRef.current.replace(navRef.current.login);
      }
      return;
    }

    const examDef = getExamById(examId);
    if (
      !examDef ||
      !ensureExamReadyForCbt(examDef) ||
      (isOperationalSchedulingActive() &&
        !canCandidateAccessExam(
          {
            name: "",
            rollNumber: candidateRollNumber,
            applicationNumber: "",
          },
          examId,
        ))
    ) {
      logCbtWarning("test load denied", {
        examId,
        candidateRoll: candidateRollNumber,
      });
      routerRef.current.replace(navRef.current.unauthorized);
      return;
    }

    logCbtGuard("test load allowed", {
      examId,
      candidateRoll: candidateRollNumber,
    });

    const startedAt = Date.now();

    const finishBootstrap = (result: ReturnType<typeof bootstrapExamSession>) => {
      if (result.status === "not_found") {
        routerRef.current.replace(navRef.current.unauthorized);
        return;
      }
      if (result.status === "already_submitted") {
        routerRef.current.replace(navRef.current.result(examId));
        return;
      }
      if (result.status === "resumed") {
        setResumed(true);
        setStartedAtRef.current(result.attempt.startedAt);
        if (useTimerStore.getState().getRemainingSeconds() <= 0) {
          setReady(true);
          queueMicrotask(() => finalizeRef.current());
          return;
        }
      } else {
        setStartedAtRef.current(startedAt);
        recordAuditEvent({
          actorId: candidateRollNumber,
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

    if (isInstituteCbt && instituteId) {
      const boot = bootstrapExamSession(examId, candidateRollNumber, startedAt);
      void testEngineRef.current.beginSession().then((ts) => {
        if (!ts && boot.status === "already_submitted") {
          routerRef.current.replace(navRef.current.result(examId));
          return;
        }
        if (!ts) {
          routerRef.current.replace(navRef.current.unauthorized);
          return;
        }
        finishBootstrap(boot);
      });
      return;
    }

    finishBootstrap(bootstrapExamSession(examId, candidateRollNumber, startedAt));
  }, [
    examId,
    candidateRollNumber,
    isInstituteCbt,
    isTeacherReview,
    instituteId,
  ]);

  const handleTimeUp = useCallback(() => {
    finalizeSubmit();
  }, [finalizeSubmit]);

  const reviewCandidate = useMemo(
    () => ({
      name: "Teacher Review",
      rollNumber: "DRAFT",
      applicationNumber: review?.status ?? "DRAFT_REVIEW",
    }),
    [review?.status],
  );

  const currentReviewSection = useMemo(
    () => review?.exam.sections.find((section) => section.id === currentSectionId) ?? null,
    [currentSectionId, review?.exam.sections],
  );
  const currentReviewSectionQuestionIds = currentReviewSection?.questionIds ?? [];
  const currentReviewQuestionIndex = currentQuestionId
    ? currentReviewSectionQuestionIds.indexOf(currentQuestionId)
    : -1;

  const activeExam = review?.exam ?? exam;
  const currentQuestionType = currentQuestionId
    ? activeExam?.questions[currentQuestionId]?.type
    : undefined;
  const showCalculator = currentQuestionType === "NUMERICAL";

  if (!ready || (!isTeacherReview && (!candidate || !exam))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-200 text-sm text-gray-600">
        Preparing examination...
      </div>
    );
  }

  return (
    <div className={isTeacherReview ? "flex h-full min-h-0 flex-col bg-[#c8d0dc]" : "flex min-h-screen flex-col bg-[#c8d0dc]"}>
      <ExamHeader
        examTitle={exam?.title ?? review?.exam.title ?? "CBT Test"}
        candidate={isTeacherReview ? reviewCandidate : candidate!}
        violationCount={isTeacherReview ? 0 : guard.violationCount}
        onTimeUp={isTeacherReview ? undefined : handleTimeUp}
        fixedSeconds={isTeacherReview ? (review?.exam.durationMinutes ?? 0) * 60 : undefined}
        modeLabel={isTeacherReview ? `Draft status: ${review?.status ?? "DRAFT_REVIEW"}` : undefined}
      />

      {!isTeacherReview && resumed ? (
        <Alert className="mx-4 mt-2 border-amber-300 bg-amber-50">
          <AlertTitle>Session restored</AlertTitle>
          <AlertDescription>
            Your previous attempt was recovered from local storage, including answers, timer, palette,
            and integrity violations.
          </AlertDescription>
        </Alert>
      ) : null}

      <SectionTabs />

      <div className="relative flex flex-1 overflow-hidden">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-[#1a3c6e]/10 bg-white shadow-sm">
          <QuestionCard
            review={
              review && currentQuestionId
                ? {
                    issues: review.questionIssues[currentQuestionId] ?? [],
                    flagged: review.flaggedQuestionIds.includes(currentQuestionId),
                    onToggleFlag: review.onToggleFlag
                      ? () => review.onToggleFlag(currentQuestionId)
                      : undefined,
                    onQuestionTextChange: (value) => review.onQuestionTextChange(currentQuestionId, value),
                    onOptionTextChange: (label, value) =>
                      review.onOptionTextChange(currentQuestionId, label, value),
                    onCorrectAnswerChange: (value) => review.onCorrectAnswerChange(currentQuestionId, value),
                    onMarksChange: (value) => review.onMarksChange(currentQuestionId, value),
                    onNegativeMarksChange: (value) => review.onNegativeMarksChange(currentQuestionId, value),
                  }
                : undefined
            }
          />
          <QuestionNavigator
            onSubmitClick={() => setSubmitOpen(true)}
            review={
              review && currentQuestionId && currentReviewSection
                ? {
                    canMoveQuestionUp: currentReviewQuestionIndex > 0,
                    canMoveQuestionDown:
                      currentReviewQuestionIndex >= 0 &&
                      currentReviewQuestionIndex < currentReviewSectionQuestionIds.length - 1,
                    onMoveQuestion: (delta) => review.onMoveQuestion(currentQuestionId, delta),
                    onDeleteQuestion: () => review.onDeleteQuestion(currentQuestionId),
                    onAddQuestion: () => review.onAddQuestion(currentReviewSection.id),
                    onContinue: review.onContinue,
                    continueLabel: "Publish CBT",
                  }
                : undefined
            }
          />
        </main>
        <QuestionPalette
          collapsed={paletteCollapsed}
          onToggleCollapse={() => setPaletteCollapsed((collapsed) => !collapsed)}
        />
      </div>

      {showCalculator ? <ExamCalculator /> : null}
      {!isTeacherReview ? <ExamGuardDialogs guard={guard} /> : null}

      {!isTeacherReview ? (
        <SubmitModal
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          onConfirm={() => {
            setSubmitOpen(false);
            finalizeSubmit();
          }}
        />
      ) : null}
    </div>
  );
}
