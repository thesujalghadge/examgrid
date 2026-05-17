import type { Batch } from "@/types/institute-ops";

export interface BatchRepository {
  list(): Batch[];
  getById(id: string): Batch | undefined;
  save(batch: Batch): void;
  archive(id: string): void;
  delete(id: string): void;
}
