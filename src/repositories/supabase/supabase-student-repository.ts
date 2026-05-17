import type { StudentRepository } from "@/repositories/interfaces/student-repository";
import { DEFAULT_INSTITUTE_ID } from "@/config/institute";
import { logRepositoryFailure } from "@/lib/logging/runtime-logger";
import { assertInstituteStudent } from "@/lib/validation/institute-ops-schema";
import {
  rowToStudent,
  studentToRow,
} from "@/repositories/supabase/mappers/institute-ops-mapper";
import {
  requireSupabaseClient,
  throwIfSupabaseError,
} from "@/repositories/supabase/supabase-repo-utils";
import type { StudentRow } from "@/repositories/supabase/types";
import { LocalStudentRepository } from "@/repositories/local/local-student-repository";
import type { StudentRecord } from "@/types/student";
import type { InstituteStudent } from "@/types/institute-ops";

/** Supabase student roster with local session persistence for CBT attempts. */
export class SupabaseStudentRepository implements StudentRepository {
  private cache: InstituteStudent[] = [];
  private hydrated = false;
  private refreshPromise: Promise<void> | null = null;
  private persistChain: Promise<void> = Promise.resolve();
  private readonly session = new LocalStudentRepository();

  get isHydrated(): boolean {
    return this.hydrated;
  }

  getSession(): StudentRecord | null {
    return this.session.getSession();
  }

  saveSession(student: StudentRecord): void {
    this.session.saveSession(student);
  }

  clearSession(): void {
    this.session.clearSession();
  }

  list(): InstituteStudent[] {
    return [...this.cache];
  }

  getById(id: string): InstituteStudent | undefined {
    return this.cache.find((student) => student.id === id);
  }

  getByRollNumber(rollNumber: string): InstituteStudent | undefined {
    const normalized = rollNumber.trim().toLowerCase();
    return this.cache.find(
      (student) => student.rollNumber.trim().toLowerCase() === normalized,
    );
  }

  save(student: InstituteStudent): void {
    const valid = assertInstituteStudent(student);
    const idx = this.cache.findIndex((item) => item.id === valid.id);
    if (idx >= 0) this.cache[idx] = valid;
    else this.cache.push(valid);
    this.enqueuePersist(() => this.persistOne(valid));
  }

  deactivate(id: string): void {
    const existing = this.getById(id);
    if (!existing) return;
    this.save({ ...existing, active: false, updatedAt: Date.now() });
  }

  delete(id: string): void {
    this.cache = this.cache.filter((student) => student.id !== id);
    this.enqueuePersist(() => this.removeOne(id));
  }

  async whenIdle(): Promise<void> {
    await this.persistChain;
  }

  async refreshFromRemote(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.doRefresh();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private enqueuePersist(task: () => Promise<void>): void {
    this.persistChain = this.persistChain.then(task).catch((error) => {
      logRepositoryFailure("SupabaseStudentRepository.persistChain", error);
    });
  }

  private async doRefresh(): Promise<void> {
    try {
      const client = requireSupabaseClient("students.list");
      const { data, error } = await client
        .from("students")
        .select("*")
        .eq("institute_id", DEFAULT_INSTITUTE_ID)
        .order("full_name", { ascending: true });
      throwIfSupabaseError(error, "students", "list");
      this.cache = ((data ?? []) as StudentRow[]).map(rowToStudent);
      this.hydrated = true;
    } catch (error) {
      logRepositoryFailure("SupabaseStudentRepository.refresh", error);
      this.cache = [];
      this.hydrated = true;
    }
  }

  private async persistOne(student: InstituteStudent): Promise<void> {
    const client = requireSupabaseClient("students.upsert");
    const { error } = await client
      .from("students")
      .upsert(studentToRow(student), { onConflict: "id" });
    throwIfSupabaseError(error, "students", "upsert");
  }

  private async removeOne(id: string): Promise<void> {
    const client = requireSupabaseClient("students.delete");
    const { error } = await client.from("students").delete().eq("id", id);
    throwIfSupabaseError(error, "students", "delete");
  }
}
