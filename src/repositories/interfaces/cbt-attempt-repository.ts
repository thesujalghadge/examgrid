import type { CbtFinalAttempt } from "@/types/cbt";

export interface CbtAttemptRepository {
  save(record: CbtFinalAttempt): void;
  listByTestId(testId: string): CbtFinalAttempt[];
  listByStudentId(studentId: string): CbtFinalAttempt[];
  getLatest(testId: string, studentId: string): CbtFinalAttempt | undefined;
}
