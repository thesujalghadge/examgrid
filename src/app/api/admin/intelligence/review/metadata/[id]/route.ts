import { NextResponse } from "next/server";
import { updateQuestionMetadataReview } from "@/intelligence/services/review/review-service";
import { questionMetadataSchema } from "@/intelligence/types/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const metadata = questionMetadataSchema.parse(await request.json());
  const updated = updateQuestionMetadataReview(id, metadata);
  if (!updated) {
    return NextResponse.json({ error: "Metadata not found" }, { status: 404 });
  }
  return NextResponse.json({ metadata: updated });
}

