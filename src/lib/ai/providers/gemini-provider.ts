import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import type { SolutionProvider, SolutionGenerationInput, SolutionProviderResult } from "./provider";
import { SOLUTION_PROMPT_V1 } from "../prompts/solution-v1";
import { SOLUTION_PROMPT_V2_STRICT } from "../prompts/solution-v2-strict";
import { SOLUTION_PROMPT_V3 } from "../prompts/solution-v3";
import { getInstituteGeminiKey } from "@/lib/institute/get-institute-api-key";

// ─── Legacy V1 Schema (read-only — kept for backward compat) ────────────────
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

// ─── Legacy V2-Strict Schema (read-only — kept for backward compat) ─────────
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

// ─── V3 Schema (canonical — all new solutions) ─────────────────────────────
const responseSchemaV3: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    examMode: {
      type: SchemaType.OBJECT,
      properties: {
        concepts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        keyEquations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        fastSteps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        examTricks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        estimatedSolveTime: { type: SchemaType.STRING },
        finalAnswerSummary: { type: SchemaType.STRING }
      },
      required: ["concepts", "keyEquations", "fastSteps", "estimatedSolveTime"]
    },
    learnMode: {
      type: SchemaType.OBJECT,
      properties: {
        keyIdea: { type: SchemaType.STRING },
        conceptChips: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        notations: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              symbol: { type: SchemaType.STRING },
              meaning: { type: SchemaType.STRING }
            },
            required: ["symbol", "meaning"]
          }
        },
        steps: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              title: { type: SchemaType.STRING },
              reasoning: { type: SchemaType.STRING },
              equation: { type: SchemaType.STRING },
              result: { type: SchemaType.STRING }
            },
            required: ["title", "reasoning"]
          }
        },
        importantObservation: { type: SchemaType.STRING },
        commonMistakes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        takeaway: { type: SchemaType.STRING },
        assumptions: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              assumption: { type: SchemaType.STRING },
              validity: { type: SchemaType.STRING },
              failure: { type: SchemaType.STRING }
            },
            required: ["assumption", "validity", "failure"]
          }
        }
      },
      required: ["keyIdea", "steps", "takeaway"]
    },
    finalAnswer: {
      type: SchemaType.OBJECT,
      properties: {
        value: { type: SchemaType.STRING },
        option: { type: SchemaType.STRING }
      },
      required: ["value"]
    },
    availableModes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    subject: { type: SchemaType.STRING },
    topic: { type: SchemaType.STRING },
    subtopic: { type: SchemaType.STRING },
    difficulty: { type: SchemaType.STRING },
    questionType: { type: SchemaType.STRING },
    primaryConcept: { type: SchemaType.STRING }
  },
  required: [
    "examMode", "learnMode", "finalAnswer", "availableModes",
    "subject", "topic", "subtopic", "difficulty", "questionType", "primaryConcept"
  ]
};

export class GeminiProvider implements SolutionProvider {
  name = "gemini";
  modelName = "gemini-3.1-flash-lite";

