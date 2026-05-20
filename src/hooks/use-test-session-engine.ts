"use client";

import { useCallback, useEffect, useRef } from "react";
import { buildShuffledExamView } from "@/lib/cbt/shuffled-exam";
import { detectRapidNavigation } from "@/lib/cbt/integrity-engine";
import { getExamById } from "@/lib/exam-catalog";
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
  enabled: boolean;
  testId: string;
  studentId: string;
  instituteId: string;
  durationMinutes: number;
  onExpired?: () => void;
  onSubmitted?: (session: TestSession) => void;
}) {
  const sessionRef = useRef<TestSession | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navTimestampsRef = useRef<number[]>([]);
  const prevQuestionRef = useRef<string | null>(null);

  const flushSave = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.status !== "in_progress") return;
    const q = useQuestionStore.getState();
    saveAnswer(session.id, {
      answers: q.answers,
      currentQuestionId: q.currentQuestionId ?? undefined,
      currentSectionId: q.currentSectionId ?? undefined,
      markedForReview: q.markedForReview,
      visited: q.visited,
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
      const res = await fetch(
        `/api/cbt/test-session/timer?testId=${encodeURIComponent(params.testId)}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        endsAt: number;
        remainingSeconds: number;
        expired: boolean;
      };
      const session = sessionRef.current;
      if (session) {
        sessionRef.current = syncTestSessionFromServerEndsAt(session, data.endsAt);
        useTimerStore.getState().restore(data.endsAt);
      }
      if (data.expired) {
        params.onExpired?.();
      }
      return data;
    } catch {
      return null;
    }
  }, [params]);

  const applyShuffledExam = useCallback((session: TestSession) => {
    const base = getExamById(params.testId);
    if (!base) return;
    const shuffled = buildShuffledExamView(base, session);
    const q = useQuestionStore.getState();
    useQuestionStore.getState().restoreState({
      exam: shuffled,
      answers: session.answers ?? q.answers,
      visited: session.visited ?? {},
      markedForReview: session.markedForReview ?? {},
      currentQuestionId:
        session.currentQuestionId ?? shuffled.sections[0]?.questionIds[0],
      currentSectionId:
        session.currentSectionId ?? shuffled.sections[0]?.id,
    });
  }, [params.testId]);

  const postServerSubmit = useCallback(
    async (session: TestSession, mode: "submitted" | "auto_submitted") => {
      if (!session.signedAnswerKey || !session.answerKey) return null;
      try {
        const res = await fetch("/api/cbt/test-session/submit", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            testId: params.testId,
            sessionId: session.id,
            instituteId: params.instituteId,
            answers: session.answers ?? {},
            signedAnswerKey: session.signedAnswerKey,
            integrityEvents: session.integrityEvents,
            status: mode,
            submittedAt: Date.now(),
          }),
        });
        if (!res.ok) return null;
        return (await res.json()) as {
          score: number;
          resultBreakdown: TestSession["resultBreakdown"];
          integrityScore: number;
          flagged: boolean;
        };
      } catch {
        return null;
      }
    },
    [params.instituteId, params.testId],
  );

  const beginSession = useCallback(async () => {
    autoSubmitExpiredTests();
    let session = startTest({
      testId: params.testId,
      studentId: params.studentId,
      instituteId: params.instituteId,
      durationMinutes: params.durationMinutes,
    });
    if (!session) {
      const prior = getRepositories()
        .testSessions.list()
        .find(
          (s) =>
            s.testId === params.testId &&
            s.studentId === params.studentId &&
            s.status !== "in_progress",
        );
      if (prior) {
        params.onSubmitted?.(hydrateSessionAnswers(prior));
        return null;
      }
      return null;
    }

    session = hydrateSessionAnswers(session);

    try {
      const res = await fetch("/api/cbt/test-session/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: params.testId,
          durationMinutes: params.durationMinutes,
          sessionId: session.id,
          instituteId: params.instituteId,
          answerKey: session.answerKey,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { signedAnswerKey?: string; endsAt?: number };
        if (data.signedAnswerKey) {
          session = applySignedAnswerKey(session.id, data.signedAnswerKey) ?? session;
          session.signedAnswerKey = data.signedAnswerKey;
        }
      }
    } catch {
      /* local session still usable */
    }

    const timer = await syncServerTimer();
    if (timer?.endsAt) {
      session = syncTestSessionFromServerEndsAt(session, timer.endsAt);
    }

    sessionRef.current = session;
    useTimerStore.getState().restore(session.endsAt);
    applyShuffledExam(session);

    return session;
  }, [applyShuffledExam, params, syncServerTimer]);

  const lockSubmit = useCallback(
    async (mode: "submitted" | "auto_submitted" = "submitted") => {
      flushSave();
      const session = sessionRef.current;
      if (!session) return null;
      const fresh = hydrateSessionAnswers(
        getRepositories().testSessions.getById(session.id) ?? session,
      );
      sessionRef.current = fresh;
      const locked = submitTest(fresh.id, mode);
      if (!locked) return null;
      sessionRef.current = locked;
      await postServerSubmit(locked, mode);
      params.onSubmitted?.(locked);
      return locked;
    },
    [flushSave, params, postServerSubmit],
  );

  const logIntegrity = useCallback(
    (type: TestSessionIntegrityEventType) => {
      const s = sessionRef.current;
      if (s) logIntegrityEvent(s.id, type);
    },
    [],
  );

  useEffect(() => {
    if (!params.enabled) return;

    let prevAnswers = useQuestionStore.getState().answers;
    const unsubQ = useQuestionStore.subscribe((state) => {
      if (state.answers !== prevAnswers) {
        prevAnswers = state.answers;
        scheduleSave();
      }
      const qid = state.currentQuestionId;
      if (qid && qid !== prevQuestionRef.current) {
        const now = Date.now();
        if (detectRapidNavigation(navTimestampsRef.current, now)) {
          logIntegrity("rapid_navigation");
        }
        navTimestampsRef.current = [...navTimestampsRef.current, now].slice(-8);
        prevQuestionRef.current = qid;
      }
    });

    intervalRef.current = setInterval(() => {
      flushSave();
      void syncServerTimer();
      const session = sessionRef.current;
      if (session && getRemainingSeconds(session) <= 0) {
        void lockSubmit("auto_submitted");
        params.onExpired?.();
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
    const onCopy = (e: ClipboardEvent) => {
      if (sessionRef.current) {
        e.preventDefault();
        logIntegrity("copy_attempt");
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (sessionRef.current) {
        e.preventDefault();
        logIntegrity("paste_attempt");
      }
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement && sessionRef.current) {
        logIntegrity("fullscreen_exit");
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("fullscreenchange", onFullscreen);

    return () => {
      unsubQ();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [
    params.enabled,
    flushSave,
    lockSubmit,
    params,
    scheduleSave,
    syncServerTimer,
    logIntegrity,
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
