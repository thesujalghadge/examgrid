import type { QuestionSegmenter, SegmenterContext } from "@/intelligence/services/question-parser/segmenters/base-segmenter";
import { normalizeBlock } from "@/intelligence/services/question-parser/segmenters/base-segmenter";
import type { SegmentedQuestion } from "@/intelligence/types/pipeline";

export class NumericalSegmenter implements QuestionSegmenter {
  readonly format = "numerical" as const;

  canHandle(block: string): boolean {
    const t = normalizeBlock(block).toLowerCase();
    return (
      /numerical|integer|nvt|value type/.test(t) ||
      /^\s*Q\.?\s*\d+.*\d/.test(t)
    );
  }

  parse(block: string, ctx: SegmenterContext): SegmentedQuestion | null {
    const text = normalizeBlock(block);
    if (!text) return null;

    let answer: string | undefined;
    const ansMatch = text.match(
      /(?:Ans(?:wer)?|Correct)\s*[:\-]\s*([+-]?\d+(?:\.\d+)?)/i,
    );
    if (ansMatch) answer = ansMatch[1];

    const withoutAnswer = text
      .replace(/(?:Ans(?:wer)?|Correct)\s*[:\-]\s*[+-]?\d+(?:\.\d+)?/i, "")
      .trim();
    const issues = withoutAnswer.length < 20 ? ["short-question-text"] : [];
    if (!answer) issues.push("missing-numerical-answer");

    return {
      questionText: withoutAnswer,
      options: [],
      correctAnswer: answer,
      subject: ctx.subjectHint ?? ctx.defaultSubject,
      year: ctx.examYear,
      examProfileId: ctx.examProfileId,
      questionFormat: "numerical",
      rawBlock: text,
      confidence: answer ? 0.72 : 0.42,
      parserConfidence: answer ? 0.72 : 0.42,
      extractionIssues: issues,
      formattingIssues: issues,
      normalizedText: text,
      normalizationVersion: "norm-2026-05-18",
      malformed: issues.length > 0,
    };
  }
}
