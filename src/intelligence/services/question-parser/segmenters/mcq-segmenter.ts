import type { QuestionSegmenter, SegmenterContext } from "@/intelligence/services/question-parser/segmenters/base-segmenter";
import { normalizeBlock } from "@/intelligence/services/question-parser/segmenters/base-segmenter";
import type { SegmentedQuestion } from "@/intelligence/types/pipeline";

const OPTION_RE = /^\s*(?:\(?([A-Da-d])\)?|([1-4]))[\).:\-]\s*(.+)$/;

export class McqSegmenter implements QuestionSegmenter {
  readonly format = "mcq_single" as const;

  canHandle(block: string): boolean {
    const lines = normalizeBlock(block).split("\n");
    const optionLines = lines.filter((l) => OPTION_RE.test(l));
    return optionLines.length >= 2;
  }

  parse(block: string, ctx: SegmenterContext): SegmentedQuestion | null {
    const text = normalizeBlock(block);
    if (!this.canHandle(text)) return null;

    const lines = text.split("\n");
    const options: Array<{ label: string; text: string }> = [];
    const questionLines: string[] = [];
    let answer: string | undefined;

    for (const line of lines) {
      const opt = line.match(OPTION_RE);
      if (opt) {
        options.push({
          label: (opt[1] ?? String.fromCharCode(64 + Number(opt[2]))).toUpperCase(),
          text: opt[3].trim(),
        });
        continue;
      }
      const ans = line.match(/^\s*(?:Ans(?:wer)?|Correct)\s*[:\-]\s*([A-Da-d])/i);
      if (ans) {
        answer = ans[1].toUpperCase();
        continue;
      }
      questionLines.push(line);
    }

    const questionText = questionLines.join("\n").trim();
    if (!questionText) return null;
    const labels = new Set(options.map((option) => option.label));
    const issues: string[] = [];
    if (options.length < 4) issues.push("mcq-options-less-than-four");
    if (labels.size !== options.length) issues.push("duplicate-option-labels");
    if (answer && !labels.has(answer)) issues.push("answer-option-not-found");
    const malformed = issues.length > 0;

    return {
      questionText,
      options,
      correctAnswer: answer,
      subject: ctx.subjectHint ?? ctx.defaultSubject,
      year: ctx.examYear,
      examProfileId: ctx.examProfileId,
      questionFormat: "mcq_single",
      rawBlock: text,
      confidence: malformed ? 0.48 : options.length >= 4 ? 0.82 : 0.58,
      parserConfidence: malformed ? 0.48 : options.length >= 4 ? 0.82 : 0.58,
      extractionIssues: issues,
      formattingIssues: issues,
      normalizedText: text,
      normalizationVersion: "norm-2026-05-18",
      malformed,
    };
  }
}
