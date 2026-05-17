import { DEFAULT_INSTITUTE_ID, isUuid } from "@/config/institute";
import { logRepositoryFailure } from "@/lib/logging/runtime-logger";
import type { ExamRepository } from "@/repositories/interfaces/exam-repository";
import {
  examDefinitionToRows,
  rowsToExamDefinition,
  validateExamForWrite,
} from "@/repositories/supabase/mappers/exam-mapper";
import type {
  ExamQuestionRow,
  ExamRow,
  ExamSectionRow,
} from "@/repositories/supabase/types";
import {
  requireSupabaseClient,
  throwIfSupabaseError,
} from "@/repositories/supabase/supabase-repo-utils";
import type { ExamDefinition } from "@/types/exam";

/** Supabase exam catalog with normalized sections/questions tables. */
export class SupabaseExamRepository implements ExamRepository {
  private cache: ExamDefinition[] = [];
  private hydrated = false;
  private refreshPromise: Promise<void> | null = null;
  /** public exam id → uuid pk */
  private idMap = new Map<string, string>();
  private persistChain: Promise<void> = Promise.resolve();

  get isHydrated(): boolean {
    return this.hydrated;
  }

  list(): ExamDefinition[] {
    return [...this.cache];
  }

  getById(id: string): ExamDefinition | undefined {
    return this.cache.find((e) => e.id === id);
  }

  save(exam: ExamDefinition): void {
    const valid = validateExamForWrite(exam);
    if (!valid) return;
    const idx = this.cache.findIndex((e) => e.id === valid.id);
    if (idx >= 0) this.cache[idx] = valid;
    else this.cache.push(valid);
    this.enqueuePersist(() => this.persistExam(valid));
  }

  delete(id: string): void {
    this.cache = this.cache.filter((e) => e.id !== id);
    this.enqueuePersist(() => this.removeExam(id));
  }

  async whenIdle(): Promise<void> {
    await this.persistChain;
  }

  private enqueuePersist(task: () => Promise<void>): void {
    this.persistChain = this.persistChain.then(task).catch((error) => {
      logRepositoryFailure("SupabaseExamRepository.persistChain", error);
    });
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

  private async doRefresh(): Promise<void> {
    try {
      const client = requireSupabaseClient("exams.list");
      const { data: exams, error: examErr } = await client
        .from("exams")
        .select("*")
        .eq("institute_id", DEFAULT_INSTITUTE_ID)
        .order("scheduled_at", { ascending: false });

      throwIfSupabaseError(examErr, "exams", "list");

      if (!exams?.length) {
        this.cache = [];
        this.idMap.clear();
        this.hydrated = true;
        return;
      }

      const examRows = exams as ExamRow[];
      const examUuids = examRows.map((e) => e.id);

      const { data: sections, error: secErr } = await client
        .from("exam_sections")
        .select("*")
        .in("exam_id", examUuids)
        .order("sort_order", { ascending: true });

      throwIfSupabaseError(secErr, "exam_sections", "list");

      const { data: questions, error: qErr } = await client
        .from("exam_questions")
        .select("*")
        .in("exam_id", examUuids)
        .order("sort_order", { ascending: true });

      throwIfSupabaseError(qErr, "exam_questions", "list");

      const sectionRows = (sections ?? []) as ExamSectionRow[];
      const questionRows = (questions ?? []) as ExamQuestionRow[];

      this.cache = examRows.map((examRow) => {
        const publicId = examRow.legacy_id ?? examRow.id;
        this.idMap.set(publicId, examRow.id);
        return rowsToExamDefinition(
          examRow,
          sectionRows.filter((s) => s.exam_id === examRow.id),
          questionRows.filter((q) => q.exam_id === examRow.id),
        );
      });
      this.hydrated = true;
    } catch (error) {
      logRepositoryFailure("SupabaseExamRepository.refresh", error);
      this.cache = [];
      this.hydrated = true;
    }
  }

  private async resolveExamUuid(publicId: string): Promise<string> {
    const cached = this.idMap.get(publicId);
    if (cached) return cached;

    const client = requireSupabaseClient("exams.resolveId");
    if (isUuid(publicId)) {
      const { data } = await client
        .from("exams")
        .select("id")
        .eq("id", publicId)
        .maybeSingle();
      if (data?.id) {
        this.idMap.set(publicId, data.id as string);
        return data.id as string;
      }
      return publicId;
    }

    const { data } = await client
      .from("exams")
      .select("id, legacy_id")
      .eq("institute_id", DEFAULT_INSTITUTE_ID)
      .eq("legacy_id", publicId)
      .maybeSingle();

    if (data?.id) {
      this.idMap.set(publicId, data.id as string);
      return data.id as string;
    }

    const newId = crypto.randomUUID();
    this.idMap.set(publicId, newId);
    return newId;
  }

  private async persistExam(exam: ExamDefinition): Promise<void> {
    try {
      const client = requireSupabaseClient("exams.save");
      const examUuid = await this.resolveExamUuid(exam.id);
      const { examRow, sections, questions } = examDefinitionToRows(
        exam,
        examUuid,
      );

      const { error: examError } = await client.from("exams").upsert(
        {
          ...examRow,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      throwIfSupabaseError(examError, "exams", "upsert");

      const { error: delSec } = await client
        .from("exam_sections")
        .delete()
        .eq("exam_id", examUuid);
      throwIfSupabaseError(delSec, "exam_sections", "delete");

      const { error: delQ } = await client
        .from("exam_questions")
        .delete()
        .eq("exam_id", examUuid);
      throwIfSupabaseError(delQ, "exam_questions", "delete");

      if (sections.length > 0) {
        const { error: secErr } = await client.from("exam_sections").insert(
          sections.map((s) => ({
            ...s,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })),
        );
        throwIfSupabaseError(secErr, "exam_sections", "insert");
      }

      if (questions.length > 0) {
        const { error: qErr } = await client.from("exam_questions").insert(
          questions.map((q) => ({
            ...q,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })),
        );
        throwIfSupabaseError(qErr, "exam_questions", "insert");
      }

      this.idMap.set(exam.id, examUuid);
    } catch (error) {
      logRepositoryFailure("SupabaseExamRepository.persistExam", error);
    }
  }

  private async removeExam(publicId: string): Promise<void> {
    try {
      const client = requireSupabaseClient("exams.delete");
      const examUuid = await this.resolveExamUuid(publicId);
      const { error } = await client.from("exams").delete().eq("id", examUuid);
      throwIfSupabaseError(error, "exams", "delete");
      this.idMap.delete(publicId);
    } catch (error) {
      logRepositoryFailure("SupabaseExamRepository.delete", error);
    }
  }
}
