import { getRepositories } from "@/lib/repositories/provider";
import type { ExamDefinition } from "@/types/exam";

/** @deprecated Use getRepositories().exams — kept for gradual migration. */
export interface ExamCatalogRepository {
  getAll(): ExamDefinition[];
  getById(id: string): ExamDefinition | undefined;
  save(exam: ExamDefinition): void;
  delete(id: string): void;
}

export const examCatalogRepository: ExamCatalogRepository = {
  getAll: () => getRepositories().exams.list(),
  getById: (id) => getRepositories().exams.getById(id),
  save: (exam) => getRepositories().exams.save(exam),
  delete: (id) => getRepositories().exams.delete(id),
};

export { LocalExamRepository } from "@/repositories/local/local-exam-repository";
