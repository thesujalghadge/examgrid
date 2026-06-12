import type { QuestionType } from "@/types/exam";

export type QuestionDifficulty = "easy" | "medium" | "hard";

export type QuestionSubject =
  | "Physics"
  | "Chemistry"
  | "Mathematics"
  | "Biology"
  | string;

export interface BankOption {
  label: string;
  text: string;
  image?: string;
}

export interface BankQuestion {
  id: string;
  subject: QuestionSubject;
  chapter: string;
  topic: string;
  difficulty: QuestionDifficulty;
  questionType: QuestionType;
  questionText: string;
  stemImage?: string;
  options: BankOption[];
  /** MCQ: option label (A/B/C/D) or option id. Numerical: numeric string. */
  correctAnswer: string;
  solution: string;
  marks: number;
  negativeMarks: number;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: number;
  updatedAt: number;
}

export interface QuestionImportPayload {
  questions: Omit<BankQuestion, "id" | "createdAt" | "updatedAt">[];
}
