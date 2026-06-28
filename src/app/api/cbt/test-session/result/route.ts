import { NextResponse } from "next/server";
import { getCbtSubmission } from "@/lib/server/cbt-submissions-store";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const ws = await readVerifiedWorkspaceSession();
  if (!ws || ws.role !== "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let testId = searchParams.get("testId");
  if (!testId) {
    return NextResponse.json({ error: "Missing testId" }, { status: 400 });
  }



  const submission = await getCbtSubmission(
    ws.instituteId || "",
    testId,
    ws.userId || "",
  );

  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(submission);
}
