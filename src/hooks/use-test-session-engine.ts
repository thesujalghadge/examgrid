"use client";

import { useCallback, useEffect, useRef } from "react";
import { detectRapidNavigation } from "@/lib/cbt/integrity-engine";
import { buildShuffledExamView } from "@/lib/cbt/shuffled-exam";
import { getExamById } from "@/lib/exam-catalog";
import { logCbtGuard, logCbtWarning } from "@/lib/logging/runtime-logger";
import { getRepositories } from "@/lib/repositories/provider";
import {
  applySignedAnswerKey,
  autoSubmitExpiredTests,
  getRemainingSeconds,
  hydrateSessionAnswers,
  logIntegrityEvent,
  saveAnswer,
  startTest,
  submitTest,
  syncTestSessionFromServerEndsAt,
} from "@/services/test-session-engine";
import { useQuestionStore } from "@/stores/question-store";

import { useTimerStore } from "@/stores/timer-store";
import type { TestSession, TestSessionIntegrityEventType } from "@/types/test-session";

const AUTOSAVE_DEBOUNCE_MS = 400;
const AUTOSAVE_INTERVAL_MS = 15_000;

export function useTestSessionEngine(params: {
  enabled?: boolean;
  integrityState?: "ACTIVE" | "SUSPENDED_BY_SYSTEM" | "DISABLED";
  testId: string;
  studentId: string;
  instituteId: string;
  durationMinutes: number;
  onExpired?: () => void;
  onSubmitted?: (session: TestSession) => void;
}) {
  const {
    enabled,
    testId,
    studentId,
    instituteId,
    durationMinutes,
    onExpired,
    onSubmitted,
    integrityState = "ACTIVE",
  } = params;

  const sessionRef = useRef<TestSession | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navTimestampsRef = useRef<number[]>([]);
  const prevQuestionRef = useRef<string | null>(null);

  const flushSave = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.status !== "in_progress") return;
    const questionState = useQuestionStore.getState();
    saveAnswer(session.id, {
      answers: questionState.answers,
      currentQuestionId: questionState.currentQuestionId ?? undefined,
      currentSectionId: questionState.currentSectionId ?? undefined,
      markedForReview: questionState.markedForReview,
      visited: questionState.visited,
    });
  }, []);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      flushSave();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [flushSave]);

  const syncServerTimer = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/cbt/test-session/timer?testId=${encodeURIComponent(testId)}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!response.ok) {
        logCbtWarning("timer sync failed", {
          testId,
          studentId,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as {
        endsAt: number;
        remainingSeconds: number;
        expired: boolean;
      };

      const session = sessionRef.current;
      if (session) {
        sessionRef.current = syncTestSessionFromServerEndsAt(session, data.endsAt);
        useTimerStore.getState().restore(data.endsAt);
      }
      if (data.expired) onExpired?.();

      logCbtGuard("timer sync completed", {
        testId,
        studentId,
        remainingSeconds: data.remainingSeconds,
        expired: data.expired,
      });
      return data;
    } catch {
      logCbtWarning("timer sync request failed", { testId, studentId });
      return null;
    }
  }, [onExpired, studentId, testId]);

  const applyShuffledExam = useCallback(
    (session: TestSession) => {
      const baseExam = getExamById(testId);
      if (!baseExam) return;
      const shuffled = buildShuffledExamView(baseExam, session);
      const questionState = useQuestionStore.getState();
      useQuestionStore.getState().restoreState({
        exam: shuffled,
        answers: session.answers ?? questionState.answers,
        visited: session.visited ?? {},
        markedForReview: session.markedForReview ?? {},
        currentQuestionId:
          session.currentQuestionId ?? shuffled.sections[0]?.questionIds[0],
        currentSectionId:
          session.currentSectionId ?? shuffled.sections[0]?.id,
      });
    },
    [testId],
  );

  const postServerSubmit = useCallback(
    async (session: TestSession, mode: "submitted" | "auto_submitted") => {
      if (!session.signedAnswerKey || !session.answerKey) {
        throw new Error("Cannot submit to server: missing answer key or signature.");
      }
      try {
        const response = await fetch("/api/cbt/test-session/submit", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            testId,
            sessionId: session.id,
            instituteId,
            answers: session.answers ?? {},
            signedAnswerKey: session.signedAnswerKey,
            integrityEvents: session.integrityEvents,
            status: mode,
            submittedAt: Date.now(),
          }),
        });
        if (!response.ok) {
          throw new Error("server submit rejected");
        }
        return (await response.json()) as {
          score: number;
          resultBreakdown: TestSession["resultBreakdown"];
          integrityScore: number;
          flagged: boolean;
        };
      } catch (error) {
        throw error;
      }
    },
    [instituteId, studentId, testId],
  );

  const beginSession = useCallback(async () => {
    autoSubmitExpiredTests();
    let session = startTest({
      testId,
      studentId,
      instituteId,
      durationMinutes,
    });

    if (!session) {
      const prior = getRepositories()
        .testSessions.list()
        .find(
          (row) =>
            row.testId === testId &&
            row.studentId === studentId &&
            row.status !== "in_progress",
        );
      if (prior) {
        onSubmitted?.(hydrateSessionAnswers(prior));
        return null;
      }
      return null;
    }

    session = hydrateSessionAnswers(session);

    try {
      const response = await fetch("/api/cbt/test-session/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId,
          durationMinutes,
          sessionId: session.id,
          instituteId,
          answerKey: session.answerKey,
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          signedAnswerKey?: string;
          endsAt?: number;
        };
        if (data.signedAnswerKey) {
          session = applySignedAnswerKey(session.id, data.signedAnswerKey) ?? session;
          session.signedAnswerKey = data.signedAnswerKey;
        }
      } else {
        logCbtWarning("server start rejected", {
          testId,
          studentId,
          status: response.status,
        });
      }
    } catch {
      logCbtWarning("server start request failed", { testId, studentId });
    }

    const timer = await syncServerTimer();
    if (timer?.endsAt) {
      session = syncTestSessionFromServerEndsAt(session, timer.endsAt);
    }

    sessionRef.current = session;
    useTimerStore.getState().restore(session.endsAt);
    applyShuffledExam(session);
    return session;
  }, [
    applyShuffledExam,
    durationMinutes,
    instituteId,
    onSubmitted,
    studentId,
    syncServerTimer,
    testId,
  ]);

  const lockSubmit = useCallback(
    async (mode: "submitted" | "auto_submitted" = "submitted") => {
      flushSave();
      const session = sessionRef.current;
      if (!session) return null;

      const fresh = hydrateSessionAnswers(
        getRepositories().testSessions.getById(session.id) ?? session,
      );
      
      const submitStartMs = performance.now();
      console.log(`[CBT] Starting server submission...`);
      const responsePayload = await postServerSubmit(fresh, mode);
      console.log(`[CBT] Server submission complete in ${Math.round(performance.now() - submitStartMs)}ms`);

      const locked = submitTest(fresh.id, mode);
      if (!locked) return null;

      if (responsePayload && responsePayload.resultBreakdown) {
         locked.resultBreakdown = responsePayload.resultBreakdown;
         locked.score = responsePayload.score;
         locked.integrityScore = responsePayload.integrityScore;
         locked.flagged = responsePayload.flagged;
         getRepositories().testSessions.save(locked);
      }

      sessionRef.current = locked;
      onSubmitted?.(locked);
      return locked;
    },
    [flushSave, onSubmitted, postServerSubmit],
  );

  const logIntegrity = useCallback((type: TestSessionIntegrityEventType) => {
    const session = sessionRef.current;
    if (session) logIntegrityEvent(session.id, type);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let prevAnswers = useQuestionStore.getState().answers;
    const unsubscribeQuestionStore = useQuestionStore.subscribe((state) => {
      if (state.answers !== prevAnswers) {
        prevAnswers = state.answers;
        scheduleSave();
      }
      const questionId = state.currentQuestionId;
      if (questionId && questionId !== prevQuestionRef.current) {
        const now = Date.now();
        if (detectRapidNavigation(navTimestampsRef.current, now)) {
          logIntegrity("rapid_navigation");
        }
        navTimestampsRef.current = [...navTimestampsRef.current, now].slice(-8);
        prevQuestionRef.current = questionId;
      }
    });

    intervalRef.current = setInterval(() => {
      flushSave();
      void syncServerTimer();
      const session = sessionRef.current;
      if (session && getRemainingSeconds(session) <= 0) {
        void lockSubmit("auto_submitted");
        onExpired?.();
      }
    }, AUTOSAVE_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "hidden" && sessionRef.current) {
        logIntegrity("tab_switch");
        flushSave();
      }
    };
    const onBlur = () => {
      if (sessionRef.current) logIntegrity("window_blur");
    };
    const onCopy = (event: ClipboardEvent) => {
      if (sessionRef.current) {
        event.preventDefault();
        logIntegrity("copy_attempt");
      }
    };
    const onPaste = (event: ClipboardEvent) => {
      if (sessionRef.current) {
        event.preventDefault();
        logIntegrity("paste_attempt");
      }
    };
    const onFullscreen = () => {
      if (integrityState !== "ACTIVE") return;
      if (
        !document.fullscreenElement &&
        sessionRef.current?.status === "in_progress"
      ) {
        logIntegrity("fullscreen_exit");
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("fullscreenchange", onFullscreen);

    return () => {
      unsubscribeQuestionStore();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [
    enabled,
    flushSave,
    lockSubmit,
    logIntegrity,
    onExpired,
    scheduleSave,
    syncServerTimer,
  ]);

  return {
    beginSession,
    flushSave,
    scheduleSave,
    lockSubmit,
    syncServerTimer,
    getSession: () => sessionRef.current,
    logIntegrity,
  };
}
