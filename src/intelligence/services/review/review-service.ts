import { getIntelligenceRepository } from "@/intelligence/repositories/provider";
import type {
  AiSolutionRecord,
  QualityScoreRecord,
  ReviewQueueItemRecord,
  StructuredQuestionRecord,
  VerificationRecord,
} from "@/intelligence/repositories/interfaces/intelligence-repository";
import type { QuestionMetadata, ReviewStatus } from "@/intelligence/types/pipeline";
import { questionMetadataSchema } from "@/intelligence/types/pipeline";
import { withQuestionIntelligenceDefaults } from "@/lib/question-intelligence/defaults";
import { getRepositories } from "@/lib/repositories/provider";
import type { BankQuestion } from "@/types/question-bank";

export interface ReviewQuestionView extends StructuredQuestionRecord {
  solution?: AiSolutionRecord;
  verification?: VerificationRecord;
  verificationStatus?: string;
  metadata?: QuestionMetadata;
  metadataConfidence?: number;
  difficultyScore?: number;
  quality?: QualityScoreRecord;
  reviewQueueItem?: ReviewQueueItemRecord;
}

export function listQuestionsForReview(filters: {
  instituteId: string;
  reviewStatus?: ReviewStatus;
  lowConfidenceOnly?: boolean;
}): ReviewQuestionView[] {
  const repo = getIntelligenceRepository();
  const rows = repo.listStructuredQuestions({
    instituteId: filters.instituteId,
    reviewStatus: filters.reviewStatus,
  });

  return rows
    .map((row) => {
      const solution = repo.listSolutions({ structuredQuestionId: row.id })[0];
      const verification = solution
        ? repo.getVerificationBySolution(solution.id)
        : undefined;
      const metadata = repo.getMetadataByQuestion(row.id);
      const difficulty = repo.getDifficultyByQuestion(row.id);
      const quality = repo.getQualityScoreByQuestion(row.id);
      const reviewQueueItem = repo
        .listReviewQueueItems({ instituteId: row.instituteId, status: "open" })
        .find((item) => item.structuredQuestionId === row.id);

      return {
        ...row,
        solution,
        verification,
        verificationStatus: verification?.result.status,
        metadata: metadata?.metadata,
        metadataConfidence: metadata?.confidence,
        difficultyScore: difficulty?.signal.compositeScore,
        quality,
        reviewQueueItem,
      };
    })
    .filter((row) => {
      if (!filters.lowConfidenceOnly) return true;
      const lowSolution = (row.solution?.confidence ?? 1) < 0.6;
      const lowQuality = (row.quality?.score.overallQualityScore ?? 100) < 72;
      const lowVerify =
        row.verificationStatus === "low_confidence" ||
        row.verificationStatus === "disputed";
      return lowSolution || lowVerify || lowQuality;
    });
}

export function updateQuestionReview(
  id: string,
  patch: {
    reviewStatus: ReviewStatus;
    reviewNotes?: string;
    segment?: StructuredQuestionRecord["segment"];
  },
): StructuredQuestionRecord | undefined {
  const repo = getIntelligenceRepository();
  const updated = repo.updateStructuredQuestion(id, patch);
  if (updated && ["approved", "rejected"].includes(patch.reviewStatus)) {
    repo
      .listReviewQueueItems({ instituteId: updated.instituteId, status: "open" })
      .filter((item) => item.structuredQuestionId === id)
      .forEach((item) => repo.updateReviewQueueItem(item.id, { status: "resolved" }));
  }
  return updated;
}

export function updateSolutionReview(
  id: string,
  patch: {
    reviewStatus: ReviewStatus;
    structured?: AiSolutionRecord["structured"];
  },
): AiSolutionRecord | undefined {
  const repo = getIntelligenceRepository();
  return repo.updateSolution(id, patch);
}

export function updateQuestionMetadataReview(
  structuredQuestionId: string,
  metadata: QuestionMetadata,
): QuestionMetadata | null {
  const repo = getIntelligenceRepository();
  const existing = repo.getMetadataByQuestion(structuredQuestionId);
  if (!existing) return null;
  const parsed = questionMetadataSchema.parse(metadata);
  repo.saveMetadata({
    ...existing,
    metadata: parsed,
    confidence: Math.max(existing.confidence, parsed.taxonomyConfidence),
    updatedAt: new Date().toISOString(),
  });
  return parsed;
}

/** Promote approved structured question into the institute question bank. */
export function publishApprovedQuestion(
  structuredQuestionId: string,
): BankQuestion | null {
  const repo = getIntelligenceRepository();
  const row = repo.getStructuredQuestion(structuredQuestionId);
  if (!row || row.reviewStatus !== "approved") return null;

  const solution = repo.listSolutions({ structuredQuestionId })[0];
  const metadata = repo.getMetadataByQuestion(structuredQuestionId);
  const meta = metadata?.metadata;

  const bankId = `pyq-${structuredQuestionId}`;
  const now = Date.now();
  const question = withQuestionIntelligenceDefaults({
    id: bankId,
    createdAt: now,
    updatedAt: now,
    subject: meta?.subject ?? row.segment.subject ?? "General",
    examSource: row.examProfileId,
    examYear: row.segment.year,
    chapter: meta?.chapter ?? "",
    topic: meta?.topic ?? "",
    subtopic: meta?.subtopic ?? "",
    difficulty: meta?.difficulty ?? "medium",
    questionType:
      row.segment.questionFormat === "numerical" ? "NUMERICAL" : "MCQ_SINGLE",
    questionText: row.segment.questionText,
    options: row.segment.options.map((o) => ({
      label: o.label,
      text: o.text,
    })),
    correctAnswer: row.segment.correctAnswer ?? "",
    solution: solution?.structured.summary ?? "",
    solutionDetailed: solution?.structured.steps
      .map((s) => `${s.title}: ${s.body}`)
      .join("\n"),
    solutionShort: solution?.structured.summary ?? "",
    sourceType: "PYQ",
    formulaTags: meta?.formulaTags ?? [],
    conceptTags: meta?.conceptTags ?? [],
    marks: 4,
    negativeMarks: 1,
  });

  const repos = getRepositories();
  repos.questions.upsert(question);

  repo.updateStructuredQuestion(structuredQuestionId, {
    bankQuestionId: bankId,
  });

  return question;
}
