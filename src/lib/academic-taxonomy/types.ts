import type { QuestionDifficulty } from "@/types/question-bank";

export type SupportedExamType =
  | "JEE_MAIN"
  | "JEE_ADVANCED"
  | "MHT_CET"
  | "NEET";

export interface TopicDefinition {
  name: string;
  subtopics: string[];
  expectedDifficulty: QuestionDifficulty;
  recommendedSolveTimeSeconds: number;
}

export interface ChapterDefinition {
  name: string;
  topics: TopicDefinition[];
}

export interface SubjectTaxonomy {
  examType: SupportedExamType;
  subject: string;
  chapters: ChapterDefinition[];
}

export interface ExamPatternSubject {
  subject: string;
  questionCount: number;
  marksPerQuestion: number;
  negativeMarks: number;
}

export interface ExamPatternDefinition {
  examType: SupportedExamType;
  label: string;
  durationMinutes: number;
  subjects: ExamPatternSubject[];
}

export interface DifficultyMetadata {
  level: QuestionDifficulty;
  label: string;
  score: number;
  solveTimeMultiplier: number;
}
