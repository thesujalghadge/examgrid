import { computeTestAnalytics } from "@/services/test-analytics";
import { listTestSessionsForTest } from "@/services/test-session-engine";
import type { TestAnalytics } from "@/types/test-session";

/** Tenant-scoped analytics from local test sessions (primary in browser storage). */
export function getLocalTestAnalytics(
  testId: string,
  instituteId: string,
  studentNames: Record<string, string> = {},
): TestAnalytics {
  const sessions = listTestSessionsForTest(testId, instituteId);
  return computeTestAnalytics(testId, sessions, studentNames);
}

export async function fetchServerTestAnalytics(
  testId: string,
): Promise<TestAnalytics | null> {
  try {
    const res = await fetch(`/api/institute/analytics/test/${testId}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as TestAnalytics;
  } catch {
    return null;
  }
}
