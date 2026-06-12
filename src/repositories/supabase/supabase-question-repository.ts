import { isUuid } from "@/config/institute";
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

  private async resolveExistingId(
    publicId: string,
    instituteId: string,
  ): Promise<{ id: string; legacyId: string | null }> {
    if (isUuid(publicId)) {
      return { id: publicId, legacyId: null };
    }
    const client = requireSupabaseClient("questions.resolveId");
    const { data } = await client
      .from("questions")
      .select("id, legacy_id")
      .eq("institute_id", instituteId)
      .eq("legacy_id", publicId)
      .maybeSingle();

    if (data?.id) {
      return { id: data.id as string, legacyId: publicId };
    }
    return { id: crypto.randomUUID(), legacyId: publicId };
  }

  private async persistOne(question: BankQuestion): Promise<void> {
    try {
      const session = getClientWorkspaceSession();
      if (!session?.instituteId) return;
      const client = requireSupabaseClient("questions.upsert");
      const { id, legacyId } = await this.resolveExistingId(question.id, session.instituteId);
      const row = bankQuestionToRow(question, id, legacyId, session.instituteId);
      const { error } = await client.from("questions").upsert(row, {
        onConflict: "id",
      });
      throwIfSupabaseError(error, "questions", "upsert");
    } catch (error) {
      logRepositoryFailure("SupabaseQuestionRepository.persistOne", error);
    }
  }

  private async persistAll(questions: BankQuestion[]): Promise<void> {
    if (questions.length === 0) {
      try {
        const session = getClientWorkspaceSession();
        if (!session?.instituteId) return;
        const client = requireSupabaseClient("questions.clear");
        const { error } = await client
          .from("questions")
          .delete()
          .eq("institute_id", session.instituteId);
        throwIfSupabaseError(error, "questions", "deleteAll");
      } catch (error) {
        logRepositoryFailure("SupabaseQuestionRepository.persistAll", error);
      }
      return;
    }

    for (const q of questions) {
      await this.persistOne(q);
    }

    try {
      const session = getClientWorkspaceSession();
      if (!session?.instituteId) return;
      const client = requireSupabaseClient("questions.prune");
      const keepLegacyIds = questions
        .filter((q) => !isUuid(q.id))
        .map((q) => q.id);
      const keepUuids = questions.filter((q) => isUuid(q.id)).map((q) => q.id);

      const { data: remote } = await client
        .from("questions")
        .select("id, legacy_id")
        .eq("institute_id", session.instituteId);

      if (!remote) return;

      const toDelete = (remote as { id: string; legacy_id: string | null }[])
        .filter((r) => {
          const pub = r.legacy_id ?? r.id;
          return (
            !keepUuids.includes(r.id) &&
            !keepLegacyIds.includes(pub) &&
            !keepLegacyIds.includes(r.legacy_id ?? "")
          );
        })
        .map((r) => r.id);

      if (toDelete.length > 0) {
        const { error } = await client.from("questions").delete().in("id", toDelete);
        throwIfSupabaseError(error, "questions", "prune");
      }
    } catch (error) {
      logRepositoryFailure("SupabaseQuestionRepository.prune", error);
    }
  }

  private async removeOne(publicId: string): Promise<void> {
    try {
      const session = getClientWorkspaceSession();
      if (!session?.instituteId) return;
      const client = requireSupabaseClient("questions.delete");
      const { id } = await this.resolveExistingId(publicId, session.instituteId);
      const { error } = await client
        .from("questions")
        .delete()
        .eq("id", id);
      throwIfSupabaseError(error, "questions", "delete");
    } catch (error) {
      logRepositoryFailure("SupabaseQuestionRepository.delete", error);
    }
  }
}
