import { NextResponse } from "next/server";
import { getIntelligenceEnv } from "@/intelligence/config/env";
import { getIntelligenceMetrics } from "@/intelligence/services/metrics/metrics-service";
import { rebuildReviewQueue } from "@/intelligence/services/review/review-queue-service";
import { recomputeAllQualityScores } from "@/intelligence/services/quality/quality-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const instituteId =
    url.searchParams.get("instituteId") ?? getIntelligenceEnv().instituteId;
  recomputeAllQualityScores(instituteId);
  rebuildReviewQueue(instituteId);
  return NextResponse.json({ metrics: getIntelligenceMetrics(instituteId) });
}

