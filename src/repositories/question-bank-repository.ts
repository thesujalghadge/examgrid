import { getRepositories } from "@/lib/repositories/provider";
import type { BankQuestion } from "@/types/question-bank";

/** @deprecated Use getRepositories().questions — kept for gradual migration. */
export interface QuestionBankRepository {
  getAll(): BankQuestion[];
  saveAll(questions: BankQuestion[]): void;
  getById(id: string): BankQuestion | undefined;
  upsert(question: BankQuestion): void;
  delete(id: string): void;
}

export const questionBankRepository: QuestionBankRepository = {
  getAll: () => getRepositories().questions.list(),
  saveAll: (questions) => getRepositories().questions.saveAll(questions),
  getById: (id) => getRepositories().questions.getById(id),
  upsert: (question) => getRepositories().questions.upsert(question),
  delete: (id) => getRepositories().questions.delete(id),
};

