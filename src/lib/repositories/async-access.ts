/**
 * Async-readiness bridge — wraps sync repositories without changing stores.
 * Phase 4B can swap implementations to real async while services keep await.
 */
import { getRepositories } from "@/lib/repositories/provider";
import type { BankQuestion } from "@/types/question-bank";
import type { ExamDefinition, PersistedExamAttempt } from "@/types/exam";
import type { StudentRecord } from "@/types/student";

export async function readQuestionBank(): Promise<BankQuestion[]> {
  return Promise.resolve(getRepositories().questions.list());
}

export async function readExamCatalog(): Promise<ExamDefinition[]> {
  return Promise.resolve(getRepositories().exams.list());
}

export async function readExamById(
  id: string,
): Promise<ExamDefinition | undefined> {
  return Promise.resolve(getRepositories().exams.getById(id));
}

export async function writeExam(exam: ExamDefinition): Promise<void> {
  return Promise.resolve(getRepositories().exams.save(exam));
}

import { loadExamAttempt, saveExamAttempt } from "@/lib/persistence";

export async function readExamAttempt(
  examId: string,
  candidateRoll: string,
): Promise<PersistedExamAttempt | null> {
  return Promise.resolve(
    loadExamAttempt(examId, candidateRoll),
  );
}

export async function writeExamAttempt(
  attempt: PersistedExamAttempt,
): Promise<void> {
  return Promise.resolve(saveExamAttempt(attempt) ? undefined : undefined);
}

export async function readStudentSession(): Promise<StudentRecord | null> {
  return Promise.resolve(getRepositories().students.getSession());
}
