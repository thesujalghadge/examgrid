import { getRepositoryMode } from "@/lib/repositories/provider";
import {
  logRepositoryFailure,
  logRepositoryMode,
} from "@/lib/logging/runtime-logger";
import { checkSupabaseConnectionClient } from "@/lib/supabase/check-connection";
import { getClientEnvConfig } from "@/lib/supabase/env-config";
import { hydrateSupabaseRepositories } from "@/lib/supabase/hydrate-repositories";
import {
  setStartupDiagnostics,
  type StartupDiagnosticsSnapshot,
} from "@/lib/supabase/startup-state";

/**
 * Runs once on client boot: logs mode, Supabase reachability, hydration.
 */
export async function runStartupDiagnostics(): Promise<StartupDiagnosticsSnapshot> {
  const startedAt = new Date().toISOString();
  const mode = getRepositoryMode();
  const env = getClientEnvConfig();

  logRepositoryMode(
    mode,
    env.supabaseModeActive
      ? `institute=${env.instituteId}`
      : "browser localStorage",
  );

  let supabaseConnection: StartupDiagnosticsSnapshot["supabaseConnection"] =
    "skipped";
  let supabaseMessage = "Supabase checks skipped (local repository mode).";

  if (mode === "supabase") {
    if (!env.allRequiredForSupabase) {
      supabaseConnection = "not_configured";
      supabaseMessage = `Missing env: ${env.issues.join("; ")}`;
      console.warn(`[ExamGrid:startup] ${supabaseMessage}`);
    } else {
      const report = await checkSupabaseConnectionClient();
      supabaseConnection = report.connection;
      supabaseMessage = report.message;
      console.info(
        `[ExamGrid:startup] Supabase connectivity: ${report.connection} — ${report.message}`,
      );
    }
  }

  let hydration: StartupDiagnosticsSnapshot["hydration"] = null;
  /** Hydration succeeded (supabase mode only). App still loads if false. */
  let ready = mode !== "supabase";

  if (mode === "supabase" && env.allRequiredForSupabase) {
    const t0 = performance.now();
    const result = await hydrateSupabaseRepositories();
    const durationMs = Math.round(performance.now() - t0);

    hydration = {
      ok: result.ok,
      questionsCount: result.questionsCount,
      examsCount: result.examsCount,
      durationMs,
      error: result.error,
      completedAt: new Date().toISOString(),
    };

    ready = result.ok;

    if (result.ok) {
      console.info(
        `[ExamGrid:startup] Hydration OK — ${result.questionsCount} questions, ${result.examsCount} exams (${durationMs}ms)`,
      );
    } else {
      console.error(
        `[ExamGrid:startup] Hydration FAILED (${durationMs}ms):`,
        result.error,
      );
    }
  } else if (mode === "supabase") {
    ready = false;
  }

  const completedAt = new Date().toISOString();
  const snap: StartupDiagnosticsSnapshot = {
    repositoryMode: mode,
    supabaseConnection,
    supabaseMessage,
    hydration,
    ready,
    startedAt,
    completedAt,
  };

  setStartupDiagnostics(snap);
  return snap;
}

export function logStartupSummary(snap: StartupDiagnosticsSnapshot): void {
  if (snap.repositoryMode !== "supabase") return;
  if (!snap.ready) {
    logRepositoryFailure("startup", {
      hydration: snap.hydration,
      supabase: snap.supabaseMessage,
    });
  }
}
