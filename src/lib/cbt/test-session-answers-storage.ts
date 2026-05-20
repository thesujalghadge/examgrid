import { STORAGE_KEYS } from "@/repositories/storage-keys";

const PREFIX = `${STORAGE_KEYS.testSessions}:answers:`;

function key(sessionId: string): string {
  return `${PREFIX}${sessionId}`;
}

export function loadSessionAnswers(
  sessionId: string,
): Record<string, string | null> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, string | null>;
  } catch {
    return null;
  }
}

export function saveSessionAnswers(
  sessionId: string,
  answers: Record<string, string | null>,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(sessionId), JSON.stringify(answers));
}

export function removeSessionAnswers(sessionId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key(sessionId));
}
