import type { TestSession } from "@/types/test-session";

export interface TestSessionRepository {
  list(): TestSession[];
  getById(id: string): TestSession | undefined;
  getActive(testId: string, studentId: string): TestSession | undefined;
  save(session: TestSession): void;
  delete(id: string): void;
}
