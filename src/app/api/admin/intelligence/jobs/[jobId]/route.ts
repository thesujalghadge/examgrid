import { NextResponse } from "next/server";
import { getIntelligenceRepository } from "@/intelligence/repositories/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const repo = getIntelligenceRepository();
  const job = repo.getExtractionJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const questions = repo.listStructuredQuestions({ extractionJobId: jobId });

  return NextResponse.json({
    job,
    questionCount: questions.length,
    questions: questions.map((q) => ({
      id: q.id,
      reviewStatus: q.reviewStatus,
      format: q.segment.questionFormat,
      preview: q.segment.questionText.slice(0, 120),
    })),
  });
}
