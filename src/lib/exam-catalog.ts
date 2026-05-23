import { cbtTestToExamDefinition } from "@/lib/cbt/cbt-to-exam";
import { getRepositoryMode, getRepositories } from "@/lib/repositories/provider";
import { logRepositoryFailure, logValidationFailure } from "@/lib/logging/runtime-logger";
import { rowsToExamDefinition } from "@/repositories/supabase/mappers/exam-mapper";
import { requireSupabaseClient, throwIfSupabaseError } from "@/repositories/supabase/supabase-repo-utils";
import type { ExamQuestionRow, ExamRow, ExamSectionRow } from "@/repositories/supabase/types";
import type { ExamDefinition } from "@/types/exam";
import { validateExamStructure } from "@/lib/validation/exam-integrity";

function filterValidExams(exams: ExamDefinition[]): ExamDefinition[] {
  return exams.filter((exam) => {
    const check = validateExamStructure(exam);
    if (!check.valid) {
      logValidationFailure(`exam:${exam.id}`, check.errors.join("; "));
      return false;
    }
  return true;
  });
}

export function getExamById(examId: string): ExamDefinition | undefined {
  const persisted = getRepositories().exams.getById(examId);
  if (persisted) {
    const validPersisted = filterValidExams([persisted]);
    if (validPersisted[0]) return validPersisted[0];
  }

  if (typeof window === "undefined") return undefined;

  const cbt = getRepositories().cbtTests.getById(examId);
  if (!cbt) return undefined;
  const definition = cbtTestToExamDefinition(cbt);
  if (!definition) return undefined;
  const valid = filterValidExams([definition]);
  return valid[0];
}

export async function getExamByIdServer(examId: string): Promise<ExamDefinition | undefined> {
  const fromRepo = getRepositories().exams.getById(examId);
  if (fromRepo) {
    const valid = filterValidExams([fromRepo]);
    if (valid[0]) return valid[0];
  }

  if (getRepositoryMode() !== "supabase") return undefined;

  try {
    const client = requireSupabaseClient("exam-catalog.getExamByIdServer");
    const query = client
      .from("exams")
      .select("*")
      .or(`legacy_id.eq.${examId},id.eq.${examId}`)
      .maybeSingle();
    const { data: examRow, error: examError } = await query;
    throwIfSupabaseError(examError, "exams", "getByIdServer");
    if (!examRow) return undefined;

    const typedExamRow = examRow as ExamRow;
    const examUuid = typedExamRow.id;

    const { data: sections, error: secError } = await client
      .from("exam_sections")
      .select("*")
      .eq("exam_id", examUuid)
      .order("sort_order", { ascending: true });
    throwIfSupabaseError(secError, "exam_sections", "getByIdServer");

    const { data: questions, error: questionError } = await client
      .from("exam_questions")
      .select("*")
      .eq("exam_id", examUuid)
      .order("sort_order", { ascending: true });
    throwIfSupabaseError(questionError, "exam_questions", "getByIdServer");

    const definition = rowsToExamDefinition(
      typedExamRow,
      (sections ?? []) as ExamSectionRow[],
      (questions ?? []) as ExamQuestionRow[],
    );
    const valid = filterValidExams([definition]);
    return valid[0];
  } catch (error) {
    logRepositoryFailure("exam-catalog.getExamByIdServer", error);
    return undefined;
  }
}
