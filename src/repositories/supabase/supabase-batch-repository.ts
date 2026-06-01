import { logRepositoryFailure } from "@/lib/logging/runtime-logger";
import { getClientWorkspaceSession } from "@/lib/workspace-session";
import { assertBatch } from "@/lib/validation/institute-ops-schema";
import type { BatchRepository } from "@/repositories/interfaces/batch-repository";
import {
  batchToRow,
  rowToBatch,
} from "@/repositories/supabase/mappers/institute-ops-mapper";
import {
  requireSupabaseClient,
  throwIfSupabaseError,
} from "@/repositories/supabase/supabase-repo-utils";
import type { BatchRow } from "@/repositories/supabase/types";
import type { Batch } from "@/types/institute-ops";

export class SupabaseBatchRepository implements BatchRepository {
  private cache: Batch[] = [];
  private hydrated = false;
  private refreshPromise: Promise<void> | null = null;
  private persistChain: Promise<void> = Promise.resolve();

  get isHydrated(): boolean {
    return this.hydrated;
  }

  list(): Batch[] {
    return [...this.cache];
  }

  getById(id: string): Batch | undefined {
    return this.cache.find((batch) => batch.id === id);
  }

  save(batch: Batch): void {
    const valid = assertBatch(batch);
    const idx = this.cache.findIndex((item) => item.id === valid.id);
    if (idx >= 0) this.cache[idx] = valid;
    else this.cache.push(valid);
    this.enqueuePersist(() => this.persistOne(valid));
  }

  archive(id: string): void {
    const existing = this.getById(id);
    if (!existing) return;
    this.save({ ...existing, active: false, updatedAt: Date.now() });
  }

  delete(id: string): void {
    this.cache = this.cache.filter((batch) => batch.id !== id);
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
      logRepositoryFailure("SupabaseBatchRepository.persistChain", error);
    });
  }

  private async doRefresh(): Promise<void> {
    const session = getClientWorkspaceSession();
    if (!session?.instituteId) {
      this.cache = [];
      this.hydrated = true;
      return;
    }

    try {
      const client = requireSupabaseClient("batches.list");
      const { data, error } = await client
        .from("batches")
        .select("*")
        .eq("institute_id", session.instituteId)
        .order("name", { ascending: true });
      throwIfSupabaseError(error, "batches", "list");
      this.cache = ((data ?? []) as BatchRow[]).map(rowToBatch);
      this.hydrated = true;
    } catch (error) {
      logRepositoryFailure("SupabaseBatchRepository.refresh", error);
      this.cache = [];
      this.hydrated = true;
    }
  }

  private async persistOne(batch: Batch): Promise<void> {
    const client = requireSupabaseClient("batches.upsert");
    const { data: existing, error: lookupError } = await client
      .from("batches")
      .select("id")
      .eq("institute_id", batch.instituteId)
      .eq("name", batch.name)
      .eq("academic_year", batch.academicYear)
      .maybeSingle();
    throwIfSupabaseError(lookupError, "batches", "lookup");

    const { error } = await client
      .from("batches")
      .upsert(
        batchToRow({ ...batch, id: existing?.id ?? batch.id }),
        { onConflict: "institute_id,name,academic_year" },
      );
    throwIfSupabaseError(error, "batches", "upsert");
  }

  private async removeOne(id: string): Promise<void> {
    const client = requireSupabaseClient("batches.delete");
    const { error } = await client.from("batches").delete().eq("id", id);
    throwIfSupabaseError(error, "batches", "delete");
  }
}
