import type { BankQuestion } from "@/types/question-bank";
import { STORAGE_KEYS } from "./storage-keys";

export interface QuestionBankRepository {
  getAll(): BankQuestion[];
  saveAll(questions: BankQuestion[]): void;
  getById(id: string): BankQuestion | undefined;
  upsert(question: BankQuestion): void;
  delete(id: string): void;
}

class LocalQuestionBankRepository implements QuestionBankRepository {
  getAll(): BankQuestion[] {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEYS.questionBank);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as BankQuestion[];
    } catch {
      return [];
    }
  }

  saveAll(questions: BankQuestion[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.questionBank, JSON.stringify(questions));
  }

  getById(id: string): BankQuestion | undefined {
    return this.getAll().find((q) => q.id === id);
  }

  upsert(question: BankQuestion): void {
    const all = this.getAll();
    const idx = all.findIndex((q) => q.id === question.id);
    if (idx >= 0) all[idx] = question;
    else all.push(question);
    this.saveAll(all);
  }

  delete(id: string): void {
    this.saveAll(this.getAll().filter((q) => q.id !== id));
  }
}

export const questionBankRepository = new LocalQuestionBankRepository();
