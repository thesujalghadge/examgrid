import { intelligenceId, nowIso } from "@/intelligence/lib/ids";
import { getIntelligenceRepository } from "@/intelligence/repositories/provider";
import type { QualityScoreRecord } from "@/intelligence/repositories/interfaces/intelligence-repository";
import type { QualityScore, QualityScoreSignal } from "@/intelligence/types/pipeline";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function answerKeyMatch(questionAnswer?: string, solutionAnswer?: string): number {
  if (!questionAnswer || !solutionAnswer) return 0.5;
  return questionAnswer.trim().toLowerCase() === solutionAnswer.trim().toLowerCase()
    ? 1
    : 0;
}

export function computeQuestionQualityScore(
  structuredQuestionId: string,
): QualityScoreRecord | null {
  const repo = getIntelligenceRepository();
  const question = repo.getStructuredQuestion(structuredQuestionId);
  if (!question) return null;

  const solution = repo.listSolutions({ structuredQuestionId })[0];
  const verification = solution ? repo.getVerificationBySolution(solution.id) : undefined;
  const metadata = repo.getMetadataByQuestion(structuredQuestionId);

  const formattingPenalty =
    (question.segment.formattingIssues?.length ?? 0) * 0.12 +
    (question.segment.malformed ? 0.25 : 0);

  const signals: QualityScoreSignal = {
    extractionConfidence: clamp01(question.segment.confidence ?? 0.5),
    parserConfidence: clamp01(question.segment.parserConfidence ?? question.segment.confidence ?? 0.5),
    aiAgreementScore: clamp01(verification?.result.agreementScore ?? 0.5),
    answerKeyMatch: answerKeyMatch(
      question.segment.correctAnswer,
      solution?.structured.finalAnswer,
    ),
    metadataConfidence: clamp01(metadata?.confidence ?? metadata?.metadata.taxonomyConfidence ?? 0),
    formattingQuality: clamp01(1 - formattingPenalty),
  };

  const weighted =
    signals.extractionConfidence * 0.18 +
    signals.parserConfidence * 0.2 +
    signals.aiAgreementScore * 0.2 +
    signals.answerKeyMatch * 0.15 +
    signals.metadataConfidence * 0.17 +
    signals.formattingQuality * 0.1;

  const issues = [
    signals.extractionConfidence < 0.55 ? "low-extraction-confidence" : "",
    signals.parserConfidence < 0.55 ? "low-parser-confidence" : "",
    signals.aiAgreementScore < 0.6 ? "ai-disagreement" : "",
    signals.answerKeyMatch < 0.5 ? "answer-mismatch" : "",
    signals.metadataConfidence < 0.55 ? "low-metadata-confidence" : "",
    signals.formattingQuality < 0.7 ? "formatting-issues" : "",
    ...(question.segment.extractionIssues ?? []),
  ].filter(Boolean);

  const score: QualityScore = {
    overallQualityScore: Math.round(weighted * 100),
    signals,
    issues,
    requiresReview: weighted < 0.72 || issues.length > 0,
  };

  const existing = repo.getQualityScoreByQuestion(structuredQuestionId);
  const now = nowIso();
  const record: QualityScoreRecord = {
    id: existing?.id ?? intelligenceId("qual"),
    structuredQuestionId,
    score,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  repo.saveQualityScore(record);
  return record;
}

export function recomputeAllQualityScores(instituteId: string): QualityScoreRecord[] {
  const repo = getIntelligenceRepository();
  return repo
    .listStructuredQuestions({ instituteId })
    .flatMap((question) => {
      const score = computeQuestionQualityScore(question.id);
      return score ? [score] : [];
    });
}

