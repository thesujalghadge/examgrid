import {
  logAutosaveFailure,
  logPersistenceEvent,
  logValidationFailure,
} from "@/lib/logging/runtime-logger";
import { parsePersistedExamAttempt } from "@/lib/validation/attempt-schema";
import { readStorageJson, writeStorageJson, removeStorageKey } from "@/lib/storage/safe-json";
import type { PersistedExamAttempt } from "@/types/exam";
import type { Candidate } from "@/types/exam";
import { getRepositories } from "@/lib/repositories/provider";

export function getAttemptStorageKey(examId: string, candidateRoll: string): string {
  return `examgrid:attempt:${examId}:${candidateRoll}`;
}

const SESSION_KEY = "examgrid:session";

export function saveExamAttempt(attempt: PersistedExamAttempt): boolean {
  const parsed = parsePersistedExamAttempt(attempt);
  if (!parsed.success) {
    logValidationFailure("saveExamAttempt", parsed.error);
    logPersistenceEvent("save", `attempt:${attempt.examId}`, false, parsed.error);
    return false;
  }
  try {
    const key = getAttemptStorageKey(attempt.examId, attempt.candidateRoll);
    localStorage.setItem(key, JSON.stringify(parsed.data));
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
    if (typeof window === "undefined") return null;
    const key = getAttemptStorageKey(examId, candidateRoll);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    logPersistenceEvent("load", `attempt:${examId}`, true);
    return parsed;
  } catch (error) {
    logPersistenceEvent("load", `attempt:${examId}`, false, error);
    return null;
  }
}

export function clearExamAttempt(examId: string, candidateRoll: string): void {
  try {
    if (typeof window === "undefined") return;
    const key = getAttemptStorageKey(examId, candidateRoll);
    localStorage.removeItem(key);
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
