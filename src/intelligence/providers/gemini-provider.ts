import { getIntelligenceEnv } from "@/intelligence/config/env";
import type {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmProvider,
} from "@/intelligence/types/providers";

export class GeminiProvider implements LlmProvider {
  readonly id = "gemini" as const;
  readonly displayName = "Google Gemini";

  isConfigured(): boolean {
    return Boolean(getIntelligenceEnv().geminiApiKey);
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const env = getIntelligenceEnv();
    if (!env.geminiApiKey) {
      return this.stubResponse(request);
    }

    const system = request.messages.find((m) => m.role === "system")?.content;
    const userParts = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n\n");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: [{ role: "user", parts: [{ text: userParts }] }],
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.maxTokens ?? 4096,
          responseMimeType:
            request.responseFormat === "json" ? "application/json" : "text/plain",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errText}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content =
      json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
      "";

    return {
      providerId: this.id,
      model: env.geminiModel,
      content,
      raw: json,
    };
  }

  private stubResponse(request: LlmCompletionRequest): LlmCompletionResponse {
    const env = getIntelligenceEnv();
    const placeholder =
      request.responseFormat === "json"
        ? JSON.stringify({
            agreementScore: 0.85,
            confidenceScore: 0.8,
            status: "agreed",
            discrepancies: [],
            reviewerNotes: "Stub verification — configure GEMINI_API_KEY.",
          })
        : "Stub verification — configure GEMINI_API_KEY.";

    return {
      providerId: this.id,
      model: `${env.geminiModel} (stub)`,
      content: placeholder,
      raw: { stub: true },
    };
  }
}
