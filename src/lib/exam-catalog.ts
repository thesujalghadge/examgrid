import { JEE_MAIN_MOCK } from "@/data/mock-exams";
import { examCatalogRepository } from "@/repositories/exam-catalog-repository";
import { cbtTestToExamDefinition } from "@/lib/cbt/cbt-to-exam";
import { getRepositories } from "@/lib/repositories/provider";
import type { ExamDefinition } from "@/types/exam";
import { validateExamStructure } from "@/lib/validation/exam-integrity";
import { logValidationFailure } from "@/lib/logging/runtime-logger";

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

/** Built-in demos + institute-created exams from local catalog. */
export function listAllExams(): ExamDefinition[] {
  const builtin = [JEE_MAIN_MOCK];
  if (typeof window === "undefined") return builtin;

  const custom = filterValidExams(examCatalogRepository.getAll());
  const builtinIds = new Set(builtin.map((e) => e.id));
  const merged = [
    ...builtin,
    ...custom.filter((e) => !builtinIds.has(e.id)),
  ];
  return merged.sort(
    (a, b) =>
      new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
  );
}

export function getExamById(examId: string): ExamDefinition | undefined {
  if (examId === JEE_MAIN_MOCK.id) return JEE_MAIN_MOCK;
  if (typeof window !== "undefined") {
    const cbt = getRepositories().cbtTests.getById(examId);
    if (cbt) {
      const def = cbtTestToExamDefinition(cbt);
      if (!def) return undefined;
      const check = validateExamStructure(def);
      if (!check.valid) {
        logValidationFailure(`cbt:${examId}`, check.errors.join("; "));
        return undefined;
      }
      return def;
    }
    const custom = examCatalogRepository.getById(examId);
    if (custom) {
      const check = validateExamStructure(custom);
      if (!check.valid) {
        logValidationFailure(`exam:${examId}`, check.errors.join("; "));
        return undefined;
      }
      return custom;
    }
  }
  return undefined;
}

export function isBuiltinExam(examId: string): boolean {
  return examId === JEE_MAIN_MOCK.id;
}
