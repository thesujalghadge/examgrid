import { getDefaultSolutionProvider } from "@/intelligence/providers/provider-registry";
import { intelligenceId, nowIso } from "@/intelligence/lib/ids";
import { getIntelligenceRepository } from "@/intelligence/repositories/provider";
import type { AiSolutionRecord } from "@/intelligence/repositories/interfaces/intelligence-repository";
import {
  structuredSolutionSchema,
  type StructuredSolution,
} from "@/intelligence/types/pipeline";
import type { SolutionGenerationInput } from "@/intelligence/types/providers";

const SOLUTION_SYSTEM = `You are an expert competitive exam tutor.
Return ONLY valid JSON matching:
{
  "summary": string,
  "steps": [{"order": number, "title": string, "body": string}],
  "finalAnswer": string,
  "keyConcepts": string[]
}`;

export async function generateSolution(
  input: SolutionGenerationInput,
): Promise<{
  structured: StructuredSolution;
  rawResponse: string;
  providerId: string;
  model: string;
  confidence: number;
}> {
  const provider = getDefaultSolutionProvider();
  const userPayload = JSON.stringify({
    examProfileId: input.examProfileId,
    subject: input.subject,
    questionText: input.questionText,
    options: input.options,
    correctAnswer: input.correctAnswer,
  });

  const response = await provider.complete({
    messages: [
      { role: "system", content: SOLUTION_SYSTEM },
      {
        role: "user",
        content: `Generate a structured solution for this question:\n${userPayload}`,
      },
    ],
    responseFormat: "json",
    temperature: 0.2,
  });

  let structured: StructuredSolution;
  try {
    const parsed = JSON.parse(response.content);
    structured = structuredSolutionSchema.parse(parsed);
  } catch {
    structured = {
      summary: response.content.slice(0, 500),
      steps: [{ order: 1, title: "Solution", body: response.content }],
      finalAnswer: input.correctAnswer,
      keyConcepts: [],
    };
  }

  const confidence = provider.isConfigured() ? 0.72 : 0.35;

  return {
    structured,
    rawResponse: response.content,
    providerId: response.providerId,
    model: response.model,
    confidence,
  };
}

export async function runSolutionJob(
  structuredQuestionId: string,
): Promise<AiSolutionRecord> {
  const repo = getIntelligenceRepository();
  const question = repo.getStructuredQuestion(structuredQuestionId);
  if (!question) {
    throw new Error(`Structured question not found: ${structuredQuestionId}`);
  }

  const result = await generateSolution({
    questionText: question.segment.questionText,
    options: question.segment.options,
    correctAnswer: question.segment.correctAnswer,
    examProfileId: question.examProfileId,
    subject: question.segment.subject,
  });

  const now = nowIso();
  const record: AiSolutionRecord = {
    id: intelligenceId("sol"),
    structuredQuestionId,
    providerId: result.providerId,
    model: result.model,
    structured: result.structured,
    rawResponse: result.rawResponse,
    confidence: result.confidence,
    reviewStatus: result.confidence >= 0.65 ? "pending" : "needs_edit",
    createdAt: now,
    updatedAt: now,
  };

  repo.saveSolution(record);
  return record;
}
