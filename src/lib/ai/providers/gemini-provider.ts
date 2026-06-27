import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import type { SolutionProvider, SolutionGenerationInput, SolutionProviderResult } from "./provider";
import { SOLUTION_PROMPT_V1 } from "../prompts/solution-v1";
import { SOLUTION_PROMPT_V2_STRICT } from "../prompts/solution-v2-strict";
import { getInstituteGeminiKey } from "@/lib/institute/get-institute-api-key";

const responseSchemaV1: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    subject: { type: SchemaType.STRING },
    topic: { type: SchemaType.STRING },
    subtopic: { type: SchemaType.STRING },
    difficulty: { type: SchemaType.STRING },
    question_type: { type: SchemaType.STRING },
    primary_concept: { type: SchemaType.STRING },
    secondary_concept: { type: SchemaType.STRING },
    quick_approach: { type: SchemaType.STRING },
    essential_steps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    final_answer: { type: SchemaType.STRING }
  },
  required: [
    "subject", "topic", "subtopic", "difficulty", "question_type",
    "primary_concept", "secondary_concept", "quick_approach",
    "essential_steps", "final_answer"
  ]
};

const responseSchemaV2: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    concept: { type: SchemaType.STRING },
    approach: { type: SchemaType.STRING },
    steps: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          explanation: { type: SchemaType.STRING },
          equation: { type: SchemaType.STRING }
        },
        required: ["title", "explanation"]
      }
    },
    finalAnswer: {
      type: SchemaType.OBJECT,
      properties: {
        value: { type: SchemaType.STRING },
        option: { type: SchemaType.STRING }
      },
      required: ["value"]
    },
    takeaway: { type: SchemaType.STRING },
    difficulty: { type: SchemaType.STRING },
    commonMistake: { type: SchemaType.STRING },
    shortcut: { type: SchemaType.STRING },
    timeSavingTip: { type: SchemaType.STRING },
    estimatedSolveTime: { type: SchemaType.STRING },
    examFrequency: { type: SchemaType.STRING },
    subject: { type: SchemaType.STRING },
    topic: { type: SchemaType.STRING },
    subtopic: { type: SchemaType.STRING },
    question_type: { type: SchemaType.STRING },
    primary_concept: { type: SchemaType.STRING },
    prompt_version: { type: SchemaType.STRING },
    validation_status: { type: SchemaType.STRING }
  },
  required: [
    "concept", "approach", "steps", "finalAnswer", "takeaway",
    "subject", "topic", "subtopic", "question_type", "primary_concept",
    "prompt_version", "validation_status"
  ]
};

export class GeminiProvider implements SolutionProvider {
  name = "gemini";
  modelName = "gemini-2.5-flash";

  async generateSolution(
    input: SolutionGenerationInput,
    promptVersion: string = "solution-v1"
  ): Promise<SolutionProviderResult> {
    const startTime = Date.now();

    // ── Institute key is mandatory. No .env fallback. ──────────────────────────
    // If the institute has no Gemini key configured, getInstituteGeminiKey()
    // throws with name="NO_KEY". This propagates to processLeasedJob() which
    // calls markJobFailed() with error_code "NO_KEY".
    // This prevents one institute from silently consuming a global quota.
    const apiKey = await getInstituteGeminiKey(input.instituteId);

    console.log(`MODEL_SELECTED: ${this.modelName}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const schemaToUse = promptVersion === "solution-v2-strict" ? responseSchemaV2 : responseSchemaV1;
    
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schemaToUse,
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
      .replace("{{questionType}}", input.questionType || "Unknown")
      .replace("{{rawText}}", input.rawText)
      .replace("{{structuredOptions}}", JSON.stringify(input.structuredOptions, null, 2))
      .replace("{{correctAnswer}}", input.correctAnswer || "Not provided");

    const promptParts: any[] = [{ text: prompt }];

    if (input.imageUrl) {
      const fs = require("fs");
      const path = require("path");
      try {
        const imagePath = path.join(process.cwd(), "public", input.imageUrl);
        if (fs.existsSync(imagePath)) {
          const imageBuffer = fs.readFileSync(imagePath);
          const mimeType = input.imageUrl.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
          promptParts.push({
            inlineData: {
              data: imageBuffer.toString("base64"),
              mimeType
            }
          });
        }
      } catch (err) {
        console.error("Failed to load image for Gemini:", err);
      }
    }

    const result = await model.generateContent(promptParts);
    console.log(`MODEL_RESPONSE_RECEIVED: ${this.modelName}`);
    const text = result.response.text();
    
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error(`Failed to parse Gemini JSON output: ${e}`);
    }

    const usage = result.response.usageMetadata;
    
    // For markdown Solution (fallback / compatibility)
    let markdownSolution = "";
    if (promptVersion === "solution-v2-strict") {
      const stepsText = (parsed.steps || []).map((s: any) => `* **${s.title}**: ${s.explanation} ${s.equation ? `($${s.equation}$)` : ""}`).join('\n');
      markdownSolution = `**Approach:**\n${parsed.approach}\n\n**Calculation:**\n${stepsText}\n\n**Final Answer:**\n${parsed.finalAnswer?.value}`;
    } else {
      const stepsText = (parsed.essential_steps || []).map((s: string) => `* ${s}`).join('\n');
      markdownSolution = `**Approach:**\n${parsed.quick_approach}\n\n**Calculation:**\n${stepsText}\n\n**Final Answer:**\n${parsed.final_answer}`;
    }

    // Merge whatever parsed gave us directly into aiMetadata to be stored in DB
    const finalAnswerValue = promptVersion === "solution-v2-strict" ? parsed.finalAnswer?.value : parsed.final_answer;

    return {
      promptVersion,
      markdownSolution,
      finalAnswer: finalAnswerValue,
      aiMetadata: {
        ...parsed, // Just store the entire raw JSON from the model in aiMetadata
        prompt_version: promptVersion,
        validation_status: "pending"
      },
      tokenUsage: {
        prompt: usage?.promptTokenCount || 0,
        completion: usage?.candidatesTokenCount || 0,
        total: usage?.totalTokenCount || 0,
      }
    };
  }
}
