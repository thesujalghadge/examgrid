import { SEED_QUESTION_BANK } from "@/data/seed-question-bank";
import { readQuestionBank } from "@/lib/repositories/async-access";
import { questionBankRepository } from "@/repositories/question-bank-repository";
import type { BankQuestion } from "@/types/question-bank";

let seeded = false;

export function ensureQuestionBankSeeded(): void {
  if (typeof window === "undefined" || seeded) return;
  const existing = questionBankRepository.getAll();
  if (existing.length === 0) {
    questionBankRepository.saveAll(SEED_QUESTION_BANK);
  }
  seeded = true;
}

export function getQuestionBank(): BankQuestion[] {
  ensureQuestionBankSeeded();
  return questionBankRepository.getAll();
}

/** Async-readiness: same data, Promise wrapper for future Supabase repos. */
export async function getQuestionBankAsync(): Promise<BankQuestion[]> {
  ensureQuestionBankSeeded();
  return readQuestionBank();
}

export function saveQuestionBank(questions: BankQuestion[]): void {
  questionBankRepository.saveAll(questions);
}
