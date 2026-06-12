import { NextResponse } from "next/server";
import {
  listCbtSubmissions,
  submissionToTestSession,
} from "@/lib/server/cbt-submissions-store";
import { computeTestAnalytics } from "@/services/test-analytics";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ testId: string }> },
) {
  const ws = await readVerifiedWorkspaceSession();
  if (!ws || ws.role !== "institute") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ws.instituteId) {
    return NextResponse.json({ error: "Missing institute" }, { status: 403 });
  }

  const { testId } = await context.params;
  const submissions = await listCbtSubmissions(ws.instituteId, testId);
  const sessions = submissions.map(submissionToTestSession);

  const analytics = computeTestAnalytics(testId, sessions);
  return NextResponse.json(analytics);
}
