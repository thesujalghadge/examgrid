import { intelligenceId, nowIso } from "@/intelligence/lib/ids";
import { getIntelligenceRepository } from "@/intelligence/repositories/provider";
import type { EmbeddingRecord } from "@/intelligence/repositories/interfaces/intelligence-repository";
import { getEmbeddingProvider } from "@/intelligence/services/embeddings/embedding-provider";
import { normalizeAcademicText } from "@/intelligence/services/normalization/normalization-service";

function stableHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) hash = (hash * 33) ^ value.charCodeAt(i);
  return (hash >>> 0).toString(36);
}

async function saveEmbedding(
  structuredQuestionId: string,
  targetType: EmbeddingRecord["targetType"],
  text: string,
): Promise<EmbeddingRecord | null> {
  const normalized = normalizeAcademicText(text).text;
  if (!normalized) return null;
  const provider = getEmbeddingProvider();
  const vector = await provider.embed(normalized);
  const now = nowIso();
  const record: EmbeddingRecord = {
    id: intelligenceId("emb"),
    structuredQuestionId,
    targetType,
    providerId: provider.id,
    model: provider.model,
    vector,
    dimensions: provider.dimensions,
    textHash: stableHash(normalized),
    createdAt: now,
    updatedAt: now,
  };
  getIntelligenceRepository().saveEmbedding(record);
  return record;
}

export async function generateEmbeddingsForQuestion(
  structuredQuestionId: string,
): Promise<EmbeddingRecord[]> {
  const repo = getIntelligenceRepository();
  const question = repo.getStructuredQuestion(structuredQuestionId);
  if (!question) return [];
  const solution = repo.listSolutions({ structuredQuestionId })[0];
  const metadata = repo.getMetadataByQuestion(structuredQuestionId);

  const records = await Promise.all([
    saveEmbedding(structuredQuestionId, "question", question.segment.questionText),
    saveEmbedding(
      structuredQuestionId,
      "solution",
      solution
        ? `${solution.structured.summary}\n${solution.structured.steps.map((s) => s.body).join("\n")}`
        : "",
    ),
    saveEmbedding(
      structuredQuestionId,
      "concept",
      metadata
        ? [
            metadata.metadata.chapter,
            metadata.metadata.topic,
            metadata.metadata.subtopic,
            ...metadata.metadata.conceptTags,
            ...metadata.metadata.formulaTags,
          ]
            .filter(Boolean)
            .join(" ")
        : "",
    ),
  ]);
  return records.filter((record): record is EmbeddingRecord => Boolean(record));
}

export function enqueueEmbeddingGeneration(structuredQuestionId: string): void {
  setTimeout(() => {
    void generateEmbeddingsForQuestion(structuredQuestionId);
  }, 0);
}

