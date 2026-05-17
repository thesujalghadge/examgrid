import type { AttemptRepository } from "@/repositories/interfaces/attempt-repository";
import type { PersistedExamAttempt } from "@/types/exam";
import { readStorageJson, writeStorageJson, removeStorageKey } from "@/lib/storage/safe-json";
import { parsePersistedExamAttempt } from "@/lib/validation/attempt-schema";

const ATTEMPT_PREFIX = "examgrid:attempt:";

export function getAttemptStorageKey(
  examId: string,
  candidateRoll: string,
): string {
  return `${ATTEMPT_PREFIX}${examId}:${candidateRoll}`;
}

export class LocalAttemptRepository implements AttemptRepository {
  load(examId: string, candidateRoll: string): PersistedExamAttempt | null {
    const key = getAttemptStorageKey(examId, candidateRoll);
    const attempt = readStorageJson({
      storage: "local",
      key,
      fallback: null as PersistedExamAttempt | null,
      validate: (data) => {
        const result = parsePersistedExamAttempt(data);
        if (!result.success) return { ok: false, error: result.error };
        return { ok: true, value: result.data };
      },
    });
    return attempt;
  }

  save(attempt: PersistedExamAttempt): void {
    const parsed = parsePersistedExamAttempt(attempt);
    if (!parsed.success) return;
    const key = getAttemptStorageKey(
      parsed.data.examId,
      parsed.data.candidateRoll,
    );
    writeStorageJson("local", key, parsed.data);
  }

  clear(examId: string, candidateRoll: string): void {
    removeStorageKey("local", getAttemptStorageKey(examId, candidateRoll));
  }
}
