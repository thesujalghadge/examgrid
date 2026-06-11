import { NextResponse } from "next/server";
import { z } from "zod";
import { logParsingWarning, logSessionWarning } from "@/lib/logging/runtime-logger";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";
import { enqueueQuestionsForGeneration } from "@/lib/solutions/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const enqueueRequestSchema = z.object({
  questionIds: z.array(z.string().uuid()),
  priority: z.number().int().min(1).max(100).default(50),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ instituteId: string }> },
) {
  const { instituteId } = await context.params;
  const session = await readVerifiedWorkspaceSession();
  
  if (
    !session ||
    (session.role !== "platform_admin" &&
      (session.role !== "institute" || session.instituteId !== instituteId))
  ) {
    logSessionWarning("solution generation enqueue denied", {
      reason: "unauthorized",
      userId: session?.userId,
      instituteId,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = enqueueRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid enqueue request", details: parsed.error.issues }, { status: 400 });
  }

  const { questionIds, priority } = parsed.data;

  try {
    const result = await enqueueQuestionsForGeneration(questionIds, instituteId, priority);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enqueue solutions";
    logParsingWarning("solution generation enqueue failed", { instituteId, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
