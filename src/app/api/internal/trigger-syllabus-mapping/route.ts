import { NextRequest, NextResponse } from "next/server";
import { mapQuestionsToSyllabus } from "@/lib/syllabus/mapper";

export const maxDuration = 300; // Allow up to 5 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId, instituteId } = body;

    if (!batchId || !instituteId) {
      return NextResponse.json({ error: "Missing batchId or instituteId" }, { status: 400 });
    }

    // Process asynchronously so we don't block the caller
    // In serverless environments, Next.js might kill it if we don't await, but Vercel allows background functions or Edge background execution.
    // For Node runtime, we can just await it since we set maxDuration.
    await mapQuestionsToSyllabus(instituteId, batchId);

    return NextResponse.json({ success: true, message: "Mapping completed" });

  } catch (error: any) {
    console.error("Mapping trigger failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
