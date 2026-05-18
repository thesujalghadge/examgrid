import { getIntelligenceEnv } from "@/intelligence/config/env";
import { GeminiProvider } from "@/intelligence/providers/gemini-provider";
import { OpenAiProvider } from "@/intelligence/providers/openai-provider";
import type { LlmProvider, LlmProviderId } from "@/intelligence/types/providers";

const openai = new OpenAiProvider();
const gemini = new GeminiProvider();

const providers: Record<string, LlmProvider> = {
  [openai.id]: openai,
  [gemini.id]: gemini,
};

export function getLlmProvider(id: LlmProviderId): LlmProvider {
  const provider = providers[id];
  if (!provider) {
    throw new Error(`LLM provider not registered: ${id}`);
  }
  return provider;
}

export function listLlmProviders(): LlmProvider[] {
  return Object.values(providers);
}

export function getDefaultSolutionProvider(): LlmProvider {
  return getLlmProvider(getIntelligenceEnv().defaultSolutionProvider);
}

export function getDefaultVerifierProvider(): LlmProvider {
  return getLlmProvider(getIntelligenceEnv().defaultVerifierProvider);
}
