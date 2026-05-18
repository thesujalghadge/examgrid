import { NextResponse } from "next/server";
import {
  publishApprovedQuestion,
  updateQuestionReview,
} from "@/intelligence/services/review/review-service";
import { reviewStatusSchema } from "@/intelligence/types/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    reviewStatus?: string;
    reviewNotes?: string;
    segment?: unknown;
    publishToBank?: boolean;
  };

  if (!body.reviewStatus) {
    return NextResponse.json(
      { error: "reviewStatus is required" },
      { status: 400 },
    );
  }

  const reviewStatus = reviewStatusSchema.parse(body.reviewStatus);
  const updated = updateQuestionReview(id, {
    reviewStatus,
    reviewNotes: body.reviewNotes,
    segment: body.segment as never,
  });

  if (!updated) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  let bankQuestion = null;
  if (body.publishToBank && reviewStatus === "approved") {
    bankQuestion = publishApprovedQuestion(id);
  }

  return NextResponse.json({ question: updated, bankQuestion });
}
