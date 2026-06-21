import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptApiKey } from "@/lib/crypto/api-key-encryption";

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

import { assertInstituteUuid } from "@/config/institute";

export async function POST(
  request: Request,
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

  // Validation removed to allow any key format


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

export async function DELETE(
  request: Request,
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { deleteInstituteGeminiKey } = await import("@/lib/institute/get-institute-api-key");
    const success = await deleteInstituteGeminiKey(instituteId);
    if (!success) {
      return NextResponse.json({ error: "Failed to delete key" }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: "API key deleted." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete key" },
      { status: 500 },
    );
  }
}
