import { JEE_MAIN_TAXONOMY } from "@/lib/academic-taxonomy/jee-main";
import type { SupportedExamType } from "@/lib/academic-taxonomy/types";

const TAXONOMY = [...JEE_MAIN_TAXONOMY];

export interface TaxonomySuggestion {
  value: string;
  score: number;
  reason: string;
}

export interface TaggingSuggestions {
  chapters: TaxonomySuggestion[];
  topics: TaxonomySuggestion[];
  subtopics: TaxonomySuggestion[];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreCandidate(candidate: string, query: string): number {
  const left = normalize(candidate);
  const right = normalize(query);
  if (!right) return 0.5;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.82;
  const queryTokens = new Set(right.split(/\s+/).filter(Boolean));
  const candidateTokens = new Set(left.split(/\s+/).filter(Boolean));
  const overlap = [...queryTokens].filter((token) => candidateTokens.has(token)).length;
  return queryTokens.size === 0 ? 0 : overlap / queryTokens.size;
}

function uniqueTop(items: TaxonomySuggestion[], limit: number): TaxonomySuggestion[] {
  const byValue = new Map<string, TaxonomySuggestion>();
  items.forEach((item) => {
    const existing = byValue.get(item.value);
    if (!existing || item.score > existing.score) byValue.set(item.value, item);
  });
  return [...byValue.values()]
    .sort((a, b) => b.score - a.score || a.value.localeCompare(b.value))
    .slice(0, limit);
}

export function suggestTaxonomyTags({
  examType = "JEE_MAIN",
  subject,
  chapterQuery = "",
  topicQuery = "",
  subtopicQuery = "",
  limit = 8,
}: {
  examType?: SupportedExamType;
  subject?: string;
  chapterQuery?: string;
  topicQuery?: string;
  subtopicQuery?: string;
  limit?: number;
}): TaggingSuggestions {
  const taxonomies = TAXONOMY.filter(
    (entry) =>
      entry.examType === examType &&
      (!subject || normalize(entry.subject) === normalize(subject)),
  );

  const chapters: TaxonomySuggestion[] = [];
  const topics: TaxonomySuggestion[] = [];
  const subtopics: TaxonomySuggestion[] = [];

  taxonomies.forEach((taxonomy) => {
    taxonomy.chapters.forEach((chapter) => {
      chapters.push({
        value: chapter.name,
        score: scoreCandidate(chapter.name, chapterQuery || topicQuery || subtopicQuery),
        reason: `${taxonomy.subject} chapter in ${examType}`,
      });
      chapter.topics.forEach((topic) => {
        topics.push({
          value: topic.name,
          score: scoreCandidate(topic.name, topicQuery || chapterQuery || subtopicQuery),
          reason: `${chapter.name} topic`,
        });
        topic.subtopics.forEach((subtopic) => {
          subtopics.push({
            value: subtopic,
            score: scoreCandidate(subtopic, subtopicQuery || topicQuery || chapterQuery),
            reason: `${topic.name} subtopic`,
          });
        });
      });
    });
  });

  return {
    chapters: uniqueTop(chapters, limit),
    topics: uniqueTop(topics, limit),
    subtopics: uniqueTop(subtopics, limit),
  };
}

export function isKnownTaxonomyPath({
  examType = "JEE_MAIN",
  subject,
  chapter,
  topic,
  subtopic,
}: {
  examType?: SupportedExamType;
  subject: string;
  chapter: string;
  topic: string;
  subtopic?: string;
}): boolean {
  const taxonomy = TAXONOMY.find(
    (entry) => entry.examType === examType && normalize(entry.subject) === normalize(subject),
  );
  const chapterNode = taxonomy?.chapters.find(
    (entry) => normalize(entry.name) === normalize(chapter),
  );
  const topicNode = chapterNode?.topics.find(
    (entry) => normalize(entry.name) === normalize(topic),
  );
  if (!topicNode) return false;
  if (!subtopic) return true;
  return topicNode.subtopics.some((entry) => normalize(entry) === normalize(subtopic));
}
