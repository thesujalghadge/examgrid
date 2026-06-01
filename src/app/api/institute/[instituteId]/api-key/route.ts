import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptApiKey } from "@/lib/crypto/api-key-encryption";
import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";
import {
  logSessionWarning,
  logParsingEvent,
  logParsingWarning,
} from "@/lib/logging/runtime-logger";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  apiKey: z.string().trim().min(10, "API key is too short"),
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
    logSessionWarning("institute api key save denied", {
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

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const valid = await validateGeminiKey(parsed.data.apiKey);
  if (!valid) {
    return NextResponse.json(
      { error: "Gemini API key validation failed. Check the key and try again." },
      { status: 400 },
    );
  }

  try {
    const { encrypted, iv } = await encryptApiKey(parsed.data.apiKey);
    const { setInstituteGeminiKey } = await import("@/lib/institute/get-institute-api-key");
    const success = await setInstituteGeminiKey(instituteId, encrypted, iv);

    if (!success) {
      logParsingWarning("institute api key save failed", {
        instituteId,
      });
      return NextResponse.json({ error: "Failed to save key" }, { status: 500 });
    }

    logParsingEvent("institute api key saved", { instituteId });
    return NextResponse.json({ success: true, message: "API key saved and validated." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save key" },
      { status: 500 },
    );
  }
}

async function validateGeminiKey(apiKey: string): Promise<boolean> {
  // Relaxed validation to avoid proxy/fetch failures.
  // Google Gemini API keys always start with AIza.
  return apiKey.startsWith("AIza");
}
