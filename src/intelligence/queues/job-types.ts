import type { PipelineJobPayload } from "@/intelligence/types/pipeline";

export type ExtractionJobData = PipelineJobPayload;
export type SegmentationJobData = PipelineJobPayload & {
  extractionJobId: string;
};
export type AiSolutionJobData = PipelineJobPayload & {
  structuredQuestionId: string;
};
export type VerificationJobData = PipelineJobPayload & {
  solutionId: string;
};
export type MetadataJobData = PipelineJobPayload & {
  structuredQuestionId: string;
};
export type DifficultyJobData = PipelineJobPayload & {
  structuredQuestionId: string;
};
