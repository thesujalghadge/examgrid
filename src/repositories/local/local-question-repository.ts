import type { QuestionRepository } from "@/repositories/interfaces/question-repository";
import { STORAGE_KEYS } from "@/repositories/storage-keys";
import type { BankQuestion } from "@/types/question-bank";
import { readStorageJson, writeStorageJson } from "@/lib/storage/safe-json";
import {
  assertBankQuestionForWrite,
  parseBankQuestionList,
} from "@/lib/validation/bank-question-stored-schema";

export class LocalQuestionRepository implements QuestionRepository {
  list(): BankQuestion[] {
    return readStorageJson({
      storage: "local",
      key: STORAGE_KEYS.questionBank,
      fallback: [],
      validate: (data) => {
        const result = parseBankQuestionList(data);
        if (!result.success) return { ok: false, error: result.error };
        return { ok: true, value: result.data };
      },
    });
  }

  saveAll(questions: BankQuestion[]): void {
    const valid = questions.map((q) =>
      assertBankQuestionForWrite(q, "saveAll"),
    );
    writeStorageJson("local", STORAGE_KEYS.questionBank, valid);
  }

  getById(id: string): BankQuestion | undefined {
    return this.list().find((q) => q.id === id);
  }

  upsert(question: BankQuestion): void {
    const valid = assertBankQuestionForWrite(question, "upsert");
    const all = this.list();
    const idx = all.findIndex((q) => q.id === valid.id);
    if (idx >= 0) all[idx] = valid;
    else all.push(valid);
    this.saveAll(all);
  }

  delete(id: string): void {
    this.saveAll(this.list().filter((q) => q.id !== id));
  }
}
