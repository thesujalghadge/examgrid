import type { ExamDefinition, QuestionType } from "@/types/exam";

/** Institute-authored CBT test (tenant-scoped). */
export interface CBTTest {
  id: string;
  title: string;
  instituteId: string;
  examType?: ExamDefinition["examType"];
  durationMinutes: number;
  totalMarks: number;
  createdBy: string;
  instructions?: string[];
  sourceFileName?: string;
  sourceFileType?: "pdf" | "doc" | "docx" | "csv" | "xlsx" | "txt";
  sourceImportedAt?: number;
  sections: CBTTestSection[];
  questions: CBTTestQuestion[];
  /** Target batches (used with schedules). */
  batchIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CBTTestSection {
  id: string;
  testId: string;
  name: string;
  order: number;
}

export type CBTQuestionSource = "bank" | "manual";

export interface CBTManualMcq {
  text: string;
  options: { label: string; text: string }[];
  correctLabel: string;
}

export interface CBTTestQuestion {
  id: string;
  testId: string;
  sectionId: string;
  /** Stable id used in ExamDefinition.questions / attempt answers. */
  questionId: string;
  source: CBTQuestionSource;
  bankQuestionId?: string;
  questionType: QuestionType;
  manual?: CBTManualMcq;
  marks: number;
  negativeMarks: number;
}

export interface StudentAttempt {
  id: string;
  testId: string;
  studentId: string;
  instituteId: string;
  startedAt: number;
  submittedAt?: number;
  score?: number;
}

export interface StudentResponse {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOption: string | null;
  isCorrect: boolean;
}

export interface CbtFinalAttempt {
  attempt: StudentAttempt;
  responses: StudentResponse[];
}
