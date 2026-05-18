import { isRedisConfigured } from "@/intelligence/queues/connection";
import {
  getAiSolutionQueue,
  getDifficultyQueue,
  getExtractionQueue,
  getMetadataQueue,
  getSegmentationQueue,
  getVerificationQueue,
} from "@/intelligence/queues/queues";
import { runExtractionJob } from "@/intelligence/services/pyq-ingestion/ingestion-service";
import { runSegmentationJob } from "@/intelligence/services/question-parser/parser-service";
import { runSolutionJob } from "@/intelligence/services/ai-solution-engine/solution-service";
import { verifySolution } from "@/intelligence/services/verification-engine/verification-service";
import { extractMetadata } from "@/intelligence/services/metadata-engine/metadata-service";
import { runDifficultyJob } from "@/intelligence/services/difficulty-engine/difficulty-service";
import { enqueueEmbeddingGeneration } from "@/intelligence/services/embeddings/embedding-service";
import { computeQuestionQualityScore } from "@/intelligence/services/quality/quality-service";
import { routeQuestionToReviewQueue } from "@/intelligence/services/review/review-queue-service";
import type { ExamProfileId } from "@/intelligence/types/pipeline";

export interface PipelineStartInput {
  sourceId: string;
  extractionJobId: string;
  instituteId: string;
  examProfileId: ExamProfileId;
}

/** Enqueue full pipeline or run inline when Redis is unavailable (local dev). */
export async function enqueuePipelineAfterUpload(
  input: PipelineStartInput,
): Promise<boolean> {
  if (!isRedisConfigured()) {
    await runFullPipelineInline(input);
    return false;
  }

  try {
    await getExtractionQueue().add(
      "extract",
      {
        sourceId: input.sourceId,
        instituteId: input.instituteId,
        examProfileId: input.examProfileId,
        extractionJobId: input.extractionJobId,
      },
      { jobId: input.extractionJobId },
    );
    return true;
  } catch {
    await runFullPipelineInline(input);
    return false;
  }
}

export async function runFullPipelineInline(
  input: PipelineStartInput,
): Promise<void> {
  await runExtractionJob(input.extractionJobId);
  const questions = await runSegmentationJob(input.extractionJobId);

  for (const question of questions) {
    const solution = await runSolutionJob(question.id);
    await verifySolution(solution.id);
    await extractMetadata(question.id);
    await runDifficultyJob(question.id);
    computeQuestionQualityScore(question.id);
    routeQuestionToReviewQueue(question.id);
    enqueueEmbeddingGeneration(question.id);
  }
}

export async function enqueueDownstreamForQuestion(
  structuredQuestionId: string,
  base: Omit<PipelineStartInput, "extractionJobId" | "sourceId"> & {
    sourceId: string;
    extractionJobId: string;
  },
): Promise<void> {
  const payload = {
    sourceId: base.sourceId,
    instituteId: base.instituteId,
    examProfileId: base.examProfileId,
    extractionJobId: base.extractionJobId,
    structuredQuestionId,
  };

  if (!isRedisConfigured()) {
    const solution = await runSolutionJob(structuredQuestionId);
    await verifySolution(solution.id);
    await extractMetadata(structuredQuestionId);
    await runDifficultyJob(structuredQuestionId);
    computeQuestionQualityScore(structuredQuestionId);
    routeQuestionToReviewQueue(structuredQuestionId);
    enqueueEmbeddingGeneration(structuredQuestionId);
    return;
  }

    await getAiSolutionQueue().add("solve", {
    ...payload,
    structuredQuestionId,
  });
}

export async function processExtractionJob(
  extractionJobId: string,
  meta: PipelineStartInput,
): Promise<void> {
  await runExtractionJob(extractionJobId);

  if (!isRedisConfigured()) {
    const questions = await runSegmentationJob(extractionJobId);
    for (const q of questions) {
      await enqueueDownstreamForQuestion(q.id, meta);
    }
    return;
  }

  await getSegmentationQueue().add("segment", {
    sourceId: meta.sourceId,
    instituteId: meta.instituteId,
    examProfileId: meta.examProfileId,
    extractionJobId,
  });
}

export async function processSegmentationJob(
  extractionJobId: string,
  meta: PipelineStartInput,
): Promise<void> {
  const questions = await runSegmentationJob(extractionJobId);
  for (const q of questions) {
    await enqueueDownstreamForQuestion(q.id, meta);
  }
}

export async function processAiSolutionJob(
  structuredQuestionId: string,
): Promise<string> {
  const solution = await runSolutionJob(structuredQuestionId);
  if (isRedisConfigured()) {
    await getVerificationQueue().add("verify", {
      sourceId: "",
      instituteId: "",
      examProfileId: "",
      solutionId: solution.id,
      structuredQuestionId,
    });
  } else {
    await verifySolution(solution.id);
    await extractMetadata(structuredQuestionId);
    await runDifficultyJob(structuredQuestionId);
    computeQuestionQualityScore(structuredQuestionId);
    routeQuestionToReviewQueue(structuredQuestionId);
    enqueueEmbeddingGeneration(structuredQuestionId);
  }
  return solution.id;
}

export async function processVerificationJob(solutionId: string): Promise<void> {
  const verification = await verifySolution(solutionId);
  const structuredQuestionId = verification.structuredQuestionId;

  if (isRedisConfigured()) {
    await getMetadataQueue().add("metadata", {
      sourceId: "",
      instituteId: "",
      examProfileId: "",
      structuredQuestionId,
    });
  } else {
    await extractMetadata(structuredQuestionId);
    await runDifficultyJob(structuredQuestionId);
    computeQuestionQualityScore(structuredQuestionId);
    routeQuestionToReviewQueue(structuredQuestionId);
    enqueueEmbeddingGeneration(structuredQuestionId);
  }
}

export async function processMetadataJob(
  structuredQuestionId: string,
): Promise<void> {
  await extractMetadata(structuredQuestionId);
  if (isRedisConfigured()) {
    await getDifficultyQueue().add("difficulty", {
      sourceId: "",
      instituteId: "",
      examProfileId: "",
      structuredQuestionId,
    });
  } else {
    await runDifficultyJob(structuredQuestionId);
    computeQuestionQualityScore(structuredQuestionId);
    routeQuestionToReviewQueue(structuredQuestionId);
    enqueueEmbeddingGeneration(structuredQuestionId);
  }
}
