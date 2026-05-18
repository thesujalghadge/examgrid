import { NextResponse } from "next/server";
import { getIntelligenceEnv } from "@/intelligence/config/env";
import { listQuestionsForReview } from "@/intelligence/services/review/review-service";
import { recomputeAllQualityScores } from "@/intelligence/services/quality/quality-service";
import { rebuildReviewQueue } from "@/intelligence/services/review/review-queue-service";
import type { ReviewStatus } from "@/intelligence/types/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const instituteId =
    url.searchParams.get("instituteId") ?? getIntelligenceEnv().instituteId;
  const reviewStatus = url.searchParams.get(
    "reviewStatus",
  ) as ReviewStatus | null;
  const lowConfidenceOnly =
    url.searchParams.get("lowConfidenceOnly") === "true";
  recomputeAllQualityScores(instituteId);
  rebuildReviewQueue(instituteId);

  let rows = listQuestionsForReview({
    instituteId,
    reviewStatus: reviewStatus ?? undefined,
    lowConfidenceOnly,
  });
  const exam = url.searchParams.get("exam");
  const subject = url.searchParams.get("subject");
  const difficulty = url.searchParams.get("difficulty");
  const extractionIssues = url.searchParams.get("extractionIssues") === "true";
  if (exam) rows = rows.filter((row) => row.examProfileId === exam);
  if (subject) {
    rows = rows.filter(
      (row) => row.segment.subject === subject || row.metadata?.subject === subject,
    );
  }
  if (difficulty) {
    rows = rows.filter((row) => row.metadata?.difficulty === difficulty);
  }
  if (extractionIssues) {
    rows = rows.filter((row) => (row.segment.extractionIssues?.length ?? 0) > 0);
  }

  return NextResponse.json({ count: rows.length, questions: rows });
}
