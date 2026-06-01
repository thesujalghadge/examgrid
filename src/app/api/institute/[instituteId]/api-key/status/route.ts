import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";
import { logSessionWarning } from "@/lib/logging/runtime-logger";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ instituteId: string }> },
) {
  const { instituteId } = await context.params;
  const session = await readVerifiedWorkspaceSession();
  if (
    !session ||
    (session.role !== "platform_admin" &&
      (session.role !== "institute" || session.instituteId !== instituteId))
  ) {
    logSessionWarning("institute api key status denied", {
      reason: "unauthorized",
      userId: session?.userId,
      instituteId,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("institutes")
    .select("gemini_api_key_set_at")
    .eq("id", instituteId)
    .single();

  if (error) {
    return NextResponse.json({ hasKey: false, setAt: null });
  }

  return NextResponse.json({
    hasKey: Boolean(data?.gemini_api_key_set_at),
    setAt: data?.gemini_api_key_set_at ?? null,
  });
}
