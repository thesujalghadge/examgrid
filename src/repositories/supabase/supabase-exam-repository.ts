import { isUuid, assertInstituteUuid } from "@/config/institute";
import { assertPersistedUuid } from "@/lib/identity-boundary";
import { logRepositoryFailure } from "@/lib/logging/runtime-logger";
import { getClientWorkspaceSession } from "@/lib/workspace-session";
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
      throw error;
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
    const session = getClientWorkspaceSession();
    if (!session?.instituteId) {
      this.cache = [];
      this.idMap.clear();
      this.hydrated = true;
      return;
    }

    try {
      assertInstituteUuid(session.instituteId, "session.instituteId");

      const client = requireSupabaseClient("exams.list");
      const { data: exams, error: examErr } = await client
        .from("exams")
        .select("*")
        .eq("institute_id", session.instituteId)
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

      const bankQuestionIds = questionRows.map(q => q.bank_question_id).filter(Boolean) as string[];
      let bankQuestionsMap: Record<string, any> = {};
      if (bankQuestionIds.length > 0) {
        const { data: bankData } = await client
          .from("questions")
          .select("id, metadata, options")
          .in("id", bankQuestionIds);
        
        if (bankData) {
          bankData.forEach((bq: any) => {
             bankQuestionsMap[bq.id] = bq;
          });
        }
      }

      this.cache = examRows.map((examRow) => {
        this.idMap.set(examRow.id, examRow.id);
        return rowsToExamDefinition(
          examRow,
          sectionRows.filter((s) => s.exam_id === examRow.id),
          questionRows.filter((q) => q.exam_id === examRow.id),
          bankQuestionsMap
        );
      });
      this.hydrated = true;
    } catch (error) {
      logRepositoryFailure("SupabaseExamRepository.refresh", error);
      this.cache = [];
      this.hydrated = true;
    }
  }

  private async resolveExamUuid(publicId: string, instituteId: string): Promise<string> {
    if (!isUuid(publicId)) {
      throw new Error(`Invariant violation: resolveExamUuid attempted with non-uuid id=${publicId}`);
    }
    return publicId;
  }

  private async persistExam(exam: ExamDefinition): Promise<void> {
    try {
      const session = getClientWorkspaceSession();
      if (!session?.instituteId) return;
      assertInstituteUuid(session.instituteId, "session.instituteId");

      const client = requireSupabaseClient("exams.save");
      const examUuid = assertPersistedUuid(await this.resolveExamUuid(exam.id, session.instituteId), "exams.id");

      const { data: existingExam } = await client
        .from("exams")
        .select("status")
        .eq("id", examUuid)
        .maybeSingle();

      if (existingExam?.status === "PUBLISHED") {
        throw new Error("Exam has already been published. Published questions cannot be modified.");
      }

      const { examRow, sections, questions } = examDefinitionToRows(
        exam,
        examUuid,
        session.instituteId
      );

      const { error: examError } = await client.from("exams").upsert(
        {
          ...examRow,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (examError) console.error(`[PERSISTENCE_LOG] table: exams, action: upsert, rows: 1, success: false, error: ${examError.message}`);
      else console.log(`[PERSISTENCE_LOG] table: exams, action: upsert, rows: 1, success: true`);
      throwIfSupabaseError(examError, "exams", "upsert");

      const { error: delSec } = await client
        .from("exam_sections")
        .delete()
        .eq("exam_id", examUuid);
      if (delSec) console.error(`[PERSISTENCE_LOG] table: exam_sections, action: delete, success: false, error: ${delSec.message}`);
      else console.log(`[PERSISTENCE_LOG] table: exam_sections, action: delete, success: true`);
      throwIfSupabaseError(delSec, "exam_sections", "delete");

      const { error: delQ } = await client
        .from("exam_questions")
        .delete()
        .eq("exam_id", examUuid);
      if (delQ) console.error(`[PERSISTENCE_LOG] table: exam_questions, action: delete, success: false, error: ${delQ.message}`);
      else console.log(`[PERSISTENCE_LOG] table: exam_questions, action: delete, success: true`);
      throwIfSupabaseError(delQ, "exam_questions", "delete");

      if (sections.length > 0) {
        const { error: secErr } = await client.from("exam_sections").insert(
          sections.map((s) => ({
            ...s,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })),
        );
        if (secErr) console.error(`[PERSISTENCE_LOG] table: exam_sections, action: insert, rows: ${sections.length}, success: false, error: ${secErr.message}`);
        else console.log(`[PERSISTENCE_LOG] table: exam_sections, action: insert, rows: ${sections.length}, success: true`);
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
        if (qErr) console.error(`[PERSISTENCE_LOG] table: exam_questions, action: insert, rows: ${questions.length}, success: false, error: ${qErr.message}`);
        else console.log(`[PERSISTENCE_LOG] table: exam_questions, action: insert, rows: ${questions.length}, success: true`);
        throwIfSupabaseError(qErr, "exam_questions", "insert");
        // Solution generation queue insertion is now exclusively handled by the /publish API.
      }

      this.idMap.set(exam.id, examUuid);
    } catch (error) {
      logRepositoryFailure("SupabaseExamRepository.persistExam", error);
      throw error;
    }
  }

  private async removeExam(publicId: string): Promise<void> {
    try {
      const session = getClientWorkspaceSession();
      if (!session?.instituteId) return;
      assertInstituteUuid(session.instituteId, "session.instituteId");

      const client = requireSupabaseClient("exams.delete");
      const examUuid = assertPersistedUuid(await this.resolveExamUuid(publicId, session.instituteId), "exams.id");
      const { error } = await client.from("exams").delete().eq("id", examUuid);
      if (error) console.error(`[PERSISTENCE_LOG] table: exams, action: delete, success: false, error: ${error.message}`);
      else console.log(`[PERSISTENCE_LOG] table: exams, action: delete, success: true`);
      throwIfSupabaseError(error, "exams", "delete");
      this.idMap.delete(publicId);
    } catch (error) {
      logRepositoryFailure("SupabaseExamRepository.delete", error);
      throw error;
    }
  }
}

