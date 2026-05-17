import type { StudentRepository } from "@/repositories/interfaces/student-repository";
import { STORAGE_KEYS } from "@/repositories/storage-keys";
import type { StudentRecord } from "@/types/student";
import { readStorageJson, writeStorageJson, removeStorageKey } from "@/lib/storage/safe-json";
import { z } from "zod";
import type { InstituteStudent } from "@/types/institute-ops";
import {
  assertInstituteStudent,
  parseInstituteStudentList,
} from "@/lib/validation/institute-ops-schema";

const SESSION_KEY = "examgrid:session";

const sessionSchema = z.object({
  candidate: z.object({
    name: z.string().min(1),
    rollNumber: z.string().min(1),
    applicationNumber: z.string().min(1),
    instituteId: z.string().optional(),
  }),
});

export class LocalStudentRepository implements StudentRepository {
  getSession(): StudentRecord | null {
    const data = readStorageJson({
      storage: "session",
      key: SESSION_KEY,
      fallback: null as StudentRecord | null,
      validate: (raw) => {
        const result = sessionSchema.safeParse(raw);
        if (!result.success) {
          return {
            ok: false,
            error: result.error.issues.map((i) => i.message).join("; "),
          };
        }
        return { ok: true, value: result.data.candidate as StudentRecord };
      },
    });
    return data;
  }

  saveSession(student: StudentRecord): void {
    writeStorageJson("session", SESSION_KEY, { candidate: student });
  }

  clearSession(): void {
    removeStorageKey("session", SESSION_KEY);
  }

  list(): InstituteStudent[] {
    return readStorageJson({
      storage: "local",
      key: STORAGE_KEYS.students,
      fallback: [],
      validate: (raw) => {
        const result = parseInstituteStudentList(raw);
        if (!result.success) {
          return {
            ok: false,
            error: result.error.issues.map((i) => i.message).join("; "),
          };
        }
        return { ok: true, value: result.data };
      },
    });
  }

  getById(id: string): InstituteStudent | undefined {
    return this.list().find((student) => student.id === id);
  }

  getByRollNumber(rollNumber: string): InstituteStudent | undefined {
    const normalized = rollNumber.trim().toLowerCase();
    return this.list().find(
      (student) => student.rollNumber.trim().toLowerCase() === normalized,
    );
  }

  save(student: InstituteStudent): void {
    const valid = assertInstituteStudent(student);
    const all = this.list().filter((item) => item.id !== valid.id);
    all.push(valid);
    writeStorageJson("local", STORAGE_KEYS.students, all);
  }

  deactivate(id: string): void {
    const all = this.list().map((student) =>
      student.id === id
        ? { ...student, active: false, updatedAt: Date.now() }
        : student,
    );
    writeStorageJson("local", STORAGE_KEYS.students, all);
  }

  delete(id: string): void {
    writeStorageJson(
      "local",
      STORAGE_KEYS.students,
      this.list().filter((student) => student.id !== id),
    );
  }
}
