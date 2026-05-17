import type { StudentRepository } from "@/repositories/interfaces/student-repository";
import {
  getSupabaseOrWarn,
  logSupabaseNotImplemented,
} from "@/repositories/supabase/supabase-base";
import type { StudentRecord } from "@/types/student";

/** Supabase-backed student session — scaffold for Phase 4B. */
export class SupabaseStudentRepository implements StudentRepository {
  private readonly table = "students";

  getSession(): StudentRecord | null {
    getSupabaseOrWarn(`StudentRepository.getSession (${this.table})`);
    logSupabaseNotImplemented("StudentRepository.getSession");
    return null;
  }

  saveSession(_student: StudentRecord): void {
    getSupabaseOrWarn(`StudentRepository.saveSession (${this.table})`);
    logSupabaseNotImplemented("StudentRepository.saveSession");
  }

  clearSession(): void {
    getSupabaseOrWarn(`StudentRepository.clearSession (${this.table})`);
    logSupabaseNotImplemented("StudentRepository.clearSession");
  }
}
