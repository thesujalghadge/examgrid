import { DEFAULT_INSTITUTE_ID, isUuid } from "@/config/institute";
import type { BankQuestion } from "@/types/question-bank";
import type { QuestionRow } from "@/repositories/supabase/types";
import { assertBankQuestionForWrite } from "@/lib/validation/bank-question-stored-schema";

const METADATA_KEYS = [
  "examSource",
  "examYear",
  "subtopic",
  "difficultyLevel",
  "cognitiveLevel",
  "estimatedSolveTimeSeconds",
  "formulaTags",
  "conceptTags",
  "mistakeTags",
  "sourceType",
  "solutionDetailed",
  "solutionShort",
  "relatedQuestionIds",
  "normalizedQuestionText",
  "similarityFingerprint",
  "similarityGroupKey",
  "archetypeKey",
  "weightageScore",
  "predictiveScore",
] as const satisfies readonly (keyof BankQuestion)[];

function intelligenceMetadata(question: BankQuestion): Record<string, unknown> {
  return Object.fromEntries(METADATA_KEYS.map((key) => [key, question[key]]));
}

export function bankQuestionToRow(
  question: BankQuestion,
  resolvedId: string,
  legacyId: string | null,
): Omit<QuestionRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
} {
  const now = new Date().toISOString();
  return {
    id: resolvedId,
    legacy_id: legacyId,
    institute_id: DEFAULT_INSTITUTE_ID,
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
    metadata: intelligenceMetadata(question),
    created_at: new Date(question.createdAt).toISOString(),
    updated_at: new Date(question.updatedAt).toISOString() || now,
  };
}

export function rowToBankQuestion(row: QuestionRow): BankQuestion {
  const publicId = row.legacy_id ?? row.id;
  const metadata = row.metadata ?? {};
  return assertBankQuestionForWrite({
    id: publicId,
    subject: row.subject,
    ...metadata,
    chapter: row.chapter,
    topic: row.topic,
    difficulty: row.difficulty as BankQuestion["difficulty"],
    questionType: row.question_type,
    questionText: row.question_text,
    options: Array.isArray(row.options) ? row.options : [],
    correctAnswer: row.correct_answer,
    solution: row.solution ?? "",
    marks: Number(row.marks),
    negativeMarks: Number(row.negative_marks),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }, "rowToBankQuestion");
}

export function validateBankQuestionForWrite(
  question: BankQuestion,
  operation = "write",
): BankQuestion {
  return assertBankQuestionForWrite(question, operation);
}

export function resolveQuestionIds(question: BankQuestion): {
  id: string;
  legacyId: string | null;
} {
  if (isUuid(question.id)) {
    return { id: question.id, legacyId: null };
  }
  return { id: crypto.randomUUID(), legacyId: question.id };
}
