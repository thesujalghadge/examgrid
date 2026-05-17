import { toRepositoryError } from "@/lib/errors/repository-error";
import { logRepositoryFailure } from "@/lib/logging/runtime-logger";
import type { AttemptRepository } from "@/repositories/interfaces/attempt-repository";
import type { ExamRepository } from "@/repositories/interfaces/exam-repository";
import type { QuestionRepository } from "@/repositories/interfaces/question-repository";
import type { StudentRepository } from "@/repositories/interfaces/student-repository";
import type { BankQuestion } from "@/types/question-bank";
import type { ExamDefinition, PersistedExamAttempt } from "@/types/exam";
import type { StudentRecord } from "@/types/student";

function runSafe<T>(
  repository: string,
  operation: string,
  fallback: T,
  fn: () => T,
): T {
  try {
    return fn();
  } catch (error) {
    const repoError = toRepositoryError(error, repository, operation);
    logRepositoryFailure(`${repository}.${operation}`, repoError);
    return fallback;
  }
}

function runSafeVoid(
  repository: string,
  operation: string,
  fn: () => void,
): void {
  try {
    fn();
  } catch (error) {
    const repoError = toRepositoryError(error, repository, operation);
    logRepositoryFailure(`${repository}.${operation}`, repoError);
  }
}

export function wrapQuestionRepository(
  inner: QuestionRepository,
): QuestionRepository {
  const name = "questions";
  return {
    list: () => runSafe(name, "list", [] as BankQuestion[], () => inner.list()),
    getById: (id) =>
      runSafe(name, "getById", undefined, () => inner.getById(id)),
    saveAll: (questions) =>
      runSafeVoid(name, "saveAll", () => inner.saveAll(questions)),
    upsert: (question) =>
      runSafeVoid(name, "upsert", () => inner.upsert(question)),
    delete: (id) => runSafeVoid(name, "delete", () => inner.delete(id)),
  };
}

export function wrapExamRepository(inner: ExamRepository): ExamRepository {
  const name = "exams";
  return {
    list: () => runSafe(name, "list", [] as ExamDefinition[], () => inner.list()),
    getById: (id) =>
      runSafe(name, "getById", undefined, () => inner.getById(id)),
    save: (exam) => runSafeVoid(name, "save", () => inner.save(exam)),
    delete: (id) => runSafeVoid(name, "delete", () => inner.delete(id)),
  };
}

export function wrapStudentRepository(
  inner: StudentRepository,
): StudentRepository {
  const name = "students";
  return {
    getSession: () =>
      runSafe(name, "getSession", null, () => inner.getSession()),
    saveSession: (student) =>
      runSafeVoid(name, "saveSession", () => inner.saveSession(student)),
    clearSession: () => runSafeVoid(name, "clearSession", () => inner.clearSession()),
  };
}

export function wrapAttemptRepository(
  inner: AttemptRepository,
): AttemptRepository {
  const name = "attempts";
  return {
    load: (examId, roll) =>
      runSafe(name, "load", null, () => inner.load(examId, roll)),
    save: (attempt) => runSafeVoid(name, "save", () => inner.save(attempt)),
    clear: (examId, roll) =>
      runSafeVoid(name, "clear", () => inner.clear(examId, roll)),
  };
}

export function wrapRepositoryBundle(bundle: {
  questions: QuestionRepository;
  exams: ExamRepository;
  students: StudentRepository;
  attempts: AttemptRepository;
}): typeof bundle {
  return {
    questions: wrapQuestionRepository(bundle.questions),
    exams: wrapExamRepository(bundle.exams),
    students: wrapStudentRepository(bundle.students),
    attempts: wrapAttemptRepository(bundle.attempts),
  };
}
