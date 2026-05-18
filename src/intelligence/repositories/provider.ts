import { FilesystemIntelligenceRepository } from "@/intelligence/repositories/local/filesystem-intelligence-repository";
import type { IntelligenceRepository } from "@/intelligence/repositories/interfaces/intelligence-repository";

let instance: IntelligenceRepository | null = null;

export function getIntelligenceRepository(): IntelligenceRepository {
  if (!instance) {
    instance = new FilesystemIntelligenceRepository();
  }
  return instance;
}
