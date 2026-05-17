import { DIFFICULTY_METADATA } from "@/lib/academic-taxonomy";
import type { BankQuestion, QuestionDifficulty } from "@/types/question-bank";

export interface TopicAggregate {
  subject: string;
  chapter: string;
  topic: string;
  totalQuestions: number;
  averageWeightageScore: number;
  averagePredictiveScore: number;
  difficultyCounts: Record<QuestionDifficulty, number>;
}

export interface SimilarityResult {
  questionId: string;
  score: number;
  reasons: string[];
}

export interface DuplicateCandidate {
  sourceQuestionId: string;
  duplicateQuestionId: string;
  similarityScore: number;
  reasons: string[];
}

export interface QuestionSimilarityMetadata {
  normalizedQuestionText: string;
  similarityFingerprint: string;
  similarityGroupKey: string;
  archetypeKey: string;
}

export interface SimilarityGroup {
  fingerprint: string;
  questionIds: string[];
  normalizedQuestionText: string;
}

export interface ArchetypeCluster {
  archetypeKey: string;
  questionIds: string[];
  subject: string;
  chapter: string;
  topic: string;
}

export function normalizeQuestionText(value: string): string {
  return value
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function tokenize(value: string): Set<string> {
  return new Set(
    normalizeQuestionText(value)
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) return 1;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

export function difficultyScore(question: Pick<BankQuestion, "difficultyLevel">): number {
  return DIFFICULTY_METADATA[question.difficultyLevel]?.score ?? 2;
}

export function buildQuestionSimilarityMetadata(
  question: Pick<
    BankQuestion,
    | "questionText"
    | "subject"
    | "chapter"
    | "topic"
    | "subtopic"
    | "difficultyLevel"
    | "conceptTags"
    | "formulaTags"
  >,
): QuestionSimilarityMetadata {
  const normalizedQuestionText = normalizeQuestionText(question.questionText);
  const taxonomyKey = [
    question.subject,
    question.chapter,
    question.topic,
    question.subtopic,
  ]
    .map((part) => normalizeQuestionText(part))
    .filter(Boolean)
    .join("|");
  const tagKey = [...question.conceptTags, ...question.formulaTags]
    .map(normalizeQuestionText)
    .filter(Boolean)
    .sort()
    .join("|");

  return {
    normalizedQuestionText,
    similarityFingerprint: stableHash(normalizedQuestionText),
    similarityGroupKey: stableHash(`${taxonomyKey}|${normalizedQuestionText}`),
    archetypeKey: stableHash(`${taxonomyKey}|${question.difficultyLevel}|${tagKey}`),
  };
}

export function questionSimilarity(
  source: BankQuestion,
  candidate: BankQuestion,
): SimilarityResult {
  const reasons: string[] = [];
  const textScore = jaccard(tokenize(source.questionText), tokenize(candidate.questionText));
  const conceptScore = jaccard(new Set(source.conceptTags), new Set(candidate.conceptTags));
  const formulaScore = jaccard(new Set(source.formulaTags), new Set(candidate.formulaTags));
  const sameTopic = source.topic === candidate.topic ? 0.15 : 0;
  const sameChapter = source.chapter === candidate.chapter ? 0.1 : 0;
  const score = Math.min(
    1,
    textScore * 0.55 + conceptScore * 0.15 + formulaScore * 0.15 + sameTopic + sameChapter,
  );

  if (textScore >= 0.7) reasons.push("similar wording");
  if (sameTopic > 0) reasons.push("same topic");
  if (sameChapter > 0) reasons.push("same chapter");
  if (conceptScore > 0) reasons.push("shared concept tags");
  if (formulaScore > 0) reasons.push("shared formula tags");

  return {
    questionId: candidate.id,
    score: Math.round(score * 1000) / 1000,
    reasons,
  };
}

export function findDuplicateCandidates(
  questions: BankQuestion[],
  threshold = 0.86,
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];
  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      const similarity = questionSimilarity(questions[i], questions[j]);
      if (similarity.score >= threshold) {
        candidates.push({
          sourceQuestionId: questions[i].id,
          duplicateQuestionId: questions[j].id,
          similarityScore: similarity.score,
          reasons: similarity.reasons,
        });
      }
    }
  }
  return candidates;
}

export function prepareSimilarityGroups(questions: BankQuestion[]): SimilarityGroup[] {
  const groups = new Map<string, SimilarityGroup>();
  questions.forEach((question) => {
    const metadata = buildQuestionSimilarityMetadata(question);
    const fingerprint = question.similarityFingerprint || metadata.similarityFingerprint;
    const existing = groups.get(fingerprint);
    if (existing) {
      existing.questionIds.push(question.id);
      return;
    }
    groups.set(fingerprint, {
      fingerprint,
      questionIds: [question.id],
      normalizedQuestionText:
        question.normalizedQuestionText || metadata.normalizedQuestionText,
    });
  });
  return [...groups.values()].filter((group) => group.questionIds.length > 1);
}

export function prepareArchetypeClusters(questions: BankQuestion[]): ArchetypeCluster[] {
  const clusters = new Map<string, ArchetypeCluster>();
  questions.forEach((question) => {
    const metadata = buildQuestionSimilarityMetadata(question);
    const archetypeKey = question.archetypeKey || metadata.archetypeKey;
    const existing = clusters.get(archetypeKey);
    if (existing) {
      existing.questionIds.push(question.id);
      return;
    }
    clusters.set(archetypeKey, {
      archetypeKey,
      questionIds: [question.id],
      subject: question.subject,
      chapter: question.chapter,
      topic: question.topic,
    });
  });
  return [...clusters.values()].filter((cluster) => cluster.questionIds.length > 1);
}

export function aggregateByTopic(questions: BankQuestion[]): TopicAggregate[] {
  const map = new Map<string, BankQuestion[]>();
  questions.forEach((question) => {
    const key = [question.subject, question.chapter, question.topic].join("::");
    map.set(key, [...(map.get(key) ?? []), question]);
  });

  return [...map.entries()].map(([key, items]) => {
    const [subject, chapter, topic] = key.split("::");
    const difficultyCounts: Record<QuestionDifficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };
    items.forEach((item) => {
      difficultyCounts[item.difficultyLevel]++;
    });
    return {
      subject,
      chapter,
      topic,
      totalQuestions: items.length,
      averageWeightageScore:
        items.reduce((sum, item) => sum + item.weightageScore, 0) / items.length,
      averagePredictiveScore:
        items.reduce((sum, item) => sum + item.predictiveScore, 0) / items.length,
      difficultyCounts,
    };
  });
}

export function weightedQuestionSelection(
  questions: BankQuestion[],
  count: number,
  options: {
    pyqOnly?: boolean;
    sourceTypes?: BankQuestion["sourceType"][];
    difficulties?: QuestionDifficulty[];
  } = {},
): BankQuestion[] {
  return questions
    .filter((question) => {
      if (options.pyqOnly && question.sourceType !== "PYQ") return false;
      if (options.sourceTypes && !options.sourceTypes.includes(question.sourceType)) {
        return false;
      }
      if (
        options.difficulties &&
        !options.difficulties.includes(question.difficultyLevel)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const scoreA = a.weightageScore * 2 + a.predictiveScore + difficultyScore(a);
      const scoreB = b.weightageScore * 2 + b.predictiveScore + difficultyScore(b);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.id.localeCompare(b.id);
    })
    .slice(0, Math.max(0, count));
}
