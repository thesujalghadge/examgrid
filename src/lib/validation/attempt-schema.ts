import { z } from "zod";
import type { PersistedExamAttempt } from "@/types/exam";

const violationSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "tab_switch",
    "window_blur",
    "fullscreen_exit",
    "browser_back",
  ]),
  timestamp: z.number(),
});

const examResultSchema = z
  .object({
    examId: z.string().min(1),
    examTitle: z.string(),
    candidateName: z.string(),
    rollNumber: z.string(),
    submittedAt: z.number(),
    durationUsedSeconds: z.number(),
    totalQuestions: z.number(),
    attempted: z.number(),
    correct: z.number(),
    incorrect: z.number(),
    unattempted: z.number(),
    totalScore: z.number(),
    maxScore: z.number(),
    sectionScores: z.array(z.unknown()),
    violationCount: z.number().optional(),
  })
  .passthrough();

export const persistedExamAttemptSchema = z.object({
  version: z.literal(1),
  examId: z.string().min(1),
  candidateRoll: z.string().min(1),
  lifecycle: z.enum([
    "idle",
    "instructions_viewed",
    "declaration_signed",
    "in_progress",
    "submitted",
  ]),
  examEndsAt: z.number(),
  startedAt: z.number(),
  currentQuestionId: z.string().min(1),
  currentSectionId: z.string().min(1),
  answers: z.record(z.string(), z.union([z.string(), z.null()])),
  visited: z.record(z.string(), z.boolean()),
  markedForReview: z.record(z.string(), z.boolean()),
  violations: z.array(violationSchema).optional(),
  submittedAt: z.number().optional(),
  result: examResultSchema.optional(),
});

export function parsePersistedExamAttempt(
  data: unknown,
):
  | { success: true; data: PersistedExamAttempt }
  | { success: false; error: string } {
  const result = persistedExamAttemptSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => i.message).join("; "),
    };
  }
  return { success: true, data: result.data as PersistedExamAttempt };
}
