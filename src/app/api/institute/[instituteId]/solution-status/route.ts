import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";
import { assertInstituteUuid } from "@/config/institute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/institute/[instituteId]/solution-status?examId=<examId>
 *
 * Returns real-time solution generation progress for an exam.
 * Used by the institute dashboard to show:
 *   "62/75 completed (83%) — 2 failed — 11 pending"
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ instituteId: string }> },
) {
  const { instituteId } = await context.params;

  try {
    assertInstituteUuid(instituteId, "instituteId");
  } catch {
    return NextResponse.json({ error: "INVALID_INSTITUTE_ID" }, { status: 400 });
  }

  const session = await readVerifiedWorkspaceSession();
  if (
    !session ||
    (session.role !== "platform_admin" &&
      (session.role !== "institute" || session.instituteId !== instituteId))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get("examId");
  if (!examId) {
    return NextResponse.json({ error: "examId query param required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  // Refresh the status from queue (keeps it current even if no jobs ran recently)
  await supabase.rpc("refresh_exam_solution_status", {
    p_exam_id: examId,
    p_institute_id: instituteId,
  });

  // Fetch the freshly updated status
  const { data: status, error } = await supabase
    .from("exam_solution_status")
    .select("*")
    .eq("exam_id", examId)
    .eq("institute_id", instituteId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!status) {
    // No status row yet — exam may not have been published or queue not started
    const { count: totalQ } = await supabase
      .from("exam_questions")
      .select("*", { count: "exact", head: true })
      .in(
        "exam_id",
        (
          await supabase
            .from("exams")
            .select("id")
            .eq("id", examId)
        ).data?.map((e: any) => e.id) ?? [],
      );

    return NextResponse.json({
      exam_id: examId,
      total_questions: totalQ ?? 0,
      completed: 0,
      failed: 0,
      pending: totalQ ?? 0,
      processing: 0,
      progress_pct: 0,
      is_ready: false,
      solutions_visible_at: null,
      status_exists: false,
    });
  }

  return NextResponse.json({ ...status, status_exists: true });
}
