import type { PersistedExamAttempt } from "@/types/exam";

export interface AttemptRepository {
  load(examId: string, candidateRoll: string): PersistedExamAttempt | null;
  save(attempt: PersistedExamAttempt): void;
  clear(examId: string, candidateRoll: string): void;
}
