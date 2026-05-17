import { getRepositories } from "@/lib/repositories/provider";
import {
  logAutosaveFailure,
  logPersistenceEvent,
  logValidationFailure,
} from "@/lib/logging/runtime-logger";
import { getAttemptStorageKey } from "@/repositories/local/local-attempt-repository";
import { parsePersistedExamAttempt } from "@/lib/validation/attempt-schema";
import { readStorageJson, writeStorageJson, removeStorageKey } from "@/lib/storage/safe-json";
import type { PersistedExamAttempt } from "@/types/exam";
import type { Candidate } from "@/types/exam";

export { getAttemptStorageKey };

const SESSION_KEY = "examgrid:session";

export function saveExamAttempt(attempt: PersistedExamAttempt): boolean {
  const parsed = parsePersistedExamAttempt(attempt);
  if (!parsed.success) {
    logValidationFailure("saveExamAttempt", parsed.error);
    logPersistenceEvent("save", `attempt:${attempt.examId}`, false, parsed.error);
    return false;
  }
  try {
    getRepositories().attempts.save(parsed.data);
    logPersistenceEvent("save", `attempt:${attempt.examId}`, true);
    return true;
  } catch (error) {
    logAutosaveFailure(attempt.examId, error);
    return false;
  }
}

export function loadExamAttempt(
  examId: string,
  candidateRoll: string,
): PersistedExamAttempt | null {
  try {
    const loaded = getRepositories().attempts.load(examId, candidateRoll);
    logPersistenceEvent("load", `attempt:${examId}`, loaded !== null);
    return loaded;
  } catch (error) {
    logPersistenceEvent("load", `attempt:${examId}`, false, error);
    return null;
  }
}

export function clearExamAttempt(examId: string, candidateRoll: string): void {
  try {
    getRepositories().attempts.clear(examId, candidateRoll);
    logPersistenceEvent("clear", `attempt:${examId}`, true);
  } catch (error) {
    logPersistenceEvent("clear", `attempt:${examId}`, false, error);
  }
}

/** Candidate session — unchanged API for auth-store / CBT. */
export function saveSession<T>(data: T): void {
  if (typeof window === "undefined") return;
  const ok = writeStorageJson("session", SESSION_KEY, data);
  logPersistenceEvent("save", "session", ok);
}

export function loadSession<T>(): T | null {
  if (typeof window === "undefined") return null;
  return readStorageJson({
    storage: "session",
    key: SESSION_KEY,
    fallback: null as T | null,
    validate: (data) => ({ ok: true, value: data as T }),
  });
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  removeStorageKey("session", SESSION_KEY);
  logPersistenceEvent("clear", "session", true);
}

export function saveCandidateSession(candidate: Candidate): void {
  getRepositories().students.saveSession(candidate);
}

export function loadCandidateSession(): Candidate | null {
  return getRepositories().students.getSession();
}

export function clearCandidateSession(): void {
  getRepositories().students.clearSession();
}
