import { buildAnswerKeyFromExam } from "@/lib/cbt/answer-key";
import { makeCbtId } from "@/lib/cbt/cbt-ids";
import {
  computeIntegrityScore,
  isSessionFlagged,
} from "@/lib/cbt/integrity-engine";
import {
  buildOptionOrderMap,
  shuffleArray,
} from "@/lib/cbt/randomization";
import {
  loadSessionAnswers,
  saveSessionAnswers,
} from "@/lib/cbt/test-session-answers-storage";
import { getExamById } from "@/lib/exam-catalog";
import { logCbtGuard, logCbtWarning } from "@/lib/logging/runtime-logger";
import { getSafeFirstQuestionId } from "@/lib/validation/exam-integrity";
import { evaluateTestSession } from "@/services/test-evaluation";
import type { TestSession, TestSessionIntegrityEvent } from "@/types/test-session";

// --- Local Storage Fallback Helpers ---
const META_PREFIX = "examgrid:session_meta:";

export function getSessionLocal(id: string): TestSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${META_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as TestSession;
  } catch {
    return null;
  }
}

export function saveSessionLocal(session: TestSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${META_PREFIX}${session.id}`, JSON.stringify(session));
  } catch (e) {
    console.error("Failed to save session to localStorage", e);
  }
}

export function listSessionsLocal(): TestSession[] {
  if (typeof window === "undefined") return [];
  const out: TestSession[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(META_PREFIX)) {
        const raw = localStorage.getItem(k);
        if (raw) out.push(JSON.parse(raw));
      }
    }
  } catch {}
  return out;
}
// -------------------------------------

function allQuestionIds(testId: string): string[] {
  const exam = getExamById(testId);
  if (!exam) return [];
  return exam.sections.flatMap((s) => s.questionIds);
}

function ensureSessionRandomization(
  session: TestSession,
  testId: string,
): TestSession {
  if (session.questionOrder?.length) return session;
  const qids = allQuestionIds(testId);
  const order = qids; // NTA exams require preserving original section/question order
  const optionOrderMap = {}; // NTA exams require preserving A,B,C,D option order
  return { ...session, questionOrder: order, optionOrderMap };
}

export function startTest(params: {
  testId: string;
  studentId: string;
  instituteId: string;
  durationMinutes: number;
}): TestSession | null {
  const existing = listSessionsLocal().find(s => s.testId === params.testId && s.studentId === params.studentId && s.status === "in_progress");
  if (existing) {
    const withAnswers = hydrateSessionAnswers(existing);
    logCbtGuard("startTest resumed existing session", { sessionId: withAnswers.id });
    return withAnswers;
  }

  const submitted = listSessionsLocal().find(
      (s) =>
        s.testId === params.testId &&
        s.studentId === params.studentId &&
        (s.status === "submitted" || s.status === "auto_submitted"),
    );
  if (submitted) {
    logCbtWarning("startTest blocked — already submitted", {
      testId: params.testId,
      studentId: params.studentId,
    });
    return null;
  }

  const exam = getExamById(params.testId);
  const firstQ = exam ? getSafeFirstQuestionId(exam) : null;
  const qids = exam ? exam.sections.flatMap((s) => s.questionIds) : [];
  const questionOrder = qids; // NTA exams require preserving original section/question order
  const optionOrderMap = {}; // NTA exams require preserving A,B,C,D option order
  const answerKey = exam ? buildAnswerKeyFromExam(exam) : undefined;
  const displayFirst = questionOrder[0] ?? firstQ;

  const now = Date.now();
  const session: TestSession = {
    id: makeCbtId("tsess"),
    studentId: params.studentId,
    testId: params.testId,
    instituteId: params.instituteId,
    status: "in_progress",
    startedAt: now,
    endsAt: now + params.durationMinutes * 60 * 1000,
    answers: {},
    lastSavedAt: now,
    currentQuestionId: displayFirst ?? undefined,
    currentSectionId: exam?.sections[0]?.id,
    markedForReview: {},
    visited: displayFirst ? { [displayFirst]: true } : {},
    integrityEvents: [],
    integrityScore: 100,
    flagged: false,
    questionOrder,
    optionOrderMap,
    answerKey,
  };
  saveSessionAnswers(session.id, {});
  saveSessionLocal(session);
  logCbtGuard("startTest created session", { sessionId: session.id });
  return session;
}

export function hydrateSessionAnswers(session: TestSession): TestSession {
  const stored = loadSessionAnswers(session.id);
  const answers = stored ?? session.answers ?? {};
  return { ...session, answers };
}

export function saveAnswer(
  sessionId: string,
  patch: {
    answers?: Record<string, string | null>;
    currentQuestionId?: string;
    currentSectionId?: string;
    markedForReview?: Record<string, boolean>;
    visited?: Record<string, boolean>;
    telemetry?: TestSession["telemetry"];
  },
): TestSession | null {
  const raw = getSessionLocal(sessionId);
  if (!raw || raw.status !== "in_progress") return null;
  const session = hydrateSessionAnswers(raw);

  if (patch.answers) {
    saveSessionAnswers(sessionId, patch.answers);
  }

  const updated: TestSession = {
    ...session,
    answers: patch.answers ?? session.answers,
    currentQuestionId: patch.currentQuestionId ?? session.currentQuestionId,
    currentSectionId: patch.currentSectionId ?? session.currentSectionId,
    markedForReview: patch.markedForReview ?? session.markedForReview,
    visited: patch.visited ?? session.visited,
    telemetry: patch.telemetry ?? session.telemetry,
    lastSavedAt: Date.now(),
  };
  saveSessionLocal(updated);
  return updated;
}

export function logIntegrityEvent(
  sessionId: string,
  type: TestSessionIntegrityEvent["type"],
  meta?: Record<string, string | number>,
): void {
  const session = getSessionLocal(sessionId);
  if (!session || session.status !== "in_progress") return;
  const events: TestSessionIntegrityEvent[] = [
    ...(session.integrityEvents ?? []),
    { type, at: Date.now(), meta },
  ];
  const integrityScore = computeIntegrityScore(events);
  const flagged = isSessionFlagged(integrityScore);
  const updated = {
    ...session,
    integrityEvents: events,
    integrityScore,
    flagged,
    lastSavedAt: Date.now(),
  };
  saveSessionLocal(updated);
  logCbtGuard("integrity event", { sessionId, type, integrityScore, flagged });
}

export function submitTest(
  sessionId: string,
  mode: "submitted" | "auto_submitted" = "submitted",
  submittedAt = Date.now(),
): TestSession | null {
  const raw = getSessionLocal(sessionId);
  if (!raw) return null;
  const session = ensureSessionRandomization(
    hydrateSessionAnswers(raw),
    raw.testId,
  );

  if (session.status !== "in_progress") {
    logCbtGuard("submitTest skipped — already locked", {
      sessionId,
      status: session.status,
    });
    return session;
  }

  const answers = session.answers ?? {};
  let resultBreakdown = session.resultBreakdown;
  let score = session.score;

  if (session.answerKey && !resultBreakdown) {
    resultBreakdown = evaluateTestSession({
      sessionId: session.id,
      answers,
      answerKey: session.answerKey,
      startedAt: session.startedAt,
      submittedAt,
      integrityEvents: session.integrityEvents,
      useCache: true,
    });
    score = resultBreakdown.finalScore;
  }

  const integrityScore =
    session.integrityScore ?? computeIntegrityScore(session.integrityEvents);
  const flagged = session.flagged ?? isSessionFlagged(integrityScore);

  const locked: TestSession = {
    ...session,
    status: mode,
    lastSavedAt: submittedAt,
    resultBreakdown,
    score,
    integrityScore,
    flagged,
  };
  saveSessionLocal(locked);
  logCbtGuard("submitTest locked session", {
    sessionId,
    mode,
    score,
    flagged,
  });
  return locked;
}

export function applySignedAnswerKey(
  sessionId: string,
  signedAnswerKey: string,
): TestSession | null {
  const session = getSessionLocal(sessionId);
  if (!session) return null;
  const updated = { ...session, signedAnswerKey };
  saveSessionLocal(updated);
  return updated;
}

export function autoSubmitExpiredTests(now = Date.now()): TestSession[] {
  const expired = listSessionsLocal().filter((s) => s.status === "in_progress" && s.endsAt <= now);
  const out: TestSession[] = [];
  for (const s of expired) {
    const locked = submitTest(s.id, "auto_submitted", now);
    if (locked) out.push(locked);
  }
  return out;
}

export function getRemainingSeconds(session: TestSession, now = Date.now()): number {
  return Math.max(0, Math.floor((session.endsAt - now) / 1000));
}

export function syncTestSessionFromServerEndsAt(
  session: TestSession,
  serverEndsAt: number,
): TestSession {
  if (session.endsAt === serverEndsAt) return session;
  const updated = { ...session, endsAt: serverEndsAt };
  saveSessionLocal(updated);
  return updated;
}

export function listTestSessionsForTest(
  testId: string,
  instituteId: string,
): TestSession[] {
  return listSessionsLocal()
    .filter((s) => s.testId === testId && s.instituteId === instituteId)
    .map((s) => hydrateSessionAnswers(s));
}
