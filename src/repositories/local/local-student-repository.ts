import type { StudentRepository } from "@/repositories/interfaces/student-repository";
import type { StudentRecord } from "@/types/student";
import { readStorageJson, writeStorageJson, removeStorageKey } from "@/lib/storage/safe-json";
import { z } from "zod";

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
}
