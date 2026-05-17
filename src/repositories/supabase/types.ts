import type { QuestionType } from "@/types/exam";

export interface QuestionRow {
  id: string;
  legacy_id: string | null;
  institute_id: string;
  subject: string;
  chapter: string;
  topic: string;
  difficulty: string;
  question_type: QuestionType;
  question_text: string;
  options: { label: string; text: string }[];
  correct_answer: string;
  solution: string;
  marks: number;
  negative_marks: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ExamRow {
  id: string;
  legacy_id: string | null;
  institute_id: string;
  title: string;
  subtitle: string;
  exam_type: "JEE_MAIN" | "NEET" | "CET";
  duration_minutes: number;
  total_questions: number;
  instructions: string[];
  scheduled_at: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExamSectionRow {
  id: string;
  exam_id: string;
  institute_id: string;
  name: string;
  sort_order: number;
}

export interface ExamQuestionRow {
  id: string;
  exam_id: string;
  section_id: string;
  institute_id: string;
  question_number: number;
  question_type: QuestionType;
  question_text: string;
  options: { id: string; label: string; text: string }[];
  correct_option_id: string | null;
  correct_numerical_answer: string | null;
  marks: number;
  negative_marks: number;
  bank_question_id: string | null;
  sort_order: number;
}
