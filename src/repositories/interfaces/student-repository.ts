import type { StudentRecord } from "@/types/student";

export interface StudentRepository {
  getSession(): StudentRecord | null;
  saveSession(student: StudentRecord): void;
  clearSession(): void;
}
