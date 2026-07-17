import { ClassificationProvider, ClassifyRequest, ClassificationResult } from "./classification-provider";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { getPlatformSetting } from "@/services/platform-settings-service";

const classificationSchema = {
  type: SchemaType.OBJECT,
  properties: {
    node_id: { type: SchemaType.STRING },
    confidence: { type: SchemaType.NUMBER },
    reasoning: { type: SchemaType.STRING },
    evidence: {
      type: SchemaType.OBJECT,
      properties: {
        keywords: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        formulae: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
      },
      required: ["keywords", "formulae"]
    }
  },
  required: ["node_id", "confidence", "reasoning", "evidence"]
};

export class GeminiClassificationProvider implements ClassificationProvider {
  async classify(req: ClassifyRequest): Promise<ClassificationResult> {
    let apiKey = await getPlatformSetting("GEMINI_API_KEY");
    if (!apiKey) apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not found");

    const genAI = new GoogleGenerativeAI(apiKey);
    const flashModel = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: classificationSchema as any,
      }
    });

    const candidateListStr = req.candidates.map(c => 
      `- ID: ${c.node_id} (Similarity: ${c.similarity_score.toFixed(4)})\n  Name: ${c.name} (${c.node_type})`
    ).join('\n');

    const prompt = `You are an expert academic ontologist. Your job is to classify the provided question against the given candidate curriculum topics.
You MUST choose a node_id from the provided candidate list. This is a strict requirement.

Context:
${req.query_text}

Top-K retrieved Curriculum Candidates:
${candidateListStr}
`;

    const result = await flashModel.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());

    // Validate constraint
    const candidateIds = req.candidates.map(c => c.node_id);
    if (!candidateIds.includes(parsed.node_id)) {
      throw new Error(`LLM selected invalid node_id ${parsed.node_id}. Must be from candidates.`);
    }

    return {
      node_id: parsed.node_id,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      evidence: parsed.evidence,
      provider: "GEMINI",
      model: "gemini-3.1-flash-lite",
      prompt_version: "v1-curriculum-leaf",
      prompt_used: prompt,
      raw_response: result.response.text()
    };
  }
}
