import { Worker } from "bullmq";
import { INTELLIGENCE_QUEUE_NAMES } from "@/intelligence/config/queue-names";
import { getRedisConnection } from "@/intelligence/queues/connection";
import type {
  AiSolutionJobData,
  DifficultyJobData,
  ExtractionJobData,
  MetadataJobData,
  SegmentationJobData,
  VerificationJobData,
} from "@/intelligence/queues/job-types";
import {
  processAiSolutionJob,
  processExtractionJob,
  processMetadataJob,
  processSegmentationJob,
  processVerificationJob,
} from "@/intelligence/pipeline/orchestrator";
import { runDifficultyJob } from "@/intelligence/services/difficulty-engine/difficulty-service";

const connection = getRedisConnection();

export function startIntelligenceWorkers(): Worker[] {
  const extractionWorker = new Worker<ExtractionJobData>(
    INTELLIGENCE_QUEUE_NAMES.EXTRACTION,
    async (job) => {
      const { extractionJobId, sourceId, instituteId, examProfileId } = job.data;
      if (!extractionJobId) throw new Error("Missing extractionJobId");
      await processExtractionJob(extractionJobId, {
        sourceId,
        extractionJobId,
        instituteId,
        examProfileId,
      });
    },
    { connection, concurrency: 2 },
  );

  const segmentationWorker = new Worker<SegmentationJobData>(
    INTELLIGENCE_QUEUE_NAMES.SEGMENTATION,
    async (job) => {
      const { extractionJobId, sourceId, instituteId, examProfileId } = job.data;
      if (!extractionJobId) throw new Error("Missing extractionJobId");
      await processSegmentationJob(extractionJobId, {
        sourceId,
        extractionJobId,
        instituteId,
        examProfileId,
      });
    },
    { connection, concurrency: 2 },
  );

  const solutionWorker = new Worker<AiSolutionJobData>(
    INTELLIGENCE_QUEUE_NAMES.AI_SOLUTION,
    async (job) => {
      const { structuredQuestionId } = job.data;
      if (!structuredQuestionId) throw new Error("Missing structuredQuestionId");
      await processAiSolutionJob(structuredQuestionId);
    },
    { connection, concurrency: 3 },
  );

  const verificationWorker = new Worker<VerificationJobData>(
    INTELLIGENCE_QUEUE_NAMES.VERIFICATION,
    async (job) => {
      const { solutionId } = job.data;
      if (!solutionId) throw new Error("Missing solutionId");
      await processVerificationJob(solutionId);
    },
    { connection, concurrency: 3 },
  );

  const metadataWorker = new Worker<MetadataJobData>(
    INTELLIGENCE_QUEUE_NAMES.METADATA,
    async (job) => {
      const { structuredQuestionId } = job.data;
      if (!structuredQuestionId) throw new Error("Missing structuredQuestionId");
      await processMetadataJob(structuredQuestionId);
    },
    { connection, concurrency: 3 },
  );

  const difficultyWorker = new Worker<DifficultyJobData>(
    INTELLIGENCE_QUEUE_NAMES.DIFFICULTY,
    async (job) => {
      const { structuredQuestionId } = job.data;
      if (!structuredQuestionId) throw new Error("Missing structuredQuestionId");
      await runDifficultyJob(structuredQuestionId);
    },
    { connection, concurrency: 3 },
  );

  return [
    extractionWorker,
    segmentationWorker,
    solutionWorker,
    verificationWorker,
    metadataWorker,
    difficultyWorker,
  ];
}
