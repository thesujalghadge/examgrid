import { readStorageJson, writeStorageJson } from "@/lib/storage/safe-json";
import {
  assertBatch,
  parseBatchList,
} from "@/lib/validation/institute-ops-schema";
import type { BatchRepository } from "@/repositories/interfaces/batch-repository";
import { STORAGE_KEYS } from "@/repositories/storage-keys";
import type { Batch } from "@/types/institute-ops";

export class LocalBatchRepository implements BatchRepository {
  list(): Batch[] {
    return readStorageJson({
      storage: "local",
      key: STORAGE_KEYS.batches,
      fallback: [],
      validate: (data) => {
        const result = parseBatchList(data);
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

  getById(id: string): Batch | undefined {
    return this.list().find((batch) => batch.id === id);
  }

  save(batch: Batch): void {
    const valid = assertBatch(batch);
    const all = this.list().filter((item) => item.id !== valid.id);
    all.push(valid);
    writeStorageJson("local", STORAGE_KEYS.batches, all);
  }

  archive(id: string): void {
    const all = this.list().map((batch) =>
      batch.id === id
        ? { ...batch, active: false, updatedAt: Date.now() }
        : batch,
    );
    writeStorageJson("local", STORAGE_KEYS.batches, all);
  }

  delete(id: string): void {
    writeStorageJson(
      "local",
      STORAGE_KEYS.batches,
      this.list().filter((batch) => batch.id !== id),
    );
  }
}