  async generateSolution(
    input: SolutionGenerationInput,
    promptVersion: string = "solution-v3"
  ): Promise<SolutionProviderResult> {
    const startTime = Date.now();

    // ── Institute key is mandatory. No .env fallback. ──────────────────────────
    const apiKey = await getInstituteGeminiKey(input.instituteId);

    console.log(`MODEL_SELECTED: ${this.modelName}`);

    const genAI = new GoogleGenerativeAI(apiKey);

    // Select schema and prompt based on version
    let schemaToUse: Schema;
    let promptTemplate: string;

    if (promptVersion === "solution-v3") {
      schemaToUse = responseSchemaV3;
      promptTemplate = SOLUTION_PROMPT_V3;
    } else if (promptVersion === "solution-v2-strict") {
      schemaToUse = responseSchemaV2;
      promptTemplate = SOLUTION_PROMPT_V2_STRICT;
    } else if (promptVersion === "solution-v1") {
      schemaToUse = responseSchemaV1;
      promptTemplate = SOLUTION_PROMPT_V1;
    } else {
      throw new Error(`Unsupported prompt version: ${promptVersion}`);
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schemaToUse,
      }
    });

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
    console.log(`MODEL_RESPONSE_RECEIVED: ${this.modelName} (${Date.now() - startTime}ms)`);
    const text = result.response.text();
    
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error(`Failed to parse Gemini JSON output: ${e}`);
    }

    const usage = result.response.usageMetadata;
    
    // ─── Build provider result based on version ─────────────────────────────
    if (promptVersion === "solution-v3") {
      return this.buildV3Result(parsed, usage);
    } else if (promptVersion === "solution-v2-strict") {
      return this.buildV2Result(parsed, usage);
    } else {
      return this.buildV1Result(parsed, usage);
    }
  }

  private buildV3Result(parsed: any, usage: any): SolutionProviderResult {
    // Build a compact markdown fallback for content_markdown column
    const learn = parsed.learnMode || {};
    const exam = parsed.examMode || {};
    
    const stepsText = (learn.steps || [])
      .map((s: any, i: number) => `**Step ${i + 1}: ${s.title}**\n${s.reasoning}${s.equation ? `\n$$${s.equation}$$` : ""}${s.result ? `\n→ ${s.result}` : ""}`)
      .join("\n\n");

    const markdownSolution = [
      `**Key Idea:** ${learn.keyIdea || ""}`,
      "",
      stepsText,
      "",
      `**Answer:** ${parsed.finalAnswer?.value || ""}`,
      learn.takeaway ? `\n**Takeaway:** ${learn.takeaway}` : "",
    ].filter(Boolean).join("\n");

    return {
      promptVersion: "solution-v3",
      markdownSolution,
      finalAnswer: parsed.finalAnswer?.value || "",
      aiMetadata: {
        ...parsed,
        schemaVersion: 3,
        promptVersion: "solution-v3",
        generatedAt: new Date().toISOString(),
        generatorModel: "gemini-3.1-flash-lite",
        validationStatus: "pending",
      },
      tokenUsage: {
        prompt: usage?.promptTokenCount || 0,
        completion: usage?.candidatesTokenCount || 0,
        total: usage?.totalTokenCount || 0,
      },
    };
  }

  private buildV2Result(parsed: any, usage: any): SolutionProviderResult {
    const stepsText = (parsed.steps || []).map((s: any) => `* **${s.title}**: ${s.explanation} ${s.equation ? `($${s.equation}$)` : ""}`).join('\n');
    const markdownSolution = `**Approach:**\n${parsed.approach}\n\n**Calculation:**\n${stepsText}\n\n**Final Answer:**\n${parsed.finalAnswer?.value}`;

    return {
      promptVersion: "solution-v2-strict",
      markdownSolution,
      finalAnswer: parsed.finalAnswer?.value || "",
      aiMetadata: {
        ...parsed,
        prompt_version: "solution-v2-strict",
        validation_status: "pending"
      },
      tokenUsage: {
        prompt: usage?.promptTokenCount || 0,
        completion: usage?.candidatesTokenCount || 0,
        total: usage?.totalTokenCount || 0,
      }
    };
  }

  private buildV1Result(parsed: any, usage: any): SolutionProviderResult {
    const stepsText = (parsed.essential_steps || []).map((s: string) => `* ${s}`).join('\n');
    const markdownSolution = `**Approach:**\n${parsed.quick_approach}\n\n**Calculation:**\n${stepsText}\n\n**Final Answer:**\n${parsed.final_answer}`;

    return {
      promptVersion: "solution-v1",
      markdownSolution,
      finalAnswer: parsed.final_answer || "",
      aiMetadata: {
        ...parsed,
        prompt_version: "solution-v1",
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
