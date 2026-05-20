import type { TestResultBreakdown } from "@/types/test-session";

export interface CachedCbtSubmission {
  sessionId: string;
  testId: string;
  instituteId: string;
  studentId: string;
  submittedAt: number;
  score: number;
  maxScore: number;
  durationSeconds: number;
  flagged: boolean;
  integrityScore: number;
  resultBreakdown: TestResultBreakdown;
}

type Store = Map<string, CachedCbtSubmission[]>;

const globalKey = "__examgrid_cbt_results__";

function store(): Store {
  const g = globalThis as typeof globalThis & { [globalKey]?: Store };
  if (!g[globalKey]) g[globalKey] = new Map();
  return g[globalKey]!;
}

function cacheKey(instituteId: string, testId: string): string {
  return `${instituteId}:${testId}`;
}

export function cacheCbtSubmission(entry: CachedCbtSubmission): void {
  const key = cacheKey(entry.instituteId, entry.testId);
  const list = store().get(key) ?? [];
  const idx = list.findIndex((e) => e.sessionId === entry.sessionId);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  store().set(key, list);
}

export function listCachedSubmissions(
  instituteId: string,
  testId: string,
): CachedCbtSubmission[] {
  return [...(store().get(cacheKey(instituteId, testId)) ?? [])];
}
