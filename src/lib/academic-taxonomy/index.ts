import { JEE_MAIN_TAXONOMY } from "@/lib/academic-taxonomy/jee-main";
import type {
  DifficultyMetadata,
  ExamPatternDefinition,
  SubjectTaxonomy,
  SupportedExamType,
} from "@/lib/academic-taxonomy/types";

export type {
  ChapterDefinition,
  DifficultyMetadata,
  ExamPatternDefinition,
  SubjectTaxonomy,
  SupportedExamType,
  TopicDefinition,
} from "@/lib/academic-taxonomy/types";

export const SUPPORTED_EXAM_TYPES: SupportedExamType[] = [
  "JEE_MAIN",
  "JEE_ADVANCED",
  "MHT_CET",
  "NEET",
];

export const DIFFICULTY_METADATA: Record<string, DifficultyMetadata> = {
  easy: {
    level: "easy",
    label: "Easy",
    score: 1,
    solveTimeMultiplier: 0.8,
  },
  medium: {
    level: "medium",
    label: "Medium",
    score: 2,
    solveTimeMultiplier: 1,
  },
  hard: {
    level: "hard",
    label: "Hard",
    score: 3,
    solveTimeMultiplier: 1.35,
  },
};

export const EXAM_PATTERNS: ExamPatternDefinition[] = [
  {
    examType: "JEE_MAIN",
    label: "JEE Main",
    durationMinutes: 180,
    subjects: [
      { subject: "Physics", questionCount: 25, marksPerQuestion: 4, negativeMarks: 1 },
      { subject: "Chemistry", questionCount: 25, marksPerQuestion: 4, negativeMarks: 1 },
      { subject: "Mathematics", questionCount: 25, marksPerQuestion: 4, negativeMarks: 1 },
    ],
  },
];

export const ACADEMIC_TAXONOMY: SubjectTaxonomy[] = [...JEE_MAIN_TAXONOMY];

export function getSubjectTaxonomy(
  examType: SupportedExamType,
  subject: string,
): SubjectTaxonomy | undefined {
  return ACADEMIC_TAXONOMY.find(
    (entry) => entry.examType === examType && entry.subject === subject,
  );
}

export function getExamPattern(
  examType: SupportedExamType,
): ExamPatternDefinition | undefined {
  return EXAM_PATTERNS.find((pattern) => pattern.examType === examType);
}

export {
  isKnownTaxonomyPath,
  suggestTaxonomyTags,
  type TaggingSuggestions,
  type TaxonomySuggestion,
} from "@/lib/academic-taxonomy/assistance";
