import { logStorageRecovery } from "@/lib/logging/runtime-logger";

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function parseJsonSafe(raw: string): ParseResult<unknown> {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
}

export interface ReadStorageOptions<T> {
  storage: "local" | "session";
  key: string;
  fallback: T;
  validate: (data: unknown) => ParseResult<T>;
  onCorrupt?: (reason: string) => void;
}

function getStorage(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  return kind === "local" ? localStorage : sessionStorage;
}

export function readStorageJson<T>(options: ReadStorageOptions<T>): T {
  const store = getStorage(options.storage);
  if (!store) return options.fallback;

  const raw = store.getItem(options.key);
  if (!raw) return options.fallback;

  const parsed = parseJsonSafe(raw);
  if (!parsed.ok) {
    store.removeItem(options.key);
    logStorageRecovery(options.key, parsed.error);
    options.onCorrupt?.(parsed.error);
    return options.fallback;
  }

  const validated = options.validate(parsed.value);
  if (!validated.ok) {
    store.removeItem(options.key);
    logStorageRecovery(options.key, validated.error);
    options.onCorrupt?.(validated.error);
    return options.fallback;
  }

  return validated.value;
}

export function writeStorageJson(
  storage: "local" | "session",
  key: string,
  value: unknown,
): boolean {
  const store = getStorage(storage);
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorageKey(
  storage: "local" | "session",
  key: string,
): void {
  getStorage(storage)?.removeItem(key);
}

export function estimateStorageBytes(storage: "local" | "session"): number {
  const store = getStorage(storage);
  if (!store) return 0;
  let total = 0;
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key) continue;
    const val = store.getItem(key) ?? "";
    total += key.length + val.length;
  }
  return total * 2;
}
