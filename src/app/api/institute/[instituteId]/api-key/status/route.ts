import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";
import { logSessionWarning } from "@/lib/logging/runtime-logger";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { assertInstituteUuid } from "@/config/institute";

export async function GET(
  _request: Request,
  context: { params: Promise<{ instituteId: string }> },
) {
  const { instituteId } = await context.params;
  try {
    assertInstituteUuid(instituteId, "instituteId");
  } catch (e) {
    return NextResponse.json({ error: "INVALID_INSTITUTE_ID" }, { status: 400 });
  }
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
  
  if (!supabase) {
    // Fallback to local mock storage
    const fs = await import("fs");
    const path = await import("path");
    const MOCK_KEYS_FILE = path.join(process.cwd(), ".mock-api-keys.json");
    try {
      if (fs.existsSync(MOCK_KEYS_FILE)) {
        const keys = JSON.parse(fs.readFileSync(MOCK_KEYS_FILE, "utf-8"));
        const instituteKey = keys[instituteId];
        if (instituteKey && instituteKey.gemini_api_key_encrypted) {
           return NextResponse.json({
             hasKey: true,
             setAt: new Date().toISOString(), // we don't store setAt in mock, so just return true
           });
        }
      }
    } catch {}
    return NextResponse.json({ hasKey: false, setAt: null });
  }

  let validationStatus = "NO_KEY";
  let hasKey = false;
  let setAt = null;

  try {
    const { getInstituteGeminiKey } = await import("@/lib/institute/get-institute-api-key");
    await getInstituteGeminiKey(instituteId);
    validationStatus = "VALID";
    hasKey = true;
  } catch(e: any) {
    if (e.name === "INVALID_SECRET") {
      validationStatus = "INVALID_SECRET";
      hasKey = true;
    } else {
      validationStatus = "NO_KEY";
      hasKey = false;
    }
  }

  const { data, error } = await supabase
    .from("institutes")
    .select("gemini_api_key_set_at")
    .eq("id", instituteId)
    .single();

  if (!error && data?.gemini_api_key_set_at) {
    setAt = data.gemini_api_key_set_at;
    // Edge case: if db says it has a key but decryption failed or was missing, hasKey should be true
    hasKey = true;
  }

  return NextResponse.json({
    hasKey,
    setAt,
    status: validationStatus,
  });
}
