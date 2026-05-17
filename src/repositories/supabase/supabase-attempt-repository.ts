import type { AttemptRepository } from "@/repositories/interfaces/attempt-repository";
import {
  getSupabaseOrWarn,
  logSupabaseNotImplemented,
} from "@/repositories/supabase/supabase-base";
import type { PersistedExamAttempt } from "@/types/exam";

/** Supabase-backed exam attempts — scaffold for Phase 4B. */
export class SupabaseAttemptRepository implements AttemptRepository {
  private readonly table = "attempts";

  load(_examId: string, _candidateRoll: string): PersistedExamAttempt | null {
    getSupabaseOrWarn(`AttemptRepository.load (${this.table})`);
    logSupabaseNotImplemented("AttemptRepository.load");
    return null;
  }

  save(_attempt: PersistedExamAttempt): void {
    getSupabaseOrWarn(`AttemptRepository.save (${this.table})`);
    logSupabaseNotImplemented("AttemptRepository.save");
  }

  clear(_examId: string, _candidateRoll: string): void {
    getSupabaseOrWarn(`AttemptRepository.clear (${this.table})`);
    logSupabaseNotImplemented("AttemptRepository.clear");
  }
}
