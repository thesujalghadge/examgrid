import type { CBTTest } from "@/types/cbt";

export interface CbtTestRepository {
  list(): CBTTest[];
  getById(id: string): CBTTest | undefined;
  save(test: CBTTest): void;
  delete(id: string): void;
}
