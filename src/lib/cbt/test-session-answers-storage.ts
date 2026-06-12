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
    if (!raw) {
      console.log(`[loadSessionAnswers] No answers found for ${sessionId}`);
      return null;
    }
    const parsed = JSON.parse(raw) as Record<string, string | null>;
    console.log(`[loadSessionAnswers] Loaded ${Object.keys(parsed).length} answers for ${sessionId}`);
    return parsed;
  } catch {
    return null;
  }
}

export function saveSessionAnswers(
  sessionId: string,
  answers: Record<string, string | null>,
): void {
  if (typeof window === "undefined") return;
  console.log(`[saveSessionAnswers] Persisting ${Object.keys(answers).length} answers to localStorage for ${sessionId}`);
  localStorage.setItem(key(sessionId), JSON.stringify(answers));
}

export function removeSessionAnswers(sessionId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key(sessionId));
}
