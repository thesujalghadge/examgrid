import { readQuestionBank } from "@/lib/repositories/async-access";
import { questionBankRepository } from "@/repositories/question-bank-repository";
import type { BankQuestion } from "@/types/question-bank";

export function getQuestionBank(): BankQuestion[] {
  return questionBankRepository.getAll();
}

export async function getQuestionBankAsync(): Promise<BankQuestion[]> {
  return readQuestionBank();
}

export function saveQuestionBank(questions: BankQuestion[]): void {
  questionBankRepository.saveAll(questions);
}
