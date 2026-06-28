import { NextResponse } from "next/server";
import { listCbtSubmissions } from "@/lib/server/cbt-submissions-store";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";
import { assertInstituteUuid } from "@/config/institute";

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
  
  try {
    assertInstituteUuid(ws.instituteId, "ws.instituteId");
  } catch (e) {
    return NextResponse.json({ error: "INVALID_INSTITUTE_ID" }, { status: 400 });
  }

  let { testId } = await context.params;

  try {


    const submissions = await listCbtSubmissions(ws.instituteId, testId);
    return NextResponse.json({ submissions });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load submissions",
      },
      { status: 503 },
    );
  }
}
