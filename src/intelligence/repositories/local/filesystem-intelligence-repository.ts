import fs from "node:fs";
import path from "node:path";
import { getIntelligenceEnv } from "@/intelligence/config/env";
import type {
  AiSolutionRecord,
  DifficultyRecord,
  EmbeddingRecord,
  ExtractionJobRecord,
  IntelligenceRepository,
  MetadataRecord,
  QualityScoreRecord,
  PyqSourceRecord,
  ReviewQueueItemRecord,
  StructuredQuestionRecord,
  VerificationRecord,
} from "@/intelligence/repositories/interfaces/intelligence-repository";
import type { ReviewStatus } from "@/intelligence/types/pipeline";

interface StoreSnapshot {
  sources: PyqSourceRecord[];
  extractionJobs: ExtractionJobRecord[];
  structuredQuestions: StructuredQuestionRecord[];
  solutions: AiSolutionRecord[];
  verifications: VerificationRecord[];
  metadata: MetadataRecord[];
  difficulty: DifficultyRecord[];
  qualityScores: QualityScoreRecord[];
  reviewQueue: ReviewQueueItemRecord[];
  embeddings: EmbeddingRecord[];
}

const EMPTY: StoreSnapshot = {
  sources: [],
  extractionJobs: [],
  structuredQuestions: [],
  solutions: [],
  verifications: [],
  metadata: [],
  difficulty: [],
  qualityScores: [],
  reviewQueue: [],
  embeddings: [],
};

function storePath(): string {
  return path.join(getIntelligenceEnv().storagePath, "pipeline-store.json");
}

function readStore(): StoreSnapshot {
  const file = storePath();
  if (!fs.existsSync(file)) return { ...EMPTY };
  try {
    return { ...EMPTY, ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return { ...EMPTY };
  }
}

function writeStore(store: StoreSnapshot): void {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store, null, 2), "utf8");
}

let memory: StoreSnapshot | null = null;

function store(): StoreSnapshot {
  if (!memory) memory = readStore();
  return memory;
}

function persist(): void {
  writeStore(store());
}

export class FilesystemIntelligenceRepository implements IntelligenceRepository {
  saveSource(record: PyqSourceRecord): void {
    const s = store();
    const idx = s.sources.findIndex((x) => x.id === record.id);
    if (idx >= 0) s.sources[idx] = record;
    else s.sources.push(record);
    persist();
  }

  getSource(id: string): PyqSourceRecord | undefined {
    return store().sources.find((x) => x.id === id);
  }

  listSources(instituteId: string): PyqSourceRecord[] {
    return store().sources.filter((x) => x.instituteId === instituteId);
  }

  saveExtractionJob(record: ExtractionJobRecord): void {
    const s = store();
    const idx = s.extractionJobs.findIndex((x) => x.id === record.id);
    if (idx >= 0) s.extractionJobs[idx] = record;
    else s.extractionJobs.push(record);
    persist();
  }

  getExtractionJob(id: string): ExtractionJobRecord | undefined {
    return store().extractionJobs.find((x) => x.id === id);
  }

  updateExtractionJob(
    id: string,
    patch: Partial<ExtractionJobRecord>,
  ): ExtractionJobRecord | undefined {
    const job = this.getExtractionJob(id);
    if (!job) return undefined;
    const updated = { ...job, ...patch, updatedAt: new Date().toISOString() };
    this.saveExtractionJob(updated);
    return updated;
  }

  saveStructuredQuestion(record: StructuredQuestionRecord): void {
    const s = store();
    const idx = s.structuredQuestions.findIndex((x) => x.id === record.id);
    if (idx >= 0) s.structuredQuestions[idx] = record;
    else s.structuredQuestions.push(record);
    persist();
  }

  getStructuredQuestion(id: string): StructuredQuestionRecord | undefined {
    return store().structuredQuestions.find((x) => x.id === id);
  }

  listStructuredQuestions(filters: {
    instituteId?: string;
    reviewStatus?: ReviewStatus;
    extractionJobId?: string;
  }): StructuredQuestionRecord[] {
    return store().structuredQuestions.filter((q) => {
      if (filters.instituteId && q.instituteId !== filters.instituteId)
        return false;
      if (filters.reviewStatus && q.reviewStatus !== filters.reviewStatus)
        return false;
      if (
        filters.extractionJobId &&
        q.extractionJobId !== filters.extractionJobId
      )
        return false;
      return true;
    });
  }

  updateStructuredQuestion(
    id: string,
    patch: Partial<StructuredQuestionRecord>,
  ): StructuredQuestionRecord | undefined {
    const row = this.getStructuredQuestion(id);
    if (!row) return undefined;
    const updated = { ...row, ...patch, updatedAt: new Date().toISOString() };
    this.saveStructuredQuestion(updated);
    return updated;
  }

