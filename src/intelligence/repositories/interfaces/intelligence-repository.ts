import type {
  DifficultySignal,
  PipelineJobStatus,
  QuestionMetadata,
  QualityScore,
  ReviewPriority,
  ReviewStatus,
  SegmentedQuestion,
  StructuredSolution,
  VerificationResult,
} from "@/intelligence/types/pipeline";

export interface PyqSourceRecord {
  id: string;
  instituteId: string;
  examProfileId: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  fileSizeBytes: number;
  examYear?: number;
  subjectHint?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionJobRecord {
  id: string;
  sourceId: string;
  instituteId: string;
  examProfileId: string;
  status: PipelineJobStatus;
  errorMessage?: string;
  rawText?: string;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StructuredQuestionRecord {
  id: string;
  extractionJobId: string;
  sourceId: string;
  instituteId: string;
  examProfileId: string;
  segment: SegmentedQuestion;
  reviewStatus: ReviewStatus;
  reviewNotes?: string;
  bankQuestionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiSolutionRecord {
  id: string;
  structuredQuestionId: string;
  providerId: string;
  model: string;
  structured: StructuredSolution;
  rawResponse: string;
  confidence: number;
  reviewStatus: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationRecord {
  id: string;
  solutionId: string;
  structuredQuestionId: string;
  primaryProviderId: string;
  verifierProviderId: string;
  result: VerificationResult;
  rawVerifierResponse: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetadataRecord {
  id: string;
  structuredQuestionId: string;
  metadata: QuestionMetadata;
  providerId: string;
  rawResponse: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface DifficultyRecord {
  id: string;
  structuredQuestionId: string;
  signal: DifficultySignal;
  createdAt: string;
  updatedAt: string;
}

export interface QualityScoreRecord {
  id: string;
  structuredQuestionId: string;
  score: QualityScore;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewQueueItemRecord {
  id: string;
  structuredQuestionId: string;
  instituteId: string;
  priority: ReviewPriority;
  reasons: string[];
  status: "open" | "resolved";
  createdAt: string;
  updatedAt: string;
}

export interface EmbeddingRecord {
  id: string;
  structuredQuestionId: string;
  targetType: "question" | "solution" | "concept";
  providerId: string;
  model: string;
  vector: number[];
  dimensions: number;
  textHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntelligenceRepository {
  saveSource(record: PyqSourceRecord): void;
  getSource(id: string): PyqSourceRecord | undefined;
  listSources(instituteId: string): PyqSourceRecord[];

  saveExtractionJob(record: ExtractionJobRecord): void;
  getExtractionJob(id: string): ExtractionJobRecord | undefined;
  updateExtractionJob(
    id: string,
    patch: Partial<ExtractionJobRecord>,
  ): ExtractionJobRecord | undefined;

  saveStructuredQuestion(record: StructuredQuestionRecord): void;
  getStructuredQuestion(id: string): StructuredQuestionRecord | undefined;
  listStructuredQuestions(filters: {
    instituteId?: string;
    reviewStatus?: ReviewStatus;
    extractionJobId?: string;
  }): StructuredQuestionRecord[];
  updateStructuredQuestion(
    id: string,
    patch: Partial<StructuredQuestionRecord>,
  ): StructuredQuestionRecord | undefined;

  saveSolution(record: AiSolutionRecord): void;
  getSolution(id: string): AiSolutionRecord | undefined;
  listSolutions(filters: {
    structuredQuestionId?: string;
    reviewStatus?: ReviewStatus;
  }): AiSolutionRecord[];
  updateSolution(
    id: string,
    patch: Partial<AiSolutionRecord>,
  ): AiSolutionRecord | undefined;

  saveVerification(record: VerificationRecord): void;
  getVerificationBySolution(solutionId: string): VerificationRecord | undefined;

  saveMetadata(record: MetadataRecord): void;
  getMetadataByQuestion(
    structuredQuestionId: string,
  ): MetadataRecord | undefined;

  saveDifficulty(record: DifficultyRecord): void;
  getDifficultyByQuestion(
    structuredQuestionId: string,
  ): DifficultyRecord | undefined;

  saveQualityScore(record: QualityScoreRecord): void;
  getQualityScoreByQuestion(
    structuredQuestionId: string,
  ): QualityScoreRecord | undefined;

  saveReviewQueueItem(record: ReviewQueueItemRecord): void;
  listReviewQueueItems(filters: {
    instituteId?: string;
    status?: "open" | "resolved";
    priority?: ReviewPriority;
  }): ReviewQueueItemRecord[];
  updateReviewQueueItem(
    id: string,
    patch: Partial<ReviewQueueItemRecord>,
  ): ReviewQueueItemRecord | undefined;

  saveEmbedding(record: EmbeddingRecord): void;
  listEmbeddings(filters: {
    structuredQuestionId?: string;
    targetType?: EmbeddingRecord["targetType"];
  }): EmbeddingRecord[];
}
