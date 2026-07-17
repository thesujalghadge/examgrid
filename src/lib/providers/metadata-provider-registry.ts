import { MetadataProvider } from "./metadata-provider-interface";
import { GeminiMetadataProvider } from "./gemini-metadata-provider";

export function getMetadataProvider(provider: string = "GEMINI"): MetadataProvider {
  if (provider === "GEMINI") {
    return new GeminiMetadataProvider();
  }
  
  throw new Error(`Unknown metadata provider: ${provider}`);
}