  saveSolution(record: AiSolutionRecord): void {
    const s = store();
    const idx = s.solutions.findIndex((x) => x.id === record.id);
    if (idx >= 0) s.solutions[idx] = record;
    else s.solutions.push(record);
    persist();
  }

  getSolution(id: string): AiSolutionRecord | undefined {
    return store().solutions.find((x) => x.id === id);
  }

  listSolutions(filters: {
    structuredQuestionId?: string;
    reviewStatus?: ReviewStatus;
  }): AiSolutionRecord[] {
    return store().solutions.filter((sol) => {
      if (
        filters.structuredQuestionId &&
        sol.structuredQuestionId !== filters.structuredQuestionId
      )
        return false;
      if (filters.reviewStatus && sol.reviewStatus !== filters.reviewStatus)
        return false;
      return true;
    });
  }

  updateSolution(
    id: string,
    patch: Partial<AiSolutionRecord>,
  ): AiSolutionRecord | undefined {
    const row = this.getSolution(id);
    if (!row) return undefined;
    const updated = { ...row, ...patch, updatedAt: new Date().toISOString() };
    this.saveSolution(updated);
    return updated;
  }

  saveVerification(record: VerificationRecord): void {
    const s = store();
    const idx = s.verifications.findIndex((x) => x.id === record.id);
    if (idx >= 0) s.verifications[idx] = record;
    else s.verifications.push(record);
    persist();
  }

  getVerificationBySolution(solutionId: string): VerificationRecord | undefined {
    return store().verifications.find((x) => x.solutionId === solutionId);
  }

  saveMetadata(record: MetadataRecord): void {
    const s = store();
    const idx = s.metadata.findIndex((x) => x.id === record.id);
    if (idx >= 0) s.metadata[idx] = record;
    else s.metadata.push(record);
    persist();
  }

  getMetadataByQuestion(
    structuredQuestionId: string,
  ): MetadataRecord | undefined {
    return store().metadata.find(
      (x) => x.structuredQuestionId === structuredQuestionId,
    );
  }

  saveDifficulty(record: DifficultyRecord): void {
    const s = store();
    const idx = s.difficulty.findIndex((x) => x.id === record.id);
    if (idx >= 0) s.difficulty[idx] = record;
    else s.difficulty.push(record);
    persist();
  }

  getDifficultyByQuestion(
    structuredQuestionId: string,
  ): DifficultyRecord | undefined {
    return store().difficulty.find(
      (x) => x.structuredQuestionId === structuredQuestionId,
    );
  }

  saveQualityScore(record: QualityScoreRecord): void {
    const s = store();
    const idx = s.qualityScores.findIndex((x) => x.id === record.id);
    if (idx >= 0) s.qualityScores[idx] = record;
    else s.qualityScores.push(record);
    persist();
  }

  getQualityScoreByQuestion(
    structuredQuestionId: string,
  ): QualityScoreRecord | undefined {
    return store().qualityScores.find(
      (x) => x.structuredQuestionId === structuredQuestionId,
    );
  }

  saveReviewQueueItem(record: ReviewQueueItemRecord): void {
    const s = store();
    const idx = s.reviewQueue.findIndex((x) => x.id === record.id);
    if (idx >= 0) s.reviewQueue[idx] = record;
    else s.reviewQueue.push(record);
    persist();
  }

  listReviewQueueItems(filters: {
    instituteId?: string;
    status?: ReviewQueueItemRecord["status"];
    priority?: ReviewQueueItemRecord["priority"];
  }): ReviewQueueItemRecord[] {
    return store().reviewQueue.filter((item) => {
      if (filters.instituteId && item.instituteId !== filters.instituteId) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.priority && item.priority !== filters.priority) return false;
      return true;
    });
  }

  updateReviewQueueItem(
    id: string,
    patch: Partial<ReviewQueueItemRecord>,
  ): ReviewQueueItemRecord | undefined {
    const row = store().reviewQueue.find((x) => x.id === id);
    if (!row) return undefined;
    const updated = { ...row, ...patch, updatedAt: new Date().toISOString() };
    this.saveReviewQueueItem(updated);
    return updated;
  }

  saveEmbedding(record: EmbeddingRecord): void {
    const s = store();
    const idx = s.embeddings.findIndex((x) => x.id === record.id);
    if (idx >= 0) s.embeddings[idx] = record;
    else s.embeddings.push(record);
    persist();
  }

  listEmbeddings(filters: {
    structuredQuestionId?: string;
    targetType?: EmbeddingRecord["targetType"];
  }): EmbeddingRecord[] {
    return store().embeddings.filter((embedding) => {
      if (
        filters.structuredQuestionId &&
        embedding.structuredQuestionId !== filters.structuredQuestionId
      ) {
        return false;
      }
      if (filters.targetType && embedding.targetType !== filters.targetType) {
        return false;
      }
      return true;
    });
  }
}
