import { readStorageJson, writeStorageJson } from "@/lib/storage/safe-json";
import { STORAGE_KEYS } from "@/repositories/storage-keys";
import type { CbtAttemptRepository } from "@/repositories/interfaces/cbt-attempt-repository";
import type { CbtFinalAttempt } from "@/types/cbt";
import { z } from "zod";

const recordSchema = z.object({
  attempt: z.object({
    id: z.string(),
    testId: z.string(),
    studentId: z.string(),
    instituteId: z.string(),
    startedAt: z.number(),
    submittedAt: z.number().optional(),
    score: z.number().optional(),
  }),
  responses: z.array(
    z.object({
      id: z.string(),
      attemptId: z.string(),
      questionId: z.string(),
      selectedOption: z.string().nullable(),
      isCorrect: z.boolean(),
    }),
  ),
});

function parseAll(raw: unknown): CbtFinalAttempt[] {
  const res = z.array(recordSchema).safeParse(raw);
  if (!res.success) return [];
  return res.data as CbtFinalAttempt[];
}

export class LocalCbtAttemptRepository implements CbtAttemptRepository {
  private readAll(): CbtFinalAttempt[] {
    return readStorageJson({
      storage: "local",
      key: STORAGE_KEYS.cbtFinalAttempts,
      fallback: [],
      validate: (data) => ({ ok: true, value: parseAll(data) }),
    });
  }

  private writeAll(rows: CbtFinalAttempt[]): void {
    writeStorageJson("local", STORAGE_KEYS.cbtFinalAttempts, rows);
  }

  save(record: CbtFinalAttempt): void {
    const parsed = recordSchema.safeParse(record);
    if (!parsed.success) return;
    const all = this.readAll().filter(
      (r) =>
        !(
          r.attempt.testId === parsed.data.attempt.testId &&
          r.attempt.studentId === parsed.data.attempt.studentId
        ),
    );
    all.push(parsed.data as CbtFinalAttempt);
    this.writeAll(all);
  }

  listByTestId(testId: string): CbtFinalAttempt[] {
    return this.readAll().filter((r) => r.attempt.testId === testId);
  }

  listByStudentId(studentId: string): CbtFinalAttempt[] {
    return this.readAll().filter((r) => r.attempt.studentId === studentId);
  }

  getLatest(testId: string, studentId: string): CbtFinalAttempt | undefined {
    const matches = this.readAll().filter(
      (r) => r.attempt.testId === testId && r.attempt.studentId === studentId,
    );
    if (matches.length === 0) return undefined;
    return matches.sort(
      (a, b) => (b.attempt.submittedAt ?? 0) - (a.attempt.submittedAt ?? 0),
    )[0];
  }
}
