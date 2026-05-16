import type { ExamDefinition } from "@/types/exam";
import { STORAGE_KEYS } from "./storage-keys";

export interface ExamCatalogRepository {
  getAll(): ExamDefinition[];
  getById(id: string): ExamDefinition | undefined;
  save(exam: ExamDefinition): void;
  delete(id: string): void;
}

class LocalExamCatalogRepository implements ExamCatalogRepository {
  getAll(): ExamDefinition[] {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEYS.examCatalog);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ExamDefinition[];
    } catch {
      return [];
    }
  }

  save(exam: ExamDefinition): void {
    if (typeof window === "undefined") return;
    const all = this.getAll().filter((e) => e.id !== exam.id);
    all.push(exam);
    localStorage.setItem(STORAGE_KEYS.examCatalog, JSON.stringify(all));
  }

  getById(id: string): ExamDefinition | undefined {
    return this.getAll().find((e) => e.id === id);
  }

  delete(id: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      STORAGE_KEYS.examCatalog,
      JSON.stringify(this.getAll().filter((e) => e.id !== id)),
    );
  }
}

export const examCatalogRepository = new LocalExamCatalogRepository();
