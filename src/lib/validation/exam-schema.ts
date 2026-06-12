import { z } from "zod";

const examOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  text: z.string(),
});

const examQuestionSchema = z.object({
  id: z.string().min(1),
  sectionId: z.string().min(1),
  number: z.number().int().positive(),
  type: z.enum(["MCQ_SINGLE", "NUMERICAL"]),
  text: z.string(),
  stemImage: z.string().optional(),
  images: z.array(z.string()).optional(),
  hasImage: z.boolean().optional(),
  options: z.array(examOptionSchema),
  correctOptionId: z.string().optional(),
  correctNumericalAnswer: z.string().optional(),
  marks: z.number().nonnegative(),
  negativeMarks: z.number().nonnegative(),
}).passthrough();

const examSectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  questionIds: z.array(z.string().min(1)),
});

export const examDefinitionInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string(),
  examType: z.enum(["JEE_MAIN", "NEET", "CET"]),
  durationMinutes: z.number().int().positive(),
  totalQuestions: z.number().int().nonnegative(),
  sections: z.array(examSectionSchema).min(1),
  questions: z.record(z.string(), examQuestionSchema),
  instructions: z.array(z.string()),
  scheduledAt: z.string().min(1),
});

export type ExamDefinitionInput = z.infer<typeof examDefinitionInputSchema>;

export function parseExamDefinition(
  data: unknown,
):
  | { success: true; data: ExamDefinitionInput }
  | { success: false; error: string } {
  const result = examDefinitionInputSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => i.message).join("; "),
    };
  }
  return { success: true, data: result.data };
}
