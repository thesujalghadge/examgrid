import type {
  TestSessionIntegrityEvent,
  TestSessionIntegrityEventType,
} from "@/types/test-session";

export const INTEGRITY_FLAG_THRESHOLD = 60;

const PENALTIES: Record<TestSessionIntegrityEventType, number> = {
  tab_switch: 5,
  fullscreen_exit: 8,
  window_blur: 3,
  copy_attempt: 10,
  paste_attempt: 12,
  rapid_navigation: 4,
  browser_back: 6,
};

export function computeIntegrityScore(
  events: TestSessionIntegrityEvent[] = [],
): number {
  let score = 100;
  for (const e of events) {
    score -= PENALTIES[e.type] ?? 2;
  }
  return Math.max(0, Math.min(100, score));
}

export function isSessionFlagged(integrityScore: number): boolean {
  return integrityScore < INTEGRITY_FLAG_THRESHOLD;
}

const NAV_WINDOW_MS = 2000;
const NAV_BURST_COUNT = 4;

export function detectRapidNavigation(
  timestamps: number[],
  now = Date.now(),
): boolean {
  const recent = [...timestamps, now].filter((t) => now - t <= NAV_WINDOW_MS);
  return recent.length >= NAV_BURST_COUNT;
}

/**
 * Integrity violations (tab switch, window blur, etc.) flag an attempt for
 * manual review — they MUST NOT deduct marks from the academic score.
 * Academic scores are determined solely by correct/incorrect answers.
 * Returning 0 always is intentional and correct.
 */
export function integrityPenaltyPoints(_integrityScore: number, _maxScore: number): number {
  return 0;
}
