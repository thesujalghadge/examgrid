import type { ExamRepository } from "@/repositories/interfaces/exam-repository";
import { STORAGE_KEYS } from "@/repositories/storage-keys";
import type { ExamDefinition } from "@/types/exam";
import { readStorageJson, writeStorageJson } from "@/lib/storage/safe-json";
import { parseExamDefinition } from "@/lib/validation/exam-schema";

function parseExamList(data: unknown): { ok: true; value: ExamDefinition[] } | { ok: false; error: string } {
  if (!Array.isArray(data)) {
    return { ok: false, error: "Exam catalog must be an array" };
  }
  const valid: ExamDefinition[] = [];
  for (const item of data) {
    const parsed = parseExamDefinition(item);
    if (parsed.success) valid.push(parsed.data as ExamDefinition);
  }
  if (valid.length === 0 && data.length > 0) {
    return { ok: false, error: "No valid exams in catalog" };
  }
  return { ok: true, value: valid };
}

export class LocalExamRepository implements ExamRepository {
  list(): ExamDefinition[] {
    return readStorageJson({
      storage: "local",
      key: STORAGE_KEYS.examCatalog,
      fallback: [],
      validate: parseExamList,
    });
  }

  save(exam: ExamDefinition): void {
    const parsed = parseExamDefinition(exam);
    if (!parsed.success) return;
    const all = this.list().filter((e) => e.id !== exam.id);
    all.push(parsed.data as ExamDefinition);
    writeStorageJson("local", STORAGE_KEYS.examCatalog, all);
  }

  getById(id: string): ExamDefinition | undefined {
    return this.list().find((e) => e.id === id);
  }

  delete(id: string): void {
    writeStorageJson(
      "local",
      STORAGE_KEYS.examCatalog,
      this.list().filter((e) => e.id !== id),
    );
  }
}
