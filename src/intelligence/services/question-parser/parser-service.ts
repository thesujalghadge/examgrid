import { getExamProfile } from "@/intelligence/config/exam-profiles";
import { intelligenceId, nowIso } from "@/intelligence/lib/ids";
import { getIntelligenceRepository } from "@/intelligence/repositories/provider";
import { McqSegmenter } from "@/intelligence/services/question-parser/segmenters/mcq-segmenter";
import { NumericalSegmenter } from "@/intelligence/services/question-parser/segmenters/numerical-segmenter";
import type { SegmenterContext } from "@/intelligence/services/question-parser/segmenters/base-segmenter";
import { normalizeBlock } from "@/intelligence/services/question-parser/segmenters/base-segmenter";
import type { SegmentedQuestion } from "@/intelligence/types/pipeline";
import type { StructuredQuestionRecord } from "@/intelligence/repositories/interfaces/intelligence-repository";
import { normalizeAcademicText } from "@/intelligence/services/normalization/normalization-service";

const SEGMENTERS = [new McqSegmenter(), new NumericalSegmenter()];

/** Split raw PYQ text into candidate question blocks. */
export function splitRawTextIntoBlocks(rawText: string): string[] {
  const normalized = normalizeAcademicText(rawText.replace(/\r\n/g, "\n")).text;
  const questionBoundary =
    /(?=^\s*(?:Q\.?\s*\d+|Question\s+\d+|Problem\s+\d+|\d+[\).])\s)/gim;
  const blocks = normalized
    .split(questionBoundary)
    .map(normalizeBlock)
    .filter((b) => b.length > 40);
  if (blocks.length > 0) return blocks;
  const optionAnchored = normalized
    .split(/(?=\n\s*(?:\(?A\)?[\).:\-]|1[\).:\-])\s)/gi)
    .map(normalizeBlock)
    .filter((b) => b.length > 40);
  if (optionAnchored.length > 0) return optionAnchored;
  return normalized
    .split(/\n{2,}/)
    .map(normalizeBlock)
    .filter((b) => b.length > 40);
}

export function segmentBlock(
  block: string,
  ctx: SegmenterContext,
): SegmentedQuestion | null {
  for (const segmenter of SEGMENTERS) {
    if (segmenter.canHandle(block)) {
      const parsed = segmenter.parse(block, ctx);
      if (parsed) return parsed;
    }
  }
  return {
    questionText: block.slice(0, 2000),
    options: [],
    examProfileId: ctx.examProfileId,
    year: ctx.examYear,
    subject: ctx.subjectHint,
    questionFormat: "unknown",
    rawBlock: block,
    confidence: 0.3,
    parserConfidence: 0.3,
    extractionIssues: ["fallback-parser-used", "unknown-question-format"],
    formattingIssues: [],
    normalizedText: normalizeAcademicText(block).text,
    normalizationVersion: "norm-2026-05-18",
    malformed: true,
  };
}

export async function runSegmentationJob(
  extractionJobId: string,
): Promise<StructuredQuestionRecord[]> {
  const repo = getIntelligenceRepository();
  const job = repo.getExtractionJob(extractionJobId);
  if (!job?.rawText) {
    throw new Error(`Extraction job missing raw text: ${extractionJobId}`);
  }

  const source = repo.getSource(job.sourceId);
  const profile = getExamProfile(job.examProfileId);
  const ctx: SegmenterContext = {
    examProfileId: job.examProfileId,
    examYear: source?.examYear,
    subjectHint: source?.subjectHint,
    defaultSubject: profile?.subjects[0],
  };

  const blocks = splitRawTextIntoBlocks(job.rawText);
  const saved: StructuredQuestionRecord[] = [];
  const now = nowIso();

  blocks.forEach((block, index) => {
    const segment = segmentBlock(block, ctx);
    if (!segment) return;
    const record: StructuredQuestionRecord = {
      id: intelligenceId("sq"),
      extractionJobId,
      sourceId: job.sourceId,
      instituteId: job.instituteId,
      examProfileId: job.examProfileId,
      segment: { ...segment, questionNumber: index + 1 },
      reviewStatus: "pending",
      createdAt: now,
      updatedAt: now,
    };
    repo.saveStructuredQuestion(record);
    saved.push(record);
  });

  return saved;
}
