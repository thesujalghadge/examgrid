import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import type { SolutionProvider, SolutionGenerationInput, SolutionProviderResult } from "./provider";
import { SOLUTION_PROMPT_V1 } from "../prompts/solution-v1";
import { SOLUTION_PROMPT_V2_STRICT } from "../prompts/solution-v2-strict";
import { getInstituteGeminiKey } from "@/lib/institute/get-institute-api-key";

const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    markdownSolution: { type: SchemaType.STRING },
    finalAnswer: { type: SchemaType.STRING },
    answerConfidence: { type: SchemaType.NUMBER },
    aiMetadata: {
      type: SchemaType.OBJECT,
      properties: {
        taxonomy: {
          type: SchemaType.OBJECT,
          properties: {
            subject: { type: SchemaType.STRING },
            topic: { type: SchemaType.STRING },
            subtopic: { type: SchemaType.STRING },
            concepts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
          }
        },
        cognitiveLevel: { type: SchemaType.STRING },
        difficulty: { type: SchemaType.NUMBER },
        mistakePatterns: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        learningObjective: { type: SchemaType.STRING }
      }
    }
  },
  required: ["markdownSolution", "aiMetadata"]
};

export class GeminiProvider implements SolutionProvider {
  name = "gemini";
  modelName = "gemini-2.0-flash";

  async generateSolution(
    input: SolutionGenerationInput,
    promptVersion: string
  ): Promise<SolutionProviderResult> {
    let apiKey = process.env.GEMINI_API_KEY;
    try {
      // Attempt to get institute specific key first
      const instituteKey = await getInstituteGeminiKey(input.instituteId);
      if (instituteKey) {
        apiKey = instituteKey;
      }
    } catch (err: any) {
      console.error("Failed to get institute key:", err.message);
      // Fallback to env default if DB lookup fails or is unavailable
    }

    if (!apiKey) {
      throw new Error("No Gemini API key available for provider.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    let promptTemplate = "";
    if (promptVersion === "solution-v1") {
      promptTemplate = SOLUTION_PROMPT_V1;
    } else if (promptVersion === "solution-v2-strict") {
      promptTemplate = SOLUTION_PROMPT_V2_STRICT;
    } else {
      throw new Error(`Unsupported prompt version: ${promptVersion}`);
    }

    const prompt = promptTemplate
      .replace("{{questionId}}", input.questionId)
      .replace("{{extractedSubject}}", input.extractedSubject || "Unknown")
      .replace("{{extractedChapter}}", input.extractedChapter || "Unknown")
      .replace("{{rawText}}", input.rawText)
      .replace("{{structuredOptions}}", JSON.stringify(input.structuredOptions, null, 2))
      .replace("{{correctAnswer}}", input.correctAnswer || "Not provided");

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error(`Failed to parse Gemini JSON output: ${e}`);
    }

    const usage = result.response.usageMetadata;
    
    return {
      markdownSolution: parsed.markdownSolution,
      finalAnswer: parsed.finalAnswer,
      answerConfidence: parsed.answerConfidence,
      aiMetadata: parsed.aiMetadata || {},
      promptVersion,
      tokenUsage: {
        prompt: usage?.promptTokenCount || 0,
        completion: usage?.candidatesTokenCount || 0,
        total: usage?.totalTokenCount || 0,
      }
    };
  }
}
