import { z } from "zod";

// ─── V3 Solution Schema ─────────────────────────────────────────────────────
// LLM owns content, UI owns presentation.
// Every field appears exactly once. Renderer decides layout.

export const notationSchema = z.object({
  symbol: z.string().min(1),
  meaning: z.string().min(1),
});

export const stepSchema = z.object({
  title: z.string().min(1),
  reasoning: z.string().min(5),
  equation: z.string().nullable().optional(),
  result: z.string().nullable().optional(),
});

export const assumptionSchema = z.object({
  assumption: z.string().min(3),
  validity: z.string().min(3),
  failure: z.string().min(3),
});

export const finalAnswerSchema = z.object({
  value: z.string().min(1),
  option: z.string().nullable().optional(),
});

export const qualityScoreSchema = z.object({
  clarity: z.number().min(0).max(10),
  pedagogy: z.number().min(0).max(10),
  conciseness: z.number().min(0).max(10),
  repetition: z.number().min(0).max(10),
  notationConsistency: z.number().min(0).max(10),
  finalScore: z.number().min(0).max(10),
});

export const examModeSchema = z.object({
  concepts: z.array(z.string()).min(1),
  keyEquations: z.array(z.string()).min(1),
  fastSteps: z.array(z.string()).min(1).max(7),
  examTricks: z.array(z.string()).nullable().optional(),
  estimatedSolveTime: z.string().min(1),
  finalAnswerSummary: z.string().nullable().optional(),
});

export const learnModeSchema = z.object({
  keyIdea: z.string().min(10),
  conceptChips: z.array(z.string().min(1)).nullable().optional(),
  notations: z.array(notationSchema).optional().default([]),
  steps: z.array(stepSchema).min(2).max(6),
  importantObservation: z.string().nullable().optional(),
  commonMistakes: z.array(z.string().min(3)).nullable().optional(),
  takeaway: z.string().min(5),
  assumptions: z.array(assumptionSchema).nullable().optional(),
  difficultyAdjusted: z.boolean().optional().default(false),
});

export const solutionV3Schema = z.object({
  // ─── Dual Modes ─────────────────────────────────────────
  availableModes: z.array(z.enum(["EXAM", "LEARN"])).default(["EXAM", "LEARN"]),
  examMode: examModeSchema,
  learnMode: learnModeSchema,

  // ─── Shared Content ────────────────────────────────────
  finalAnswer: finalAnswerSchema,

  // ─── Visual Assets (future) ────────────────────────────
  diagrams: z.array(z.string()).optional().default([]),
  graphs: z.array(z.string()).optional().default([]),
  tables: z.array(z.string()).optional().default([]),

  // ─── Teacher Review (future) ───────────────────────────
  isTeacherReviewed: z.boolean().optional().default(false),
  teacherEdits: z.array(z.object({
    field: z.string(),
    original: z.string(),
    edited: z.string(),
    editedBy: z.string(),
    editedAt: z.string(),
  })).optional().default([]),

  // ─── Analytics Metadata ────────────────────────────────
  subject: z.string().min(1),
  topic: z.string().min(1),
  subtopic: z.string().min(1),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  questionType: z.string().min(1),
  primaryConcept: z.string().min(1),

  // ─── Quality Scoring (filled by post-processor) ───────
  qualityScore: qualityScoreSchema.optional(),

  // ─── System Fields ─────────────────────────────────────
  schemaVersion: z.literal(3).default(3),
  promptVersion: z.literal("solution-v3").default("solution-v3"),
  generatedAt: z.string().optional(),
  generatorModel: z.string().optional(),
  validationStatus: z.string().default("pending"),
});

export type SolutionV3 = z.infer<typeof solutionV3Schema>;
export type ExamMode = z.infer<typeof examModeSchema>;
export type LearnMode = z.infer<typeof learnModeSchema>;
export type QualityScore = z.infer<typeof qualityScoreSchema>;
export type SolutionStep = z.infer<typeof stepSchema>;
export type Notation = z.infer<typeof notationSchema>;
export type Assumption = z.infer<typeof assumptionSchema>;
