import { readStorageJson, writeStorageJson } from "@/lib/storage/safe-json";
import { STORAGE_KEYS } from "@/repositories/storage-keys";
import type { CbtTestRepository } from "@/repositories/interfaces/cbt-test-repository";
import type { CBTTest } from "@/types/cbt";
import { z } from "zod";

const cbtTestSchema = z.object({
  id: z.string(),
  title: z.string(),
  instituteId: z.string(),
  examType: z.enum(["JEE_MAIN", "NEET", "CET"]).optional(),
  durationMinutes: z.number().int().positive(),
  totalMarks: z.number().nonnegative(),
  createdBy: z.string(),
  instructions: z.array(z.string()).optional(),
  sourceFileName: z.string().optional(),
  sourceFileType: z.enum(["pdf", "doc", "docx", "csv", "xlsx", "txt"]).optional(),
  sourceImportedAt: z.number().optional(),
  sections: z.array(
    z.object({
      id: z.string(),
      testId: z.string(),
      name: z.string(),
      order: z.number().int(),
    }),
  ),
  questions: z.array(
    z.object({
      id: z.string(),
      testId: z.string(),
      sectionId: z.string(),
      questionId: z.string(),
      source: z.enum(["bank", "manual"]),
      bankQuestionId: z.string().optional(),
      questionType: z.enum(["MCQ_SINGLE", "NUMERICAL"]),
      manual: z
        .object({
          text: z.string(),
          options: z.array(
            z.object({ label: z.string(), text: z.string() }),
          ),
          correctLabel: z.string(),
        })
        .optional(),
      marks: z.number().nonnegative(),
      negativeMarks: z.number().nonnegative(),
    }),
  ),
  batchIds: z.array(z.string()),
  createdAt: z.number(),
  updatedAt: z.number(),
});

function parseList(raw: unknown): CBTTest[] {
  const res = z.array(cbtTestSchema).safeParse(raw);
  if (!res.success) return [];
  return res.data as CBTTest[];
}

export class LocalCbtTestRepository implements CbtTestRepository {
  list(): CBTTest[] {
    return readStorageJson({
      storage: "local",
      key: STORAGE_KEYS.cbtTests,
      fallback: [],
      validate: (data) => {
        const rows = parseList(data);
        return { ok: true, value: rows };
      },
    });
  }

  getById(id: string): CBTTest | undefined {
    return this.list().find((t) => t.id === id);
  }

  save(test: CBTTest): void {
    const parsed = cbtTestSchema.safeParse(test);
    if (!parsed.success) return;
    const all = this.list().filter((t) => t.id !== parsed.data.id);
    all.push(parsed.data as CBTTest);
    writeStorageJson("local", STORAGE_KEYS.cbtTests, all);
  }

  delete(id: string): void {
    writeStorageJson(
      "local",
      STORAGE_KEYS.cbtTests,
      this.list().filter((t) => t.id !== id),
    );
  }
}
