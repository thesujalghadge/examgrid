import { EmbeddingProvider } from "./embedding-provider";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getPlatformSetting } from "@/services/platform-settings-service";

export class GoogleEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    let apiKey = await getPlatformSetting("GEMINI_API_KEY");
    if (!apiKey) apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not found");

    const genAI = new GoogleGenerativeAI(apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const embedResult = await embeddingModel.embedContent(text);
    return embedResult.embedding.values;
  }
}
