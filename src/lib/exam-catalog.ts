import { JEE_MAIN_MOCK } from "@/data/mock-exams";
import { examCatalogRepository } from "@/repositories/exam-catalog-repository";
import type { ExamDefinition } from "@/types/exam";

/** Built-in demos + institute-created exams from local catalog. */
export function listAllExams(): ExamDefinition[] {
  const builtin = [JEE_MAIN_MOCK];
  if (typeof window === "undefined") return builtin;

  const custom = examCatalogRepository.getAll();
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
    const custom = examCatalogRepository.getById(examId);
    if (custom) return custom;
  }
  return undefined;
}

export function isBuiltinExam(examId: string): boolean {
  return examId === JEE_MAIN_MOCK.id;
}
