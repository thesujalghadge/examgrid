import type { BankQuestion } from "@/types/question-bank";

export interface QuestionRepository {
  list(): BankQuestion[];
  getById(id: string): BankQuestion | undefined;
  saveAll(questions: BankQuestion[]): void;
  upsert(question: BankQuestion): void;
  delete(id: string): void;
}
