import { getIntelligenceEnv } from "@/intelligence/config/env";
import type {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmProvider,
} from "@/intelligence/types/providers";

export class OpenAiProvider implements LlmProvider {
  readonly id = "openai" as const;
  readonly displayName = "OpenAI";

  isConfigured(): boolean {
    return Boolean(getIntelligenceEnv().openaiApiKey);
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const env = getIntelligenceEnv();
    if (!env.openaiApiKey) {
      return this.stubResponse(request);
    }

    const body: Record<string, unknown> = {
      model: env.openaiModel,
      messages: request.messages,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 4096,
    };
    if (request.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${errText}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content ?? "";

    return {
      providerId: this.id,
      model: env.openaiModel,
      content,
      raw: json,
      usage: {
        promptTokens: json.usage?.prompt_tokens,
        completionTokens: json.usage?.completion_tokens,
      },
    };
  }

  private stubResponse(request: LlmCompletionRequest): LlmCompletionResponse {
    const env = getIntelligenceEnv();
    const placeholder =
      request.responseFormat === "json"
        ? JSON.stringify({
            summary: "Stub solution — configure OPENAI_API_KEY for live generation.",
            steps: [{ order: 1, title: "Setup", body: "Add API credentials." }],
            finalAnswer: "",
            keyConcepts: [],
          })
        : "Stub response — configure OPENAI_API_KEY.";

    return {
      providerId: this.id,
      model: `${env.openaiModel} (stub)`,
      content: placeholder,
      raw: { stub: true },
    };
  }
}
