import { z } from "zod";
import crypto from "crypto";

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

const qId = crypto.randomUUID();
const breakdown = {
  correct: 1, incorrect: 0, unattempted: 0, attempted: 1, maxScore: 4, rawScore: 4, integrityPenalty: 0, finalScore: 4, durationSeconds: 60,
  perQuestion: [{
    questionId: qId,
    bankQuestionId: qId,
    legacyClientKey: qId,
    selected: "A", correct: true, marksAwarded: 4, maxMarks: 4
  }]
};

const payload = {
  sessionId: crypto.randomUUID(),
  testId: crypto.randomUUID(),
  instituteId: crypto.randomUUID(),
  studentId: crypto.randomUUID(),
  status: "submitted",
  startedAt: Date.now(),
  submittedAt: Date.now(),
  score: 4,
  maxScore: 4,
  durationSeconds: 60,
  flagged: false,
  integrityScore: 100,
  answers: {},
  resultBreakdown: breakdown,
};

const parsed = persistedCbtSubmissionSchema.parse(payload);
console.log(JSON.stringify(parsed.resultBreakdown.perQuestion, null, 2));
