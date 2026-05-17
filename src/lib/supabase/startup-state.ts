import type { SupabaseConnectionStatus } from "@/lib/supabase/check-connection";
import type { RepositoryMode } from "@/config/repository";

export interface HydrationDiagnostics {
  ok: boolean;
  questionsCount: number;
  examsCount: number;
  studentsCount: number;
  batchesCount: number;
  schedulesCount: number;
  durationMs: number;
  error?: string;
  completedAt: string;
}

export interface StartupDiagnosticsSnapshot {
  repositoryMode: RepositoryMode;
  supabaseConnection: SupabaseConnectionStatus | "skipped";
  supabaseMessage: string;
  hydration: HydrationDiagnostics | null;
  ready: boolean;
  startedAt: string;
  completedAt: string;
}

let snapshot: StartupDiagnosticsSnapshot | null = null;

export function setStartupDiagnostics(next: StartupDiagnosticsSnapshot): void {
  snapshot = next;
}

export function getStartupDiagnostics(): StartupDiagnosticsSnapshot | null {
  return snapshot;
}

export function isRepositoryReady(): boolean {
  return snapshot?.ready ?? false;
}
