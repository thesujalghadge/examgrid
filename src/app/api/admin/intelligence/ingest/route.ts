import { NextResponse } from "next/server";
import { getIntelligenceEnv } from "@/intelligence/config/env";
import { listExamProfiles } from "@/intelligence/config/exam-profiles";
import { uploadPyqSource } from "@/intelligence/services/pyq-ingestion/ingestion-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const examProfileId = String(form.get("examProfileId") ?? "");
    const examYearRaw = form.get("examYear");
    const subjectHint = form.get("subjectHint");
    const instituteId = form.get("instituteId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!examProfileId) {
      return NextResponse.json(
        { error: "examProfileId is required" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadPyqSource({
      instituteId:
        instituteId != null ? String(instituteId) : undefined,
      examProfileId,
      examYear: examYearRaw ? Number(examYearRaw) : undefined,
      subjectHint: subjectHint ? String(subjectHint) : undefined,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileBuffer: buffer,
    });

    return NextResponse.json({
      ok: true,
      source: result.source,
      extractionJobId: result.extractionJobId,
      queued: result.queued,
      message: result.queued
        ? "Upload accepted — pipeline queued on Redis/BullMQ"
        : "Upload accepted — pipeline ran inline (Redis unavailable)",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Ingestion failed",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    examProfiles: listExamProfiles(),
    defaultInstituteId: getIntelligenceEnv().instituteId,
    supportedMimeTypes: [
      "application/pdf",
      "text/plain",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  });
}
