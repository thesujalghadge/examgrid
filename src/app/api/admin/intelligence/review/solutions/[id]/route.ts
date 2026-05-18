import { NextResponse } from "next/server";
import { updateSolutionReview } from "@/intelligence/services/review/review-service";
import { reviewStatusSchema, structuredSolutionSchema } from "@/intelligence/types/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    reviewStatus?: string;
    structured?: unknown;
  };

  if (!body.reviewStatus) {
    return NextResponse.json(
      { error: "reviewStatus is required" },
      { status: 400 },
    );
  }

  const updated = updateSolutionReview(id, {
    reviewStatus: reviewStatusSchema.parse(body.reviewStatus),
    structured: body.structured
      ? structuredSolutionSchema.parse(body.structured)
      : undefined,
  });

  if (!updated) {
    return NextResponse.json({ error: "Solution not found" }, { status: 404 });
  }

  return NextResponse.json({ solution: updated });
}
