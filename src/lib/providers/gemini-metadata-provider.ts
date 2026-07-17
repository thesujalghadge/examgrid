import { MetadataProvider, ClassifyRequest, ClassificationResult } from "./metadata-provider-interface";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { getPlatformSetting } from "@/services/platform-settings-service";

const classificationSchema = {
  type: SchemaType.OBJECT,
  properties: {
    primary_node: { type: SchemaType.STRING },
    secondary_nodes: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    },
    confidence: { type: SchemaType.NUMBER },
    reasoning: { type: SchemaType.STRING },
    evidence: {
      type: SchemaType.OBJECT,
      properties: {
        keywords: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        formulae: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        entities: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        diagram_features: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        reasoning: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
      },
      required: ["keywords", "formulae", "entities", "diagram_features", "reasoning"]
    }
  },
  required: ["primary_node", "secondary_nodes", "confidence", "reasoning", "evidence"]
};

export class GeminiMetadataProvider implements MetadataProvider {
  async classify(req: ClassifyRequest): Promise<ClassificationResult> {
    let apiKey = await getPlatformSetting("GEMINI_API_KEY");
    if (!apiKey) {
      apiKey = process.env.GEMINI_API_KEY;
    }

    if (!apiKey) {
      throw new Error("Platform Gemini API Key is missing.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: classificationSchema as any,
      }
    });

    const promptVersion = "v1-structured-evidence";
    const prompt = `You are an expert academic ontologist. Your job is to classify the provided question against the given candidate topics.
You MUST choose a primary_node from the provided candidate list by outputting its node_id.
Analyze the question's core concepts, formulae, and reasoning, and populate the evidence structure appropriately.

Context:
${req.rich_context}

Candidates:
${req.candidates.map(c => `- ID: ${c.node_id} (Similarity: ${c.similarity_score})\n  Description/Path: ${c.path || c.description || 'Unknown'}`).join("\n")}
`;

    const result = await model.generateContent(prompt);
    const extractedText = result.response.text();
    const parsed = JSON.parse(extractedText);

    return {
      primary_node: parsed.primary_node,
      secondary_nodes: parsed.secondary_nodes || [],
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      evidence: parsed.evidence,
      provider: "GEMINI",
      model: "gemini-3.1-flash-lite",
      prompt_version: promptVersion
    };
  }
}
