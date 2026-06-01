import { isUuid } from "@/config/institute";
import type {
  ExamDefinition,
  ExamQuestion,
  ExamSection,
} from "@/types/exam";
import type {
  ExamQuestionRow,
  ExamRow,
  ExamSectionRow,
} from "@/repositories/supabase/types";
import { parseExamDefinition } from "@/lib/validation/exam-schema";

export function examDefinitionToRows(exam: ExamDefinition, examUuid: string, instituteId: string): {
  examRow: Omit<ExamRow, "created_at" | "updated_at">;
  sections: Omit<ExamSectionRow, "created_at" | "updated_at">[];
  questions: Omit<ExamQuestionRow, "created_at" | "updated_at">[];
  legacyId: string | null;
} {
  const legacyId = isUuid(exam.id) ? null : exam.id;
  const examRow = {
    id: examUuid,
    legacy_id: legacyId,
    institute_id: instituteId,
    title: exam.title,
    subtitle: exam.subtitle,
    exam_type: exam.examType,
    duration_minutes: exam.durationMinutes,
    total_questions: exam.totalQuestions,
    instructions: exam.instructions,
    scheduled_at: exam.scheduledAt,
    is_published: true,
  };

  const sections: Omit<ExamSectionRow, "created_at" | "updated_at">[] =
    exam.sections.map((sec, idx) => ({
      id: sec.id,
      exam_id: examUuid,
      institute_id: instituteId,
      name: sec.name,
      sort_order: idx,
    }));

  const questions: Omit<ExamQuestionRow, "created_at" | "updated_at">[] = [];
  for (const sec of exam.sections) {
    sec.questionIds.forEach((qid, idx) => {
      const q = exam.questions[qid];
      if (!q) return;
      questions.push(examQuestionToRow(q, examUuid, sec.id, idx, instituteId));
    });
  }

  return { examRow, sections, questions, legacyId };
}

function examQuestionToRow(
  q: ExamQuestion,
  examUuid: string,
  sectionId: string,
  sortOrder: number,
  instituteId: string,
): Omit<ExamQuestionRow, "created_at" | "updated_at"> {
  return {
    id: q.id,
    exam_id: examUuid,
    section_id: sectionId,
    institute_id: instituteId,
    question_number: q.number,
    question_type: q.type,
    question_text: q.text,
    options: q.options,
    correct_option_id: q.correctOptionId ?? null,
    correct_numerical_answer: q.correctNumericalAnswer ?? null,
    marks: q.marks,
    negative_marks: q.negativeMarks,
    bank_question_id: extractBankQuestionUuid(q.id),
    sort_order: sortOrder,
  };
}

function extractBankQuestionUuid(examQuestionId: string): string | null {
  const parts = examQuestionId.split("-");
  const last = parts[parts.length - 1];
  return isUuid(last) ? last : null;
}

export function rowsToExamDefinition(
  examRow: ExamRow,
  sectionRows: ExamSectionRow[],
  questionRows: ExamQuestionRow[],
): ExamDefinition {
  const publicExamId = examRow.legacy_id ?? examRow.id;
  const sections: ExamSection[] = [...sectionRows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({
      id: s.id,
      name: s.name,
      questionIds: questionRows
        .filter((q) => q.section_id === s.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((q) => q.id),
    }));

  const questions: Record<string, ExamQuestion> = {};
  for (const row of questionRows) {
    questions[row.id] = rowToExamQuestion(row);
  }

  return {
    id: publicExamId,
    title: examRow.title,
    subtitle: examRow.subtitle,
    examType: examRow.exam_type,
    durationMinutes: examRow.duration_minutes,
    totalQuestions: examRow.total_questions,
    sections,
    questions,
    instructions: Array.isArray(examRow.instructions) ? examRow.instructions : [],
    scheduledAt: examRow.scheduled_at,
  };
}

function rowToExamQuestion(row: ExamQuestionRow): ExamQuestion {
  return {
    id: row.id,
    sectionId: row.section_id,
    number: row.question_number,
    type: row.question_type,
    text: row.question_text,
    options: Array.isArray(row.options) ? row.options : [],
    correctOptionId: row.correct_option_id ?? undefined,
    correctNumericalAnswer: row.correct_numerical_answer ?? undefined,
    marks: Number(row.marks),
    negativeMarks: Number(row.negative_marks),
  };
}

export function validateExamForWrite(exam: ExamDefinition): ExamDefinition | null {
  const parsed = parseExamDefinition(exam);
  if (!parsed.success) return null;
  return parsed.data as ExamDefinition;
}

export function resolveExamUuid(publicId: string): {
  examUuid: string;
  legacyId: string | null;
} {
  if (isUuid(publicId)) {
    return { examUuid: publicId, legacyId: null };
  }
  return { examUuid: crypto.randomUUID(), legacyId: publicId };
}
