import { intelligenceId, nowIso } from "@/intelligence/lib/ids";
import { getIntelligenceRepository } from "@/intelligence/repositories/provider";
import type { ReviewQueueItemRecord } from "@/intelligence/repositories/interfaces/intelligence-repository";
import type { ReviewPriority } from "@/intelligence/types/pipeline";
import { computeQuestionQualityScore } from "@/intelligence/services/quality/quality-service";

function priorityFromReasons(reasons: string[], score: number): ReviewPriority {
  if (reasons.includes("answer-mismatch") || reasons.includes("fallback-parser-used")) {
    return "urgent";
  }
  if (score < 55 || reasons.includes("ai-disagreement")) return "high";
  if (score < 72 || reasons.length > 0) return "normal";
  return "low";
}

export function routeQuestionToReviewQueue(
  structuredQuestionId: string,
): ReviewQueueItemRecord | null {
  const repo = getIntelligenceRepository();
  const question = repo.getStructuredQuestion(structuredQuestionId);
  if (!question) return null;
  const quality = computeQuestionQualityScore(structuredQuestionId);
  if (!quality?.score.requiresReview) return null;

  const existing = repo
    .listReviewQueueItems({ instituteId: question.instituteId, status: "open" })
    .find((item) => item.structuredQuestionId === structuredQuestionId);
  const now = nowIso();
  const record: ReviewQueueItemRecord = {
    id: existing?.id ?? intelligenceId("revq"),
    structuredQuestionId,
    instituteId: question.instituteId,
    priority: priorityFromReasons(
      quality.score.issues,
      quality.score.overallQualityScore,
    ),
    reasons: quality.score.issues,
    status: "open",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  repo.saveReviewQueueItem(record);
  return record;
}

export function rebuildReviewQueue(instituteId: string): ReviewQueueItemRecord[] {
  const repo = getIntelligenceRepository();
  return repo
    .listStructuredQuestions({ instituteId })
    .flatMap((question) => {
      const item = routeQuestionToReviewQueue(question.id);
      return item ? [item] : [];
    });
}

