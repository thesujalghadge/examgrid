import { getIntelligenceRepository } from "@/intelligence/repositories/provider";
import type { ReviewStatus } from "@/intelligence/types/pipeline";

export interface IntelligenceMetrics {
  totalSources: number;
  totalExtractionJobs: number;
  totalQuestions: number;
  ingestionSuccessRate: number;
  extractionFailures: number;
  segmentationAccuracy: number;
  aiDisagreementFrequency: number;
  manualCorrectionFrequency: number;
  lowConfidencePercentage: number;
  publishApprovalRate: number;
  byReviewStatus: Record<ReviewStatus, number>;
  trend: Array<{
    label: string;
    ingested: number;
    lowConfidence: number;
    approved: number;
  }>;
}

export function getIntelligenceMetrics(instituteId: string): IntelligenceMetrics {
  const repo = getIntelligenceRepository();
  const sources = repo.listSources(instituteId);
  const questions = repo.listStructuredQuestions({ instituteId });
  const extractionJobs = sources
    .map((source) => repo.getExtractionJob(`ext-${source.id}`))
    .filter(Boolean);
  const actualJobs = questions
    .map((question) => repo.getExtractionJob(question.extractionJobId))
    .filter(Boolean);
  const allJobs = [...new Set([...extractionJobs, ...actualJobs])];
  const failedJobs = allJobs.filter((job) => job?.status === "failed").length;
  const lowConfidence = questions.filter((question) => {
    const quality = repo.getQualityScoreByQuestion(question.id);
    return (quality?.score.overallQualityScore ?? question.segment.confidence * 100) < 72;
  }).length;
  const malformed = questions.filter((question) => question.segment.malformed).length;
  const disputed = questions.filter((question) => {
    const solution = repo.listSolutions({ structuredQuestionId: question.id })[0];
    const verification = solution ? repo.getVerificationBySolution(solution.id) : undefined;
    return verification?.result.status === "disputed";
  }).length;
  const corrected = questions.filter((question) => question.reviewStatus === "needs_edit").length;
  const approved = questions.filter((question) => question.reviewStatus === "approved").length;

  const byReviewStatus: Record<ReviewStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    needs_edit: 0,
    reprocess: 0,
  };
  questions.forEach((question) => {
    byReviewStatus[question.reviewStatus]++;
  });

  return {
    totalSources: sources.length,
    totalExtractionJobs: allJobs.length,
    totalQuestions: questions.length,
    ingestionSuccessRate:
      allJobs.length === 0 ? 0 : Math.round(((allJobs.length - failedJobs) / allJobs.length) * 100),
    extractionFailures: failedJobs,
    segmentationAccuracy:
      questions.length === 0 ? 0 : Math.round(((questions.length - malformed) / questions.length) * 100),
    aiDisagreementFrequency:
      questions.length === 0 ? 0 : Math.round((disputed / questions.length) * 100),
    manualCorrectionFrequency:
      questions.length === 0 ? 0 : Math.round((corrected / questions.length) * 100),
    lowConfidencePercentage:
      questions.length === 0 ? 0 : Math.round((lowConfidence / questions.length) * 100),
    publishApprovalRate:
      questions.length === 0 ? 0 : Math.round((approved / questions.length) * 100),
    byReviewStatus,
    trend: [
      {
        label: "Current",
        ingested: questions.length,
        lowConfidence,
        approved,
      },
    ],
  };
}

