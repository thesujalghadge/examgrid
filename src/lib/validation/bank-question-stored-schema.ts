import { z } from "zod";
import type { BankQuestion } from "@/types/question-bank";
import { RepositoryError } from "@/lib/errors/repository-error";

const bankOptionSchema = z.object({
  label: z.string().min(1),
  text: z.string(),
});

const difficultySchema = z.enum(["easy", "medium", "hard"]);
const sourceTypeSchema = z.enum(["PYQ", "generated", "institute", "custom"]);
const tagListSchema = z.array(z.string().min(1)).default([]);

const questionIntelligenceSchema = z.object({
  examSource: z.string().min(1).default("Custom"),
  examYear: z.number().int().min(1900).max(2100).optional(),
  subtopic: z.string().default(""),
  difficultyLevel: difficultySchema.optional(),
  cognitiveLevel: z.string().min(1).default("apply"),
  estimatedSolveTimeSeconds: z.number().int().nonnegative().default(120),
  formulaTags: tagListSchema,
  conceptTags: tagListSchema,
  mistakeTags: tagListSchema,
  sourceType: sourceTypeSchema.default("custom"),
  solutionDetailed: z.string().default(""),
  solutionShort: z.string().default(""),
  relatedQuestionIds: z.array(z.string().min(1)).default([]),
  normalizedQuestionText: z.string().default(""),
  similarityFingerprint: z.string().default(""),
  similarityGroupKey: z.string().default(""),
  archetypeKey: z.string().default(""),
  weightageScore: z.number().nonnegative().default(1),
  predictiveScore: z.number().nonnegative().default(0),
});

export const bankQuestionStoredSchema = z
  .object({
  id: z.string().min(1),
  subject: z.string().min(1),
  chapter: z.string().min(1),
  topic: z.string().min(1),
  difficulty: difficultySchema,
  questionType: z.enum(["MCQ_SINGLE", "NUMERICAL"]),
  questionText: z.string().min(1),
  options: z.array(bankOptionSchema),
  correctAnswer: z.string().min(1),
  solution: z.string(),
  marks: z.number().nonnegative(),
  negativeMarks: z.number().nonnegative(),
  createdAt: z.number(),
  updatedAt: z.number(),
})
  .merge(questionIntelligenceSchema)
  .transform((question) => ({
    ...question,
    difficultyLevel: question.difficultyLevel ?? question.difficulty,
    solutionDetailed: question.solutionDetailed || question.solution,
    solutionShort: question.solutionShort || question.solution,
  }));

export const bankQuestionListSchema = z.array(bankQuestionStoredSchema);

export interface QuestionValidationIssue {
  path: string;
  message: string;
}

export function formatQuestionValidationIssues(
  issues: z.core.$ZodIssue[],
): QuestionValidationIssue[] {
  return issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "question",
    message: issue.message,
  }));
}

export function assertBankQuestionForWrite(
  data: unknown,
  operation: string,
): BankQuestion {
  const result = bankQuestionStoredSchema.safeParse(data);
  if (result.success) return result.data;

  const issues = formatQuestionValidationIssues(result.error.issues);
  const detail = issues
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join("; ");

  throw new RepositoryError({
    code: "VALIDATION_FAILED",
    repository: "QuestionRepository",
    operation,
    message: `Question validation failed before write: ${detail}`,
    cause: issues,
  });
}

export function parseBankQuestionList(
  data: unknown,
):
  | { success: true; data: BankQuestion[] }
  | { success: false; error: string } {
  const result = bankQuestionListSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => i.message).join("; "),
    };
  }
  return { success: true, data: result.data };
}
