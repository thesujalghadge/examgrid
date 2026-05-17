import { z } from "zod";

const bankOptionSchema = z.object({
  label: z.string().min(1),
  text: z.string(),
});

const difficultySchema = z.enum(["easy", "medium", "hard"]);
const sourceTypeSchema = z.enum(["PYQ", "generated", "institute", "custom"]);
const tagListSchema = z.array(z.string().min(1)).default([]);

const bankQuestionInputBaseSchema = z.object({
  id: z.string().min(1).optional(),
  subject: z.string().min(1),
  examSource: z.string().min(1).default("Custom"),
  examYear: z.number().int().min(1900).max(2100).optional(),
  chapter: z.string().min(1),
  topic: z.string().min(1),
  subtopic: z.string().default(""),
  difficulty: difficultySchema.optional(),
  difficultyLevel: difficultySchema.default("medium"),
  cognitiveLevel: z.string().min(1).default("apply"),
  estimatedSolveTimeSeconds: z.number().int().nonnegative().default(120),
  formulaTags: tagListSchema,
  conceptTags: tagListSchema,
  mistakeTags: tagListSchema,
  sourceType: sourceTypeSchema.default("custom"),
  questionType: z.enum(["MCQ_SINGLE", "NUMERICAL"]),
  questionText: z.string().min(1),
  options: z.array(bankOptionSchema),
  correctAnswer: z.string().min(1),
  solution: z.string().default(""),
  solutionDetailed: z.string().default(""),
  solutionShort: z.string().default(""),
  relatedQuestionIds: z.array(z.string().min(1)).default([]),
  normalizedQuestionText: z.string().default(""),
  similarityFingerprint: z.string().default(""),
  similarityGroupKey: z.string().default(""),
  archetypeKey: z.string().default(""),
  weightageScore: z.number().nonnegative().default(1),
  predictiveScore: z.number().nonnegative().default(0),
  marks: z.number().nonnegative(),
  negativeMarks: z.number().nonnegative(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export const bankQuestionInputSchema = bankQuestionInputBaseSchema.transform((question) => ({
  ...question,
  difficulty: question.difficulty ?? question.difficultyLevel,
  solutionDetailed: question.solutionDetailed || question.solution,
  solutionShort: question.solutionShort || question.solution,
}));

export const questionImportPayloadSchema = z.object({
  questions: z.array(
    bankQuestionInputBaseSchema
      .omit({ id: true, createdAt: true, updatedAt: true })
      .transform((question) => ({
        ...question,
        difficulty: question.difficulty ?? question.difficultyLevel,
        solutionDetailed: question.solutionDetailed || question.solution,
        solutionShort: question.solutionShort || question.solution,
      })),
  ),
});

export type BankQuestionInput = z.infer<typeof bankQuestionInputSchema>;
export type QuestionImportPayloadInput = z.infer<
  typeof questionImportPayloadSchema
>;

export function parseQuestionImportPayload(
  data: unknown,
):
  | { success: true; data: QuestionImportPayloadInput }
  | { success: false; error: string } {
  const result = questionImportPayloadSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => i.message).join("; "),
    };
  }
  return { success: true, data: result.data };
}
