import { requireExamProfile } from "@/intelligence/config/exam-profiles";
import { getIntelligenceEnv } from "@/intelligence/config/env";
import { intelligenceId, nowIso } from "@/intelligence/lib/ids";
import { getIntelligenceRepository } from "@/intelligence/repositories/provider";
import type { PyqSourceRecord } from "@/intelligence/repositories/interfaces/intelligence-repository";
import {
  chunkExtractedText,
  extractTextFromSource,
} from "@/intelligence/services/pyq-ingestion/text-extractor";
import { persistSourceFile } from "@/intelligence/services/pyq-ingestion/file-storage";
import { enqueuePipelineAfterUpload } from "@/intelligence/pipeline/orchestrator";

export interface UploadPyqInput {
  instituteId?: string;
  examProfileId: string;
  examYear?: number;
  subjectHint?: string;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
}

export interface UploadPyqResult {
  source: PyqSourceRecord;
  extractionJobId: string;
  queued: boolean;
}

export async function uploadPyqSource(
  input: UploadPyqInput,
): Promise<UploadPyqResult> {
  requireExamProfile(input.examProfileId);
  const repo = getIntelligenceRepository();
  const instituteId = input.instituteId ?? getIntelligenceEnv().instituteId;
  const sourceId = intelligenceId("src");
  const now = nowIso();

  const storagePath = await persistSourceFile(
    sourceId,
    input.fileName,
    input.fileBuffer,
  );

  const source: PyqSourceRecord = {
    id: sourceId,
    instituteId,
    examProfileId: input.examProfileId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    storagePath,
    fileSizeBytes: input.fileBuffer.length,
    examYear: input.examYear,
    subjectHint: input.subjectHint,
    createdAt: now,
    updatedAt: now,
  };

  repo.saveSource(source);

  const extractionJobId = intelligenceId("ext");
  repo.saveExtractionJob({
    id: extractionJobId,
    sourceId,
    instituteId,
    examProfileId: input.examProfileId,
    status: "queued",
    chunkCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  const queued = await enqueuePipelineAfterUpload({
    sourceId,
    extractionJobId,
    instituteId,
    examProfileId: input.examProfileId,
  });

  return { source, extractionJobId, queued };
}

export async function runExtractionJob(extractionJobId: string): Promise<void> {
  const repo = getIntelligenceRepository();
  const job = repo.getExtractionJob(extractionJobId);
  if (!job) throw new Error(`Extraction job not found: ${extractionJobId}`);

  const source = repo.getSource(job.sourceId);
  if (!source) throw new Error(`Source not found: ${job.sourceId}`);

  repo.updateExtractionJob(extractionJobId, {
    status: "processing",
  });

  try {
    const rawText = await extractTextFromSource(
      source.storagePath,
      source.mimeType,
    );
    const chunks = chunkExtractedText(rawText);
    repo.updateExtractionJob(extractionJobId, {
      status: "completed",
      rawText,
      chunkCount: chunks.length,
      errorMessage: undefined,
    });
  } catch (error) {
    repo.updateExtractionJob(extractionJobId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
