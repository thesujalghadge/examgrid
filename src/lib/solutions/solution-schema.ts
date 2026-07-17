import { z } from "zod";

export const solutionMetadataSchema = z.object({
  summary: z.string().min(5),
  concepts: z.array(z.string().min(1)).optional().default([]),
  formulas: z.array(z.string().min(1)).optional(),
  steps: z.array(z.object({
    title: z.string().min(1),
    explanation: z.string().min(5),
    equation: z.string().nullable().optional()
  })).optional().default([]),
  shortcut: z.string().min(2).nullable().optional(),
  commonMistake: z.string().min(5).nullable().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  estimatedSolveTime: z.string().min(2).describe("Estimated time string, e.g. '2 mins'"),
  finalAnswer: z.object({
    value: z.string().min(1),
    option: z.string().nullable().optional()
  }).optional(),
  optionAnalysis: z.array(z.object({
    option: z.string(),
    whyCorrect: z.string().nullable().optional(),
    whyWrong: z.string().nullable().optional()
  })).optional(),
  // Add fallback properties that the system currently relies on
  subject: z.string().optional(),
  chapter: z.string().optional(),
  subchapter: z.string().optional(),
  confidence: z.number().optional(),
  model_answer: z.string().optional(),
  derived_answer: z.string().optional(),
  extracted_options: z.record(z.string(), z.string()).nullable().optional()
});

export type SolutionMetadata = z.infer<typeof solutionMetadataSchema>;
