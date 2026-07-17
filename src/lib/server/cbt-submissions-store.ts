import "server-only";

import { createSupabaseClientFromEnv } from "@/lib/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { TestResultBreakdown, TestSession } from "@/types/test-session";

const questionResultSchema = z.object({
  questionId: z.string(),
  bankQuestionId: z.string().uuid().nullable(),
  legacyClientKey: z.string().optional(),
  selected: z.string().nullable(),
  correct: z.boolean(),
  marksAwarded: z.number(),
  maxMarks: z.number(),
  timeSpentSeconds: z.number().optional(),
  visitedCount: z.number().optional(),
  answerChangedCount: z.number().optional(),
  firstAnswer: z.string().nullable().optional(),
  markedForReview: z.boolean().optional(),
});

const resultBreakdownSchema = z.object({
  correct: z.number(),
  incorrect: z.number(),
  unattempted: z.number(),
  attempted: z.number(),
  maxScore: z.number(),
  rawScore: z.number(),
  negativeMarks: z.number().optional(),
  integrityPenalty: z.number(),
  finalScore: z.number(),
  durationSeconds: z.number(),
  perQuestion: z.array(questionResultSchema),
});

export const persistedCbtSubmissionSchema = z.object({
  sessionId: z.string(),
  testId: z.string(),
  instituteId: z.string(),
  studentId: z.string(),
  studentRollNumber: z.string().optional(),
  status: z.enum(["submitted", "auto_submitted"]),
  startedAt: z.number(),
  submittedAt: z.number(),
  score: z.number(),
  maxScore: z.number(),
  durationSeconds: z.number(),
  flagged: z.boolean(),
  integrityScore: z.number(),
  answers: z.record(z.string(), z.string().nullable()),
  resultBreakdown: resultBreakdownSchema,
  rank: z.number().nullable().optional(),
  percentile: z.number().nullable().optional(),
});

export type PersistedCbtSubmission = z.infer<typeof persistedCbtSubmissionSchema>;

const cbtAttemptRowSchema = z.object({
  session_id: z.string(),
  test_id: z.string(),
  institute_id: z.string(),
  student_id: z.string().uuid(),
  student_roll_number: z.string(),
  status: z.enum(["submitted", "auto_submitted"]),
  started_at: z.string(),
  submitted_at: z.string(),
  score: z.union([z.number(), z.string()]),
  integrity_score: z.union([z.number(), z.string()]),
  flagged: z.boolean(),
  answers: z.record(z.string(), z.string().nullable()),
  result_breakdown: resultBreakdownSchema,
});

const cbtSubmissionRpcSchema = z.object({
  attempt: cbtAttemptRowSchema,
  result: z.object({
    score: z.union([z.number(), z.string()]),
    percentage: z.union([z.number(), z.string()]).optional(),
    accuracy: z.union([z.number(), z.string()]).optional(),
    rank: z.union([z.number(), z.string(), z.null()]).optional(),
    percentile: z.union([z.number(), z.string(), z.null()]).optional(),
  }),
  answers: z.array(z.unknown()).default([]),
  idempotent: z.boolean(),
});

function numeric(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function toMillis(value: string): number {
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid CBT timestamp: ${value}`);
  }
  return ms;
}

function requireSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase is not configured. CBT submissions require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function parseRpcSubmission(raw: unknown): PersistedCbtSubmission {
  const parsed = cbtSubmissionRpcSchema.parse(raw);
  const breakdown = parsed.attempt.result_breakdown;
  return {
    sessionId: parsed.attempt.session_id,
    testId: parsed.attempt.test_id,
    instituteId: parsed.attempt.institute_id,
    studentId: parsed.attempt.student_id,
    studentRollNumber: parsed.attempt.student_roll_number,
    status: parsed.attempt.status,
    startedAt: toMillis(parsed.attempt.started_at),
    submittedAt: toMillis(parsed.attempt.submitted_at),
    score: numeric(parsed.attempt.score),
    maxScore: breakdown.maxScore,
    durationSeconds: breakdown.durationSeconds,
    flagged: parsed.attempt.flagged,
    integrityScore: numeric(parsed.attempt.integrity_score),
    answers: parsed.attempt.answers,
    resultBreakdown: breakdown,
    rank: parsed.result.rank ? numeric(parsed.result.rank) : null,
    percentile: parsed.result.percentile ? numeric(parsed.result.percentile) : null,
  };
}

export async function saveCbtSubmission(
  entry: PersistedCbtSubmission,
): Promise<PersistedCbtSubmission> {
  const parsed = persistedCbtSubmissionSchema.parse(entry);
  const client = requireSupabase();
  const { data, error } = await client.rpc("submit_cbt_attempt", {
    p_session_id: parsed.sessionId,
    p_test_id: parsed.testId,
    p_institute_id: parsed.instituteId,
    p_student_id: parsed.studentId,
    p_status: parsed.status,
    p_started_at: new Date(parsed.startedAt).toISOString(),
    p_submitted_at: new Date(parsed.submittedAt).toISOString(),
    p_answers: parsed.answers,
    p_result_breakdown: parsed.resultBreakdown,
    p_integrity_score: parsed.integrityScore,
    p_flagged: parsed.flagged,
  });

  if (error) throw new Error(error.message);
  return parseRpcSubmission(data);
}

export async function getCbtSubmission(
  instituteId: string,
  testId: string,
  studentId: string,
): Promise<PersistedCbtSubmission | null> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("get_cbt_submission", {
    p_institute_id: instituteId,
    p_test_id: testId,
    p_student_id: studentId,
  });

  if (error) throw new Error(error.message);
  if (!data) return null;
  return parseRpcSubmission(data);
}

export async function listCbtSubmissions(
  instituteId: string,
  testId: string,
): Promise<PersistedCbtSubmission[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("list_cbt_submissions", {
    p_institute_id: instituteId,
    p_test_id: testId,
  });

  if (error) throw new Error(error.message);
  const parsed = z.array(cbtSubmissionRpcSchema).parse(data ?? []);
  return parsed.map(parseRpcSubmission);
}

export function submissionToTestSession(
  submission: PersistedCbtSubmission,
): TestSession {
  return {
    id: submission.sessionId,
    studentId: submission.studentId,
    testId: submission.testId,
    instituteId: submission.instituteId,
    status: submission.status,
    startedAt: submission.startedAt,
    endsAt: submission.submittedAt,
    answers: submission.answers,
    lastSavedAt: submission.submittedAt,
    questionOrder: [],
    optionOrderMap: {},
    integrityScore: submission.integrityScore,
    flagged: submission.flagged,
    score: submission.score,
    resultBreakdown: submission.resultBreakdown as TestResultBreakdown,
  };
}
