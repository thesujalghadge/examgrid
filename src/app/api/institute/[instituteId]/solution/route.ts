import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient, getInstituteGeminiKey } from "@/lib/institute/get-institute-api-key";
import { logParsingWarning, logSessionWarning } from "@/lib/logging/runtime-logger";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const solutionRequestSchema = z.object({
  questionId: z.string().uuid(),
  questionText: z.string().min(1).max(20_000),
  options: z.record(z.string(), z.string()).nullable().optional(),
  subject: z.string().max(80).nullable().optional(),
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
    logSessionWarning("solution generation denied", {
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

  const parsed = solutionRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid solution request" }, { status: 400 });
  }

  const { questionId, questionText, options, subject } = parsed.data;
  const supabase = createServiceRoleClient();
  if (supabase) {
    const { data: existing } = await supabase
      .from("question_solutions")
      .select("solution_text")
      .eq("question_id", questionId)
      .single();

    if (existing?.solution_text) {
      return NextResponse.json({ solution: existing.solution_text, cached: true });
    }
  }

  try {
    const geminiKey = await getInstituteGeminiKey(instituteId);
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const optionsText = options
      ? Object.entries(options)
          .map(([key, value]) => `(${key}) ${value}`)
          .join("\n")
      : "";

    const prompt = `You are an expert ${subject ?? "science/math"} tutor for competitive exams.

Provide a clear, step-by-step solution to this question.

Question:
${questionText}

${optionsText ? `Options:\n${optionsText}` : ""}

Instructions:
- Show all working steps clearly
- For math: use LaTeX notation ($inline$ and $$block$$)
- For chemistry: write equations clearly
- State the answer clearly at the end
- Keep it concise but complete (under 300 words)`;

    const result = await model.generateContent(prompt);
    const solution = result.response.text().trim();

    if (supabase) {
      await supabase.from("question_solutions").upsert(
        {
          question_id: questionId,
          solution_text: solution,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "question_id" },
      );
    }

    return NextResponse.json({ solution, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate solution";
    logParsingWarning("solution generation failed", { instituteId, questionId, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
