const PREFIX = "examgrid:attempt:";

function key(attemptId: string): string {
  return `${PREFIX}${attemptId}:answers`;
}

export function loadSessionAnswers(attemptId: string): Record<string, string | null> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(attemptId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.answers as Record<string, string | null>;
  } catch {
    return null;
  }
}

export function saveSessionAnswers(attemptId: string, answers: Record<string, string | null>): void {
  if (typeof window === "undefined") return;
  const payload = {
    updatedAt: Date.now(),
    answers
  };
  localStorage.setItem(key(attemptId), JSON.stringify(payload));
}

export function removeSessionAnswers(attemptId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key(attemptId));
}

export function cleanupOldSessions(): void {
  if (typeof window === "undefined") return;
  try {
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (now - parsed.updatedAt > SEVEN_DAYS) {
              localStorage.removeItem(k);
            }
          } catch {
            localStorage.removeItem(k);
          }
        }
      }
    }
  } catch (e) {
    console.error("Cleanup failed", e);
  }
}
