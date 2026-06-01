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
  apiKey: z.string().trim().regex(/^AIza[0-9A-Za-z_-]+$/, "Invalid Gemini API key format"),
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
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("institutes")
      .update({
        gemini_api_key_encrypted: encrypted,
        gemini_api_key_iv: iv,
        gemini_api_key_set_at: new Date().toISOString(),
      })
      .eq("id", instituteId);

    if (error) {
      logParsingWarning("institute api key save failed", {
        instituteId,
        message: error.message,
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
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { method: "GET", cache: "no-store" },
    );
    return res.ok;
  } catch {
    return false;
  }
}
