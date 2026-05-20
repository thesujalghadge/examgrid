import { readStorageJson, writeStorageJson } from "@/lib/storage/safe-json";
import {
  loadSessionAnswers,
  removeSessionAnswers,
  saveSessionAnswers,
} from "@/lib/cbt/test-session-answers-storage";
import { STORAGE_KEYS } from "@/repositories/storage-keys";
import type { TestSessionRepository } from "@/repositories/interfaces/test-session-repository";
import type { TestSession } from "@/types/test-session";
import { z } from "zod";

const integrityEventSchema = z.object({
  type: z.enum([
    "tab_switch",
    "fullscreen_exit",
    "window_blur",
    "copy_attempt",
    "paste_attempt",
    "rapid_navigation",
  ]),
  at: z.number(),
  meta: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

const answerKeyEntrySchema = z.object({
  type: z.enum(["MCQ_SINGLE", "NUMERICAL"]),
  correctOptionId: z.string().optional(),
  correctNumericalAnswer: z.string().optional(),
  marks: z.number(),
  negativeMarks: z.number(),
});

const resultBreakdownSchema = z.object({
  correct: z.number(),
  incorrect: z.number(),
  unattempted: z.number(),
  attempted: z.number(),
  maxScore: z.number(),
  rawScore: z.number(),
  integrityPenalty: z.number(),
  finalScore: z.number(),
  durationSeconds: z.number(),
  perQuestion: z.array(
    z.object({
      questionId: z.string(),
      selected: z.string().nullable(),
      correct: z.boolean(),
      marksAwarded: z.number(),
      maxMarks: z.number(),
    }),
  ),
});

const sessionSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  testId: z.string(),
  instituteId: z.string(),
  status: z.enum(["in_progress", "submitted", "auto_submitted"]),
  startedAt: z.number(),
  endsAt: z.number(),
  answers: z.record(z.string(), z.string().nullable()).optional(),
  lastSavedAt: z.number(),
  currentQuestionId: z.string().optional(),
  currentSectionId: z.string().optional(),
  markedForReview: z.record(z.string(), z.boolean()).optional(),
  visited: z.record(z.string(), z.boolean()).optional(),
  questionOrder: z.array(z.string()).default([]),
  optionOrderMap: z.record(z.string(), z.array(z.number())).default({}),
  integrityEvents: z.array(integrityEventSchema).optional(),
  integrityScore: z.number().optional(),
  flagged: z.boolean().optional(),
  score: z.number().optional(),
  resultBreakdown: resultBreakdownSchema.optional(),
  answerKey: z.record(z.string(), answerKeyEntrySchema).optional(),
  signedAnswerKey: z.string().optional(),
});

function parseList(raw: unknown): TestSession[] {
  const res = z.array(sessionSchema).safeParse(raw);
  return res.success ? (res.data as TestSession[]) : [];
}

function stripAnswers(session: TestSession): TestSession {
  const { answers: _answers, ...rest } = session;
  void _answers;
  return rest;
}

function mergeAnswers(session: TestSession): TestSession {
  const stored = loadSessionAnswers(session.id);
  if (stored) return { ...session, answers: stored };
  if (session.answers) {
    saveSessionAnswers(session.id, session.answers);
    return session;
  }
  return { ...session, answers: {} };
}

export class LocalTestSessionRepository implements TestSessionRepository {
  list(): TestSession[] {
    return readStorageJson({
      storage: "local",
      key: STORAGE_KEYS.testSessions,
      fallback: [],
      validate: (data) => ({ ok: true, value: parseList(data) }),
    }).map(mergeAnswers);
  }

  getById(id: string): TestSession | undefined {
    const row = this.list().find((s) => s.id === id);
    return row;
  }

  getActive(testId: string, studentId: string): TestSession | undefined {
    return this.list().find(
      (s) =>
        s.testId === testId &&
        s.studentId === studentId &&
        s.status === "in_progress",
    );
  }

  save(session: TestSession): void {
    const withDefaults: TestSession = {
      ...session,
      questionOrder: session.questionOrder ?? [],
      optionOrderMap: session.optionOrderMap ?? {},
    };
    if (withDefaults.answers) {
      saveSessionAnswers(withDefaults.id, withDefaults.answers);
    }
    const lean = stripAnswers(withDefaults);
    const parsed = sessionSchema.safeParse(lean);
    if (!parsed.success) return;
    const all = parseList(
      readStorageJson({
        storage: "local",
        key: STORAGE_KEYS.testSessions,
        fallback: [],
        validate: (data) => ({ ok: true, value: data }),
      }),
    ).filter((s) => s.id !== parsed.data.id);
    all.push(parsed.data as TestSession);
    writeStorageJson("local", STORAGE_KEYS.testSessions, all);
  }

  delete(id: string): void {
    removeSessionAnswers(id);
    writeStorageJson(
      "local",
      STORAGE_KEYS.testSessions,
      parseList(
        readStorageJson({
          storage: "local",
          key: STORAGE_KEYS.testSessions,
          fallback: [],
          validate: (data) => ({ ok: true, value: data }),
        }),
      ).filter((s) => s.id !== id),
    );
  }
}
