import type { BankQuestion } from "@/types/question-bank";
import { buildQuestionSimilarityMetadata } from "@/lib/question-intelligence/utils";

export type LegacyBankQuestion = Omit<
  BankQuestion,
  | "examSource"
  | "subtopic"
  | "difficultyLevel"
  | "cognitiveLevel"
  | "estimatedSolveTimeSeconds"
  | "formulaTags"
  | "conceptTags"
  | "mistakeTags"
  | "sourceType"
  | "solutionDetailed"
  | "solutionShort"
  | "relatedQuestionIds"
  | "normalizedQuestionText"
  | "similarityFingerprint"
  | "similarityGroupKey"
  | "archetypeKey"
  | "weightageScore"
  | "predictiveScore"
> &
  Partial<
    Pick<
      BankQuestion,
      | "examSource"
      | "subtopic"
      | "difficultyLevel"
      | "cognitiveLevel"
      | "estimatedSolveTimeSeconds"
      | "formulaTags"
      | "conceptTags"
      | "mistakeTags"
      | "sourceType"
      | "solutionDetailed"
      | "solutionShort"
      | "relatedQuestionIds"
      | "normalizedQuestionText"
      | "similarityFingerprint"
      | "similarityGroupKey"
      | "archetypeKey"
      | "weightageScore"
      | "predictiveScore"
    >
  >;

export function withQuestionIntelligenceDefaults(
  question: LegacyBankQuestion,
): BankQuestion {
  const similarity = buildQuestionSimilarityMetadata({
    questionText: question.questionText,
    subject: question.subject,
    chapter: question.chapter,
    topic: question.topic,
    subtopic: question.subtopic ?? "",
    difficultyLevel: question.difficultyLevel ?? question.difficulty,
    conceptTags: question.conceptTags ?? [],
    formulaTags: question.formulaTags ?? [],
  });

  return {
    ...question,
    examSource: question.examSource ?? "Custom",
    subtopic: question.subtopic ?? "",
    difficultyLevel: question.difficultyLevel ?? question.difficulty,
    cognitiveLevel: question.cognitiveLevel ?? "apply",
    estimatedSolveTimeSeconds: question.estimatedSolveTimeSeconds ?? 120,
    formulaTags: question.formulaTags ?? [],
    conceptTags: question.conceptTags ?? [],
    mistakeTags: question.mistakeTags ?? [],
    sourceType: question.sourceType ?? "custom",
    solutionDetailed: question.solutionDetailed ?? question.solution,
    solutionShort: question.solutionShort ?? question.solution,
    relatedQuestionIds: question.relatedQuestionIds ?? [],
    normalizedQuestionText:
      question.normalizedQuestionText || similarity.normalizedQuestionText,
    similarityFingerprint:
      question.similarityFingerprint || similarity.similarityFingerprint,
    similarityGroupKey: question.similarityGroupKey || similarity.similarityGroupKey,
    archetypeKey: question.archetypeKey || similarity.archetypeKey,
    weightageScore: question.weightageScore ?? 1,
    predictiveScore: question.predictiveScore ?? 0,
  };
}
