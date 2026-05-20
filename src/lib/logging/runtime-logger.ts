export type LogCategory =
  | "repository"
  | "persistence"
  | "recovery"
  | "validation"
  | "cbt"
  | "session";

const PREFIX = "[ExamGrid]";

function emit(
  level: "info" | "warn" | "error",
  category: LogCategory,
  message: string,
  detail?: unknown,
): void {
  const line = `${PREFIX}:${category} ${message}`;
  if (level === "info") {
    if (detail !== undefined) console.info(line, detail);
    else console.info(line);
  } else if (level === "warn") {
    if (detail !== undefined) console.warn(line, detail);
    else console.warn(line);
  } else if (detail !== undefined) {
    console.error(line, detail);
  } else {
    console.error(line);
  }
}

export function logRepositoryMode(mode: string, detail?: string): void {
  emit("info", "repository", `mode=${mode}${detail ? ` — ${detail}` : ""}`);
}

export function logRepositoryFailure(
  operation: string,
  error: unknown,
): void {
  emit("error", "repository", `failure @ ${operation}`, error);
}

export function logPersistenceEvent(
  event: "save" | "load" | "clear",
  target: string,
  ok: boolean,
  detail?: unknown,
): void {
  const level = ok ? "info" : "warn";
  emit(
    level,
    "persistence",
    `${event} ${target} ${ok ? "ok" : "failed"}`,
    detail,
  );
}

export function logAutosaveFailure(examId: string, error: unknown): void {
  emit("warn", "persistence", `autosave failed exam=${examId}`, error);
}

export function logStorageRecovery(
  storageKey: string,
  reason: string,
): void {
  emit("warn", "recovery", `reset key=${storageKey} — ${reason}`);
}

export function logValidationFailure(
  context: string,
  error: string,
): void {
  emit("warn", "validation", `${context}: ${error}`);
}

export function logCbtGuard(event: string, detail?: unknown): void {
  emit("info", "cbt", event, detail);
}

export function logCbtWarning(event: string, detail?: unknown): void {
  emit("warn", "cbt", event, detail);
}

export function logSessionEvent(event: string, detail?: unknown): void {
  emit("info", "session", event, detail);
}

export function logSessionWarning(event: string, detail?: unknown): void {
  emit("warn", "session", event, detail);
}
