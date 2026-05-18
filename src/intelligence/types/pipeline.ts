import { z } from "zod";

/** Exam-agnostic identifier — resolved via exam profile registry, not hardcoded switches. */
export type ExamProfileId = string;

export const pipelineJobStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);
export type PipelineJobStatus = z.infer<typeof pipelineJobStatusSchema>;

export const reviewStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "needs_edit",
  "reprocess",
]);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const verificationStatusSchema = z.enum([
  "pending",
  "agreed",
  "disputed",
  "low_confidence",
  "failed",
]);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const questionFormatSchema = z.enum([
  "mcq_single",
  "numerical",
  "assertion_reason",
  "multi_correct",
  "unknown",
]);
export type QuestionFormat = z.infer<typeof questionFormatSchema>;

export const segmentedOptionSchema = z.object({
  label: z.string(),
  text: z.string(),
});

export const segmentedQuestionSchema = z.object({
  questionText: z.string().min(1),
  options: z.array(segmentedOptionSchema).default([]),
  correctAnswer: z.string().optional(),
  subject: z.string().optional(),
  year: z.number().int().optional(),
  examProfileId: z.string(),
  questionFormat: questionFormatSchema.default("unknown"),
  questionNumber: z.number().int().optional(),
  rawBlock: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
  parserConfidence: z.number().min(0).max(1).optional(),
  extractionIssues: z.array(z.string()).default([]),
  formattingIssues: z.array(z.string()).default([]),
  normalizedText: z.string().optional(),
  normalizationVersion: z.string().optional(),
  malformed: z.boolean().default(false),
});
export type SegmentedQuestion = z.infer<typeof segmentedQuestionSchema>;

export const qualityScoreSignalSchema = z.object({
  extractionConfidence: z.number().min(0).max(1),
  parserConfidence: z.number().min(0).max(1),
  aiAgreementScore: z.number().min(0).max(1),
  answerKeyMatch: z.number().min(0).max(1),
  metadataConfidence: z.number().min(0).max(1),
  formattingQuality: z.number().min(0).max(1),
});
export type QualityScoreSignal = z.infer<typeof qualityScoreSignalSchema>;

export const qualityScoreSchema = z.object({
  overallQualityScore: z.number().min(0).max(100),
  signals: qualityScoreSignalSchema,
  issues: z.array(z.string()).default([]),
  requiresReview: z.boolean(),
});
export type QualityScore = z.infer<typeof qualityScoreSchema>;

export const reviewPrioritySchema = z.enum(["urgent", "high", "normal", "low"]);
export type ReviewPriority = z.infer<typeof reviewPrioritySchema>;

export type EmbeddingTargetType = "question" | "solution" | "concept";

export const structuredSolutionSchema = z.object({
  summary: z.string(),
  steps: z.array(
    z.object({
      order: z.number().int(),
      title: z.string(),
      body: z.string(),
    }),
  ),
  finalAnswer: z.string().optional(),
  keyConcepts: z.array(z.string()).default([]),
});
export type StructuredSolution = z.infer<typeof structuredSolutionSchema>;

export const questionMetadataSchema = z.object({
  subject: z.string().optional(),
  chapter: z.string().optional(),
  topic: z.string().optional(),
  subtopic: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  conceptTags: z.array(z.string()).default([]),
  formulaTags: z.array(z.string()).default([]),
  cognitiveStyle: z
    .enum(["conceptual", "formula_heavy", "mixed", "unknown"])
    .default("unknown"),
  taxonomyConfidence: z.number().min(0).max(1).default(0),
});
export type QuestionMetadata = z.infer<typeof questionMetadataSchema>;

export const difficultySignalSchema = z.object({
  staticScore: z.number().min(0).max(1).optional(),
  studentAccuracy: z.number().min(0).max(1).optional(),
  medianSolveTimeSeconds: z.number().optional(),
  skipRate: z.number().min(0).max(1).optional(),
  negativeMarkingRate: z.number().min(0).max(1).optional(),
  compositeScore: z.number().min(0).max(1),
  sampleSize: z.number().int().default(0),
});
export type DifficultySignal = z.infer<typeof difficultySignalSchema>;

export const verificationResultSchema = z.object({
  agreementScore: z.number().min(0).max(1),
  confidenceScore: z.number().min(0).max(1),
  status: verificationStatusSchema,
  reviewerNotes: z.string().optional(),
  discrepancies: z.array(z.string()).default([]),
});
export type VerificationResult = z.infer<typeof verificationResultSchema>;

export type PipelineJobName =
  | "extraction"
  | "segmentation"
  | "ai_solution"
  | "verification"
  | "metadata"
  | "difficulty"
  | "publish_ready";

export interface PipelineJobPayload {
  sourceId: string;
  instituteId: string;
  examProfileId: ExamProfileId;
  extractionJobId?: string;
  structuredQuestionId?: string;
  solutionId?: string;
}
