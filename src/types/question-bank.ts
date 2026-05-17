import type { QuestionType } from "@/types/exam";

export type QuestionDifficulty = "easy" | "medium" | "hard";

export type ExamSource =
  | "JEE Main"
  | "JEE Advanced"
  | "MHT CET"
  | "NEET"
  | "Custom"
  | string;

export type QuestionSourceType =
  | "PYQ"
  | "generated"
  | "institute"
  | "custom";

export type CognitiveLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create"
  | string;

export type QuestionSubject =
  | "Physics"
  | "Chemistry"
  | "Mathematics"
  | "Biology"
  | string;

export interface BankOption {
  label: string;
  text: string;
}

export interface BankQuestion {
  id: string;
  subject: QuestionSubject;
  examSource: ExamSource;
  examYear?: number;
  chapter: string;
  topic: string;
  subtopic: string;
  difficulty: QuestionDifficulty;
  difficultyLevel: QuestionDifficulty;
  cognitiveLevel: CognitiveLevel;
  estimatedSolveTimeSeconds: number;
  formulaTags: string[];
  conceptTags: string[];
  mistakeTags: string[];
  sourceType: QuestionSourceType;
  questionType: QuestionType;
  questionText: string;
  options: BankOption[];
  /** MCQ: option label (A/B/C/D) or option id. Numerical: numeric string. */
  correctAnswer: string;
  solution: string;
  solutionDetailed: string;
  solutionShort: string;
  relatedQuestionIds: string[];
  normalizedQuestionText: string;
  similarityFingerprint: string;
  similarityGroupKey: string;
  archetypeKey: string;
  weightageScore: number;
  predictiveScore: number;
  marks: number;
  negativeMarks: number;
  createdAt: number;
  updatedAt: number;
}

export interface QuestionImportPayload {
  questions: Array<
    Omit<
      BankQuestion,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "difficulty"
      | "solution"
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
          | "difficulty"
          | "solution"
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
      >
  >;
}
