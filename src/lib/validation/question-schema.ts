import { z } from "zod";

const bankOptionSchema = z.object({
  label: z.string().min(1),
  text: z.string(),
});

export const bankQuestionInputSchema = z.object({
  id: z.string().min(1).optional(),
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
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export const questionImportPayloadSchema = z.object({
  questions: z.array(
    bankQuestionInputSchema.omit({ id: true, createdAt: true, updatedAt: true }),
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
