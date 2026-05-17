import { SEED_QUESTION_BANK } from "@/data/seed-question-bank";
import { migrateLocalToSupabase } from "@/lib/migration/local-to-supabase";
import { getRepositories } from "@/lib/repositories/provider";
import { STORAGE_KEYS } from "@/repositories/storage-keys";
import { logPersistenceEvent } from "@/lib/logging/runtime-logger";

const ATTEMPT_PREFIX = "examgrid:attempt:";

export function clearAllExamAttempts(): number {
  if (typeof window === "undefined") return 0;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(ATTEMPT_PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  logPersistenceEvent("clear", "all-attempts", true, { count: keys.length });
  return keys.length;
}

export function resetQuestionBankToSeed(): void {
  getRepositories().questions.saveAll(SEED_QUESTION_BANK);
  logPersistenceEvent("save", STORAGE_KEYS.questionBank, true, {
    seeded: true,
  });
}

export function clearQuestionBank(): void {
  getRepositories().questions.saveAll([]);
}

export function clearExamCatalog(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.examCatalog, JSON.stringify([]));
}

export function resetLocalEnvironment(options?: {
  clearAttempts?: boolean;
  seedQuestions?: boolean;
  clearExams?: boolean;
}): void {
  const opts = {
    clearAttempts: true,
    seedQuestions: true,
    clearExams: false,
    ...options,
  };
  if (opts.clearAttempts) clearAllExamAttempts();
  if (opts.clearExams) clearExamCatalog();
  if (opts.seedQuestions) resetQuestionBankToSeed();
  else clearQuestionBank();
}

export function installDevHelpers(): void {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") {
    return;
  }
  const api = {
    clearAllExamAttempts,
    resetQuestionBankToSeed,
    clearQuestionBank,
    clearExamCatalog,
    resetLocalEnvironment,
    migrateLocalToSupabase,
  };
  (window as unknown as { __EXAMGRID_DEV__?: typeof api }).__EXAMGRID_DEV__ =
    api;
}
