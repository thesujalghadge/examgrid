import { Queue } from "bullmq";
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

let extractionQueue: Queue<ExtractionJobData> | null = null;
let segmentationQueue: Queue<SegmentationJobData> | null = null;
let aiSolutionQueue: Queue<AiSolutionJobData> | null = null;
let verificationQueue: Queue<VerificationJobData> | null = null;
let metadataQueue: Queue<MetadataJobData> | null = null;
let difficultyQueue: Queue<DifficultyJobData> | null = null;

function connection() {
  return getRedisConnection();
}

export function getExtractionQueue(): Queue<ExtractionJobData> {
  if (!extractionQueue) {
    extractionQueue = new Queue(INTELLIGENCE_QUEUE_NAMES.EXTRACTION, {
      connection: connection(),
    });
  }
  return extractionQueue;
}

export function getSegmentationQueue(): Queue<SegmentationJobData> {
  if (!segmentationQueue) {
    segmentationQueue = new Queue(INTELLIGENCE_QUEUE_NAMES.SEGMENTATION, {
      connection: connection(),
    });
  }
  return segmentationQueue;
}

export function getAiSolutionQueue(): Queue<AiSolutionJobData> {
  if (!aiSolutionQueue) {
    aiSolutionQueue = new Queue(INTELLIGENCE_QUEUE_NAMES.AI_SOLUTION, {
      connection: connection(),
    });
  }
  return aiSolutionQueue;
}

export function getVerificationQueue(): Queue<VerificationJobData> {
  if (!verificationQueue) {
    verificationQueue = new Queue(INTELLIGENCE_QUEUE_NAMES.VERIFICATION, {
      connection: connection(),
    });
  }
  return verificationQueue;
}

export function getMetadataQueue(): Queue<MetadataJobData> {
  if (!metadataQueue) {
    metadataQueue = new Queue(INTELLIGENCE_QUEUE_NAMES.METADATA, {
      connection: connection(),
    });
  }
  return metadataQueue;
}

export function getDifficultyQueue(): Queue<DifficultyJobData> {
  if (!difficultyQueue) {
    difficultyQueue = new Queue(INTELLIGENCE_QUEUE_NAMES.DIFFICULTY, {
      connection: connection(),
    });
  }
  return difficultyQueue;
}
