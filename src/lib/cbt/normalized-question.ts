import type { PreparedQuestionMeta } from "@/types/cbt-paper-processing";

export type NormalizedQuestionType = "MCQ_SINGLE" | "NUMERICAL";

/** Canonical shape every parsed question is normalized into before CBT build. */
export interface NormalizedParsedQuestion {
  id: string;
  type: NormalizedQuestionType;
  stem: string;
  options: string[];
  answer: string;
  subject: string;
  confidence: number;
}

export function toNormalizedQuestion(meta: PreparedQuestionMeta): NormalizedParsedQuestion {
  return {
    id: meta.questionId,
    type: meta.questionType,
    stem: meta.questionText,
    options: meta.questionType === "MCQ_SINGLE" ? [...meta.optionLabels] : [],
    answer: meta.correctAnswer,
    subject: meta.subject,
    confidence: meta.confidence,
  };
}

export function fromNormalizedQuestion(
  normalized: NormalizedParsedQuestion,
  extras: {
    sequence: number;
    section: string;
    marks?: number;
    negativeMarks?: number;
    detectionSource?: PreparedQuestionMeta["detectionSource"];
    hasEquation?: boolean;
    hasImage?: boolean;
    metadata?: PreparedQuestionMeta["metadata"];
  },
): PreparedQuestionMeta {
  return {
    questionId: normalized.id,
    sequence: extras.sequence,
    subject: normalized.subject,
    section: extras.section,
    chapter: undefined,
    topic: undefined,
    difficulty: undefined,
    confidence: normalized.confidence,
    questionType: normalized.type,
    detectionSource: extras.detectionSource,
    questionText: normalized.stem,
    hasEquation: extras.hasEquation,
    hasImage: extras.hasImage,
    correctAnswer: normalized.answer,
    solution: undefined,
    marks: extras.marks ?? 4,
    negativeMarks: extras.negativeMarks ?? 1,
    optionLabels: normalized.type === "MCQ_SINGLE" ? [...normalized.options] : [],
    images: [],
    explanation: undefined,
    metadata: extras.metadata ?? {
      parser: "deterministic_v3",
      sourceQuestionNumber: extras.sequence,
      answerKeySource: "missing",
    },
  };
}
