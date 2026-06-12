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

const testSession = {
  id: "tsess_123",
  studentId: "student123",
  testId: "test1234",
  instituteId: "inst123",
  status: "in_progress",
  startedAt: 123456,
  endsAt: 123456,
  lastSavedAt: 123456,
  questionOrder: [],
  optionOrderMap: {},
  integrityScore: 100,
  flagged: false,
  score: 0,
  answerKey: {
    "q1": {
      type: "MCQ_SINGLE",
      correctOptionId: "optA",
      marks: 4,
      negativeMarks: 1,
    }
  },
  signedAnswerKey: "signed.jwt",
};

const lean = testSession;
const parsed = sessionSchema.safeParse(lean);
console.log("Success?", parsed.success);
if (!parsed.success) {
  console.log("Errors:", parsed.error.issues);
}
