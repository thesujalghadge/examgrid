import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getInstituteGeminiKey } from "@/lib/institute/get-institute-api-key";
import { logParsingEvent, logParsingWarning, logSessionWarning } from "@/lib/logging/runtime-logger";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const parseCallsInFlight = new Map<string, number>();
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const parseFormSchema = z.object({
  answerKey: z.string().max(20_000).nullable(),
});

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

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
    logSessionWarning("parse paper denied", {
      reason: "unauthorized",
      userId: session?.userId,
      instituteId,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const inFlight = parseCallsInFlight.get(instituteId) ?? 0;
  if (inFlight > 0) {
    return NextResponse.json(
      { error: "A parse is already in progress for this institute" },
      { status: 429 },
    );
  }
  parseCallsInFlight.set(instituteId, inFlight + 1);

  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file");
    const parsedForm = parseFormSchema.safeParse({
      answerKey: formData.get("answerKey"),
    });
    if (!(file instanceof File) || !parsedForm.success) {
      return NextResponse.json({ error: "Invalid parse request" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum 20MB." }, { status: 400 });
    }

    const declaredMimeType = file.type || "application/pdf";
    if (!allowedTypes.has(declaredMimeType)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${declaredMimeType}` },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedMimeType = detectMimeType(buffer);
    if (!detectedMimeType || detectedMimeType !== declaredMimeType) {
      return NextResponse.json(
        { error: "Uploaded file content does not match the declared file type." },
        { status: 400 },
      );
    }

    let geminiKey: string;
    try {
      geminiKey = await getInstituteGeminiKey(instituteId);
    } catch {
      return NextResponse.json(
        { error: "No Gemini API key configured for this institute. Please add one in Settings." },
        { status: 400 },
      );
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent([
      { inlineData: { mimeType: detectedMimeType, data: buffer.toString("base64") } },
      PARSE_PROMPT,
    ]);

    let text = result.response.text().trim();
    text = text.replace(/^```json?\s*/i, "").replace(/\s*```$/, "").trim();

    let parsed: ParsedPaper;
    try {
      parsed = parsedPaperSchema.parse(JSON.parse(text));
    } catch {
      return NextResponse.json(
        {
          error: "AI returned malformed response. Try uploading a clearer PDF.",
          raw: text.substring(0, 500),
        },
        { status: 500 },
      );
    }

    if (parsedForm.data.answerKey) {
      const answers = parseAnswerKey(parsedForm.data.answerKey);
      parsed.questions = parsed.questions.map((question) => ({
        ...question,
        correct_answer: answers[question.number] ?? question.correct_answer ?? null,
      }));
    }

    logParsingEvent("gemini paper parse completed", {
      instituteId,
      fileName: file.name,
      questionCount: parsed.questions.length,
    });
    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logParsingWarning("gemini paper parse failed", { instituteId, message });
    if (message.includes("429") || message.toLowerCase().includes("quota")) {
      return NextResponse.json(
        {
          error:
            "Gemini API quota exceeded. Free tier: 1500 requests/day. Try again tomorrow or upgrade your API key.",
        },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    const remaining = (parseCallsInFlight.get(instituteId) ?? 1) - 1;
    if (remaining <= 0) parseCallsInFlight.delete(instituteId);
    else parseCallsInFlight.set(instituteId, remaining);
  }
}

function detectMimeType(buffer: Buffer): string | null {
  if (buffer.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (
    buffer.subarray(0, 4).toString() === "RIFF" &&
    buffer.subarray(8, 12).toString() === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

const parsedQuestionSchema = z.object({
  number: z.number().int().positive(),
  text: z.string().min(1),
  options: z.record(z.string(), z.string()).nullable(),
  type: z.enum(["mcq", "integer", "multi_correct"]),
  correct_answer: z.string().nullable(),
  marks: z.number(),
  negative_marks: z.number(),
});

const parsedPaperSchema = z.object({
  paper_title: z.string().nullable(),
  subject: z.string().nullable(),
  total_marks: z.number().nullable(),
  questions: z.array(parsedQuestionSchema).min(1),
});

type ParsedPaper = z.infer<typeof parsedPaperSchema>;

function parseAnswerKey(text: string): Record<number, string> {
  const answers: Record<number, string> = {};
  for (const line of text.split("\n")) {
    const match = line.trim().match(/^[Qq]?(\d+)[.)]\s*\(?([^\s)\n]+)\)?/);
    if (match) answers[Number.parseInt(match[1], 10)] = match[2];
  }
  return answers;
}

const PARSE_PROMPT = `You are an expert exam paper parser for competitive exams (JEE, NEET, UPSC, etc).

Extract ALL questions from this document and return ONLY valid JSON - no markdown, no explanation, no preamble.

MATH/SCIENCE FORMATTING RULES (critical):
- Write ALL mathematical expressions in standard LaTeX
- Inline math: wrap in single dollar signs: $x^2 + y^2 = r^2$
- Display/block math: wrap in double dollar signs: $$\\int_0^{\\pi} f(x)\\,dx$$
- Chemical equations: use \\ce{} notation: $\\ce{H2SO4 -> 2H+ + SO4^{2-}}$
- Vectors: $\\vec{F} = m\\vec{a}$
- Greek letters: $\\alpha, \\beta, \\gamma, \\Delta, \\omega$
- Fractions: $\\frac{a}{b}$
- Subscripts: $a_1, a_2$, Superscripts: $x^2$
- Square roots: $\\sqrt{x}$, nth root: $\\sqrt[n]{x}$
- Summation: $\\sum_{r=1}^{n}$
- For options that are pure math, also wrap them in $ $

QUESTION TYPE RULES:
- "mcq": has exactly 4 options labeled 1,2,3,4
- "integer": numerical answer, no options (options: null)
- "multi_correct": multiple correct options possible

STRUCTURE:
{
  "paper_title": "string or null",
  "subject": "Mathematics" | "Physics" | "Chemistry" | "Biology" | "Mixed" | null,
  "total_marks": number or null,
  "questions": [
    {
      "number": 1,
      "text": "Full question text with $LaTeX$ for math",
      "options": {
        "1": "option with $math$ if needed",
        "2": "option text",
        "3": "option text",
        "4": "option text"
      },
      "type": "mcq",
      "correct_answer": null,
      "marks": 4,
      "negative_marks": 1
    }
  ]
}

Include every single question. Do not skip any. Return ONLY the JSON object.`;
