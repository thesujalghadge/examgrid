import { z } from "zod";
import type { BankQuestion } from "@/types/question-bank";
import { RepositoryError } from "@/lib/errors/repository-error";

const bankOptionSchema = z.object({
  label: z.string().min(1),
  text: z.string(),
});

export const bankQuestionStoredSchema = z.object({
  id: z.string().min(1),
  subject: z.string().min(1),
  chapter: z.string().min(1),
  topic: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionType: z.enum(["MCQ_SINGLE", "NUMERICAL"]),
  questionText: z.string().min(1),
  options: z.array(bankOptionSchema),
  correctAnswer: z.string().min(1),
  solution: z.string(),
  marks: z.number().nonnegative(),
  negativeMarks: z.number().nonnegative(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

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
