import type {
  QuestionFormat,
  SegmentedQuestion,
} from "@/intelligence/types/pipeline";
import { normalizeAcademicText } from "@/intelligence/services/normalization/normalization-service";

export interface SegmenterContext {
  examProfileId: string;
  examYear?: number;
  subjectHint?: string;
  defaultSubject?: string;
}

export interface QuestionSegmenter {
  readonly format: QuestionFormat;
  canHandle(block: string): boolean;
  parse(block: string, ctx: SegmenterContext): SegmentedQuestion | null;
}

export function normalizeBlock(block: string): string {
  return normalizeAcademicText(block.replace(/\r\n/g, "\n")).text;
}
