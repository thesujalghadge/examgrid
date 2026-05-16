import type { PersistedExamAttempt } from "@/types/exam";

const ATTEMPT_PREFIX = "examgrid:attempt:";
const SESSION_KEY = "examgrid:session";

export function getAttemptStorageKey(
  examId: string,
  candidateRoll: string,
): string {
  return `${ATTEMPT_PREFIX}${examId}:${candidateRoll}`;
}

export function saveExamAttempt(attempt: PersistedExamAttempt): void {
  if (typeof window === "undefined") return;
  const key = getAttemptStorageKey(attempt.examId, attempt.candidateRoll);
  localStorage.setItem(key, JSON.stringify(attempt));
}

export function loadExamAttempt(
  examId: string,
  candidateRoll: string,
): PersistedExamAttempt | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(
    getAttemptStorageKey(examId, candidateRoll),
  );
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedExamAttempt;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearExamAttempt(examId: string, candidateRoll: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getAttemptStorageKey(examId, candidateRoll));
}

export function saveSession<T>(data: T): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function loadSession<T>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}
