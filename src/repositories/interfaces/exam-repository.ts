import type { ExamDefinition } from "@/types/exam";

export interface ExamRepository {
  list(): ExamDefinition[];
  getById(id: string): ExamDefinition | undefined;
  save(exam: ExamDefinition): void;
  delete(id: string): void;
}
