import { NextResponse } from "next/server";
import { logParsingEvent, logParsingWarning, logSessionWarning } from "@/lib/logging/runtime-logger";
import { extractUploadContent } from "@/lib/server/upload-extraction";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";
import type { SupportedPaperFileType } from "@/types/cbt-paper-processing";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  kind: z.enum(["paper", "answer_key"]),
  fileType: z.enum(["pdf", "doc", "docx", "csv", "xlsx", "txt"]),
});

export async function POST(request: Request) {
  const session = await readVerifiedWorkspaceSession();
  if (!session || (session.role !== "institute" && session.role !== "platform_admin")) {
    logSessionWarning("paper extract denied", { reason: "unauthorized" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const parsed = requestSchema.safeParse({
    kind: formData.get("kind"),
    fileType: formData.get("fileType"),
  });
  if (!(file instanceof File) || !parsed.success) {
    return NextResponse.json({ error: "Invalid extraction request" }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await extractUploadContent({
      fileName: file.name,
      fileType: parsed.data.fileType as SupportedPaperFileType,
      bytes,
    });
    logParsingEvent("upload_extraction_completed", {
      instituteId: session.instituteId ?? null,
      kind: parsed.data.kind,
      fileName: file.name,
      fileType: parsed.data.fileType,
      pages: result.summary.pages,
      extractedChars: result.summary.extractedChars,
      usedOCR: result.summary.usedOCR,
      warnings: result.summary.warnings,
    });
    return NextResponse.json(result);
  } catch (error) {
    logParsingWarning("upload_extraction_failed", {
      instituteId: session.instituteId ?? null,
      fileName: file.name,
      fileType: parsed.data.fileType,
      message: error instanceof Error ? error.message : "Unknown extraction error",
    });
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
