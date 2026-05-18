import { getExamProfile } from "@/intelligence/config/exam-profiles";
import { suggestTaxonomyTags } from "@/lib/academic-taxonomy";
import type { SupportedExamType } from "@/lib/academic-taxonomy";
import { getDefaultSolutionProvider } from "@/intelligence/providers/provider-registry";
import { intelligenceId, nowIso } from "@/intelligence/lib/ids";
import { getIntelligenceRepository } from "@/intelligence/repositories/provider";
import type { MetadataRecord } from "@/intelligence/repositories/interfaces/intelligence-repository";
import {
  questionMetadataSchema,
  type QuestionMetadata,
} from "@/intelligence/types/pipeline";

const METADATA_SYSTEM = `Extract academic metadata for a competitive exam question.
Return ONLY valid JSON:
{
  "subject": string,
  "chapter": string,
  "topic": string,
  "subtopic": string,
  "difficulty": "easy" | "medium" | "hard",
  "conceptTags": string[],
  "formulaTags": string[],
  "cognitiveStyle": "conceptual" | "formula_heavy" | "mixed" | "unknown"
}`;

export async function extractMetadata(
  structuredQuestionId: string,
): Promise<MetadataRecord> {
  const repo = getIntelligenceRepository();
  const question = repo.getStructuredQuestion(structuredQuestionId);
  if (!question) {
    throw new Error(`Structured question not found: ${structuredQuestionId}`);
  }

  const solution = repo.listSolutions({ structuredQuestionId })[0];
  const profile = getExamProfile(question.examProfileId);
  const provider = getDefaultSolutionProvider();

  const response = await provider.complete({
    messages: [
      { role: "system", content: METADATA_SYSTEM },
      {
        role: "user",
        content: JSON.stringify({
          examProfileId: question.examProfileId,
          questionText: question.segment.questionText,
          solutionSummary: solution?.structured.summary,
        }),
      },
    ],
    responseFormat: "json",
    temperature: 0.1,
  });

  let metadata: QuestionMetadata;
  try {
    metadata = questionMetadataSchema.parse(JSON.parse(response.content));
  } catch {
    metadata = {
      subject: question.segment.subject,
      conceptTags: [],
      formulaTags: [],
      cognitiveStyle: "unknown",
      taxonomyConfidence: 0.3,
    };
  }

  const taxonomyKey = profile?.taxonomyKey as SupportedExamType | undefined;
  if (taxonomyKey && metadata.subject) {
    const suggestions = suggestTaxonomyTags({
      examType: taxonomyKey,
      subject: metadata.subject,
      chapterQuery: question.segment.questionText,
      topicQuery: question.segment.questionText,
      limit: 3,
    });
    const topChapter = suggestions.chapters[0];
    const topTopic = suggestions.topics[0];
    if (topChapter && !metadata.chapter) {
      metadata.chapter = topChapter.value;
    }
    if (topTopic && !metadata.topic) {
      metadata.topic = topTopic.value;
    }
    metadata.taxonomyConfidence = Math.max(
      metadata.taxonomyConfidence ?? 0,
      topChapter?.score ?? topTopic?.score ?? 0.5,
    );
  }

  const now = nowIso();
  const record: MetadataRecord = {
    id: intelligenceId("meta"),
    structuredQuestionId,
    metadata,
    providerId: response.providerId,
    rawResponse: response.content,
    confidence: provider.isConfigured() ? 0.68 : 0.35,
    createdAt: now,
    updatedAt: now,
  };

  repo.saveMetadata(record);
  return record;
}
