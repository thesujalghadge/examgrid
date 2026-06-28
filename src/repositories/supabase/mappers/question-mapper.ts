import { isUuid } from "@/config/institute";
import type { BankQuestion } from "@/types/question-bank";
import type { QuestionRow } from "@/repositories/supabase/types";
import { assertBankQuestionForWrite } from "@/lib/validation/bank-question-stored-schema";

export function bankQuestionToRow(
  question: BankQuestion,
  resolvedId: string,
  instituteId: string,
): Omit<QuestionRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
} {
  const now = new Date().toISOString();
  return {
    id: resolvedId,
    institute_id: instituteId,
    subject: question.subject,
    chapter: question.chapter,
    topic: question.topic,
    difficulty: question.difficulty,
    question_type: question.questionType,
    question_text: question.questionText,
    options: question.options,
    correct_answer: question.correctAnswer,
    solution: question.solution,
    marks: question.marks,
    negative_marks: question.negativeMarks,
    metadata: {
      ...(question.metadata || {}),
      stemImage: question.stemImage,
    },
    created_at: new Date(question.createdAt).toISOString(),
    updated_at: new Date(question.updatedAt).toISOString() || now,
  };
}

export function rowToBankQuestion(row: QuestionRow): BankQuestion {
  const metadata = (row.metadata as Record<string, any>) || {};
  return {
    id: row.id,
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic,
    difficulty: row.difficulty as BankQuestion["difficulty"],
    questionType: row.question_type,
    questionText: row.question_text,
    stemImage: metadata.stemImage,
    options: Array.isArray(row.options) ? row.options : [],
    correctAnswer: row.correct_answer,
    solution: row.solution ?? "",
    marks: Number(row.marks),
    negativeMarks: Number(row.negative_marks),
    metadata: metadata,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export function validateBankQuestionForWrite(
  question: BankQuestion,
  operation = "write",
): BankQuestion {
  return assertBankQuestionForWrite(question, operation);
}


