import { assertInstituteUuid } from "@/config/institute";
import { assertPersistedUuid } from "@/lib/identity-boundary";
import { logRepositoryFailure } from "@/lib/logging/runtime-logger";
import { getClientWorkspaceSession } from "@/lib/workspace-session";
import type { QuestionRepository } from "@/repositories/interfaces/question-repository";
import {
  bankQuestionToRow,
  rowToBankQuestion,
  validateBankQuestionForWrite,
} from "@/repositories/supabase/mappers/question-mapper";
import type { QuestionRow } from "@/repositories/supabase/types";
import {
  requireSupabaseClient,
  throwIfSupabaseError,
} from "@/repositories/supabase/supabase-repo-utils";
import type { BankQuestion } from "@/types/question-bank";

/** Supabase question bank with in-memory cache (sync API, async persistence). */
export class SupabaseQuestionRepository implements QuestionRepository {
  private cache: BankQuestion[] = [];
  private hydrated = false;
  private refreshPromise: Promise<void> | null = null;
  private persistChain: Promise<void> = Promise.resolve();

  get isHydrated(): boolean {
    return this.hydrated;
  }

  list(): BankQuestion[] {
    return [...this.cache];
  }

  getById(id: string): BankQuestion | undefined {
    return this.cache.find((q) => q.id === id);
  }

  saveAll(questions: BankQuestion[]): void {
    const valid = questions.map((q) =>
      validateBankQuestionForWrite(q, "saveAll"),
    );
    this.cache = valid;
    this.enqueuePersist(() => this.persistAll(valid));
  }

  upsert(question: BankQuestion): void {
    const valid = validateBankQuestionForWrite(question, "upsert");
    const idx = this.cache.findIndex((q) => q.id === valid.id);
    if (idx >= 0) this.cache[idx] = valid;
    else this.cache.push(valid);
    this.enqueuePersist(() => this.persistOne(valid));
  }

  delete(id: string): void {
    this.cache = this.cache.filter((q) => q.id !== id);
    this.enqueuePersist(() => this.removeOne(id));
  }

  /** Wait for in-flight writes (e.g. before navigation after import). */
  async whenIdle(): Promise<void> {
    await this.persistChain;
  }

  private enqueuePersist(task: () => Promise<void>): void {
    this.persistChain = this.persistChain.then(task).catch((error) => {
      logRepositoryFailure("SupabaseQuestionRepository.persistChain", error);
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
      this.hydrated = true;
      return;
    }

    try {
      assertInstituteUuid(session.instituteId, "session.instituteId");

      const client = requireSupabaseClient("questions.list");
      const { data, error } = await client
        .from("questions")
        .select("*")
        .eq("institute_id", session.instituteId)
        .order("updated_at", { ascending: false });

      throwIfSupabaseError(error, "questions", "list");
      this.cache = (data as QuestionRow[]).map(rowToBankQuestion);
      this.hydrated = true;
    } catch (error) {
      logRepositoryFailure("SupabaseQuestionRepository.refresh", error);
      this.cache = [];
      this.hydrated = true;
    }
  }



  private async persistOne(question: BankQuestion): Promise<void> {
    try {
      const session = getClientWorkspaceSession();
      if (!session?.instituteId) return;
      const client = requireSupabaseClient("questions.upsert");
      const id = assertPersistedUuid(question.id, "questions.id");
      const row = bankQuestionToRow(question, id, session.instituteId);
      const { error } = await client.from("questions").upsert(row, {
        onConflict: "id",
      });
      if (error) console.error(`[PERSISTENCE_LOG] table: questions, action: upsert, rows: 1, success: false, error: ${error.message}`);
      else console.log(`[PERSISTENCE_LOG] table: questions, action: upsert, rows: 1, success: true`);
      throwIfSupabaseError(error, "questions", "upsert");
    } catch (error) {
      logRepositoryFailure("SupabaseQuestionRepository.persistOne", error);
      throw error;
    }
  }

  private async persistAll(questions: BankQuestion[]): Promise<void> {
    if (questions.length === 0) {
      try {
        const session = getClientWorkspaceSession();
        if (!session?.instituteId) return;
        assertInstituteUuid(session.instituteId, "session.instituteId");

        const client = requireSupabaseClient("questions.clear");
        const { error } = await client
          .from("questions")
          .delete()
          .eq("institute_id", session.instituteId);
        if (error) console.error(`[PERSISTENCE_LOG] table: questions, action: deleteAll, success: false, error: ${error.message}`);
        else console.log(`[PERSISTENCE_LOG] table: questions, action: deleteAll, success: true`);
        throwIfSupabaseError(error, "questions", "deleteAll");
      } catch (error) {
        logRepositoryFailure("SupabaseQuestionRepository.persistAll", error);
        throw error;
      }
      return;
    }

    for (const q of questions) {
      await this.persistOne(q);
    }

    try {
      const session = getClientWorkspaceSession();
      if (!session?.instituteId) return;
      assertInstituteUuid(session.instituteId, "session.instituteId");

      const client = requireSupabaseClient("questions.prune");
      const keepUuids = questions.map((q) => assertPersistedUuid(q.id, "questions.id"));

      const { data: remote } = await client
        .from("questions")
        .select("id")
        .eq("institute_id", session.instituteId);

      if (!remote) return;

      const toDelete = (remote as { id: string }[])
        .filter((r) => !keepUuids.includes(r.id))
        .map((r) => r.id);

      if (toDelete.length > 0) {
        const { error } = await client.from("questions").delete().in("id", toDelete);
        if (error) console.error(`[PERSISTENCE_LOG] table: questions, action: prune, rows: ${toDelete.length}, success: false, error: ${error.message}`);
        else console.log(`[PERSISTENCE_LOG] table: questions, action: prune, rows: ${toDelete.length}, success: true`);
        throwIfSupabaseError(error, "questions", "prune");
      }
    } catch (error) {
      logRepositoryFailure("SupabaseQuestionRepository.prune", error);
      throw error;
    }
  }

  private async removeOne(publicId: string): Promise<void> {
    try {
      const session = getClientWorkspaceSession();
      if (!session?.instituteId) return;
      const client = requireSupabaseClient("questions.delete");
      const id = assertPersistedUuid(publicId, "questions.id");
      const { error } = await client
        .from("questions")
        .delete()
        .eq("id", id);
      if (error) console.error(`[PERSISTENCE_LOG] table: questions, action: delete, success: false, error: ${error.message}`);
      else console.log(`[PERSISTENCE_LOG] table: questions, action: delete, success: true`);
      throwIfSupabaseError(error, "questions", "delete");
    } catch (error) {
      logRepositoryFailure("SupabaseQuestionRepository.delete", error);
      throw error;
    }
  }
}

