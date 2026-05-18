export function getIntelligenceEnv() {
  return {
    redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
    storagePath: process.env.INTELLIGENCE_STORAGE_PATH ?? ".data/intelligence",
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    defaultSolutionProvider:
      (process.env.INTELLIGENCE_SOLUTION_PROVIDER as "openai" | "gemini") ??
      "openai",
    defaultVerifierProvider:
      (process.env.INTELLIGENCE_VERIFIER_PROVIDER as "openai" | "gemini") ??
      "gemini",
    instituteId:
      process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID ??
      "00000000-0000-0000-0000-000000000001",
  };
}
