import type { StudentRecord } from "@/types/student";
import type { InstituteStudent } from "@/types/institute-ops";

export interface StudentRepository {
  getSession(): StudentRecord | null;
  saveSession(student: StudentRecord): void;
  clearSession(): void;
  list(): InstituteStudent[];
  getById(id: string): InstituteStudent | undefined;
  getByRollNumber(rollNumber: string): InstituteStudent | undefined;
  save(student: InstituteStudent): void;
  deactivate(id: string): void;
  delete(id: string): void;
}
