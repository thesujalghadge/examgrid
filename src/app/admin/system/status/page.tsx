"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SupabaseStatusReport } from "@/lib/supabase/check-connection";
import type { RepositoryMode } from "@/config/repository";
import {
  getRepositoryDiagnostics,
  type RepositoryDiagnostics,
} from "@/lib/repositories/diagnostics";
import { migrateLocalToSupabase } from "@/lib/migration/local-to-supabase";
import { getClientEnvConfig } from "@/lib/supabase/env-config";
import { getStartupDiagnostics } from "@/lib/supabase/startup-state";
import {
  refreshHydrationDiagnostics,
  runFullSupabaseVerification,
  type SupabaseVerificationReport,
} from "@/lib/supabase/supabase-verification";
import {
  clearAllExamAttempts,
} from "@/lib/test-helpers/dev-environment";
import { cn } from "@/lib/utils";

interface RepositoryStatus {
  mode: RepositoryMode;
  label: string;
  persistence: string;
}

interface ServerEnvStatus {
  repositoryMode: RepositoryMode;
  repositoryModeRaw: string | null;
  supabaseUrlLoaded: boolean;
  supabaseAnonKeyLoaded: boolean;
  instituteId: string;
  instituteIdFromEnv: string | null;
  supabaseModeActive: boolean;
}

interface SystemStatusResponse {
  supabase: SupabaseStatusReport;
  repository: RepositoryStatus;
  env: ServerEnvStatus;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AdminSystemStatusPage() {
  const clientEnv = getClientEnvConfig();
  const startup = getStartupDiagnostics();

  const [supabase, setSupabase] = useState<SupabaseStatusReport | null>(null);
  const [repository, setRepository] = useState<RepositoryStatus | null>(null);
  const [serverEnv, setServerEnv] = useState<ServerEnvStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<RepositoryDiagnostics | null>(
    null,
  );
  const [verification, setVerification] =
    useState<SupabaseVerificationReport | null>(null);
  const [hydration, setHydration] = useState<{
    ok: boolean;
    questionsCount: number;
    examsCount: number;
    studentsCount?: number;
    batchesCount?: number;
    schedulesCount?: number;
    durationMs: number;
    error?: string;
  } | null>(startup?.hydration ?? null);

  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const isDev = process.env.NODE_ENV !== "production";

  const refreshDiagnostics = useCallback(() => {
    if (typeof window !== "undefined") {
      setDiagnostics(getRepositoryDiagnostics());
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/supabase-status", {
        cache: "no-store",
      });
      const data = (await res.json()) as SystemStatusResponse;
      setSupabase(data.supabase);
      setRepository(data.repository);
      setServerEnv(data.env);
    } catch {
      setSupabase({
        configured: false,
        urlLoaded: false,
        anonKeyLoaded: false,
        connection: "connection_failed",
        message: "Failed to run status check API.",
        checkedAt: new Date().toISOString(),
      });
      setRepository(null);
      setServerEnv(null);
    } finally {
      refreshDiagnostics();
      setLoading(false);
    }
  }, [refreshDiagnostics]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const runVerification = async () => {
    setVerifying(true);
    try {
      const report = await runFullSupabaseVerification();
      setVerification(report);
      const h = await refreshHydrationDiagnostics();
      setHydration(h);
      refreshDiagnostics();
    } finally {
      setVerifying(false);
    }
  };

  const modeMatch =
    serverEnv &&
    clientEnv.repositoryMode === serverEnv.repositoryMode &&
    clientEnv.supabaseModeActive === serverEnv.supabaseModeActive;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Status</h1>
          <p className="text-sm text-gray-600">
            Verify Supabase persistence before Phase 5. Attempts remain local.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            {loading ? "Checking…" : "Re-check"}
          </Button>
          {clientEnv.supabaseModeActive && (
            <Button
              onClick={() => void runVerification()}
              disabled={verifying}
              className="bg-[#1a3c6e] text-white hover:bg-[#152d52]"
            >
              {verifying ? "Running…" : "Run full verification"}
            </Button>
          )}
        </div>
      </div>

      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-base">Schema setup guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-700">
          <p>
            Run SQL in this order in Supabase SQL Editor:{" "}
            <code className="rounded bg-white px-1 text-xs">institutes</code> →{" "}
            <code className="rounded bg-white px-1 text-xs">seed</code> →{" "}
            <code className="rounded bg-white px-1 text-xs">questions</code> →{" "}
            <code className="rounded bg-white px-1 text-xs">exams</code> →{" "}
            <code className="rounded bg-white px-1 text-xs">exam_sections</code>{" "}
            →{" "}
            <code className="rounded bg-white px-1 text-xs">exam_questions</code>{" "}
            → <code className="rounded bg-white px-1 text-xs">rls-dev</code>
          </p>
          <p className="text-xs text-gray-500">
            Full instructions:{" "}
            <code className="rounded bg-white px-1">supabase/schema/SETUP.md</code>{" "}
            in the repo. Expected tables: institutes, questions, exams,
            exam_sections, exam_questions.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatusRow
            label="NEXT_PUBLIC_REPOSITORY_MODE (client)"
            value={clientEnv.repositoryModeRaw ?? clientEnv.repositoryMode}
            ok={clientEnv.supabaseModeActive}
          />
          <StatusRow
            label="NEXT_PUBLIC_REPOSITORY_MODE (server)"
            value={serverEnv?.repositoryModeRaw ?? serverEnv?.repositoryMode ?? "—"}
            ok={serverEnv?.supabaseModeActive ?? false}
          />
          <StatusRow
            label="Client/server mode match"
            value={modeMatch ? "Yes" : "Mismatch — restart dev server"}
            ok={Boolean(modeMatch)}
          />
          <StatusRow
            label="NEXT_PUBLIC_SUPABASE_URL"
            value={clientEnv.supabaseUrlLoaded ? "Loaded" : "Missing"}
            ok={clientEnv.supabaseUrlLoaded}
          />
          <StatusRow
            label="NEXT_PUBLIC_SUPABASE_ANON_KEY"
            value={clientEnv.supabaseAnonKeyLoaded ? "Loaded" : "Missing"}
            ok={clientEnv.supabaseAnonKeyLoaded}
          />
          <StatusRow
            label="NEXT_PUBLIC_DEFAULT_INSTITUTE_ID"
            value={clientEnv.instituteId}
            ok={clientEnv.instituteIdLoaded}
          />
          <StatusRow
            label="Supabase mode fully configured"
            value={clientEnv.allRequiredForSupabase ? "Yes" : "No"}
            ok={clientEnv.allRequiredForSupabase}
          />
          {clientEnv.issues.length > 0 && (
            <p className="text-xs text-amber-700">{clientEnv.issues.join("; ")}</p>
          )}
          {repository && (
            <p className="text-xs text-gray-500">{repository.persistence}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Startup & hydration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {startup ? (
            <>
              <StatusRow
                label="Repository readiness"
                value={startup.ready ? "Ready" : "Hydration failed"}
                ok={startup.ready}
              />
              <StatusRow
                label="Startup Supabase connectivity"
                value={startup.supabaseConnection.replace(/_/g, " ")}
                ok={startup.supabaseConnection === "connected"}
              />
              <p className="text-xs text-gray-600">{startup.supabaseMessage}</p>
              {startup.hydration && (
                <>
                  <StatusRow
                    label="Hydration status"
                    value={startup.hydration.ok ? "Success" : "Failed"}
                    ok={startup.hydration.ok}
                  />
                  <StatusRow
                    label="Questions loaded (startup)"
                    value={String(startup.hydration.questionsCount)}
                    ok
                  />
                  <StatusRow
                    label="Exams loaded (startup)"
                    value={String(startup.hydration.examsCount)}
                    ok
                  />
                  <StatusRow
                    label="Hydration duration (startup)"
                    value={`${startup.hydration.durationMs} ms`}
                    ok
                  />
                  {startup.hydration.error && (
                    <p className="text-xs text-red-700">
                      {startup.hydration.error}
                    </p>
                  )}
                </>
              )}
              <p className="text-xs text-gray-400">
                Startup completed:{" "}
                {new Date(startup.completedAt).toLocaleString()}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              No startup snapshot yet. Reload the app to run diagnostics.
            </p>
          )}
          {hydration && (
            <>
              <p className="border-t border-gray-100 pt-2 text-xs font-medium text-gray-500">
                Latest hydration (manual refresh / verification)
              </p>
              <StatusRow
                label="Questions in cache"
                value={String(hydration.questionsCount)}
                ok
              />
              <StatusRow
                label="Exams in cache"
                value={String(hydration.examsCount)}
                ok
              />
              <StatusRow
                label="Duration"
                value={`${hydration.durationMs} ms`}
                ok={hydration.ok}
              />
            </>
          )}
          {clientEnv.supabaseModeActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void (async () => {
                  const h = await refreshHydrationDiagnostics();
                  setHydration(h);
                  refreshDiagnostics();
                })();
              }}
            >
              Re-hydrate repositories
            </Button>
          )}
        </CardContent>
      </Card>

      {verification && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supabase verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-gray-400">
              Ran: {new Date(verification.ranAt).toLocaleString()}
            </p>
            <StatusRow
              label="Overall"
              value={
                verification.tables.every((t) => t.ok) &&
                verification.smokeTest?.ok &&
                verification.examPersistence?.ok
                  ? "Pass"
                  : "Issues"
              }
              ok={
                verification.tables.every((t) => t.ok) &&
                Boolean(verification.smokeTest?.ok) &&
                Boolean(verification.examPersistence?.ok)
              }
            />
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">
                Table access
              </p>
              {verification.tables.map((t) => (
                <StatusRow
                  key={t.table}
                  label={t.table}
                  value={
                    t.ok
                      ? `${t.rowCount ?? 0} row(s)`
                      : (t.error ?? "failed")
                  }
                  ok={t.ok}
                />
              ))}
            </div>
            {verification.smokeTest && (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">
                  Question smoke test ({verification.smokeTest.durationMs} ms)
                </p>
                <StatusRow
                  label="Result"
                  value={verification.smokeTest.ok ? "Pass" : "Fail"}
                  ok={verification.smokeTest.ok}
                />
                {verification.smokeTest.steps.map((s) => (
                  <StatusRow
                    key={s.step}
                    label={s.step}
                    value={s.ok ? "OK" : (s.detail ?? "failed")}
                    ok={s.ok}
                  />
                ))}
              </div>
            )}
            {verification.examPersistence && (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">
                  Exam persistence test (
                  {verification.examPersistence.durationMs} ms)
                </p>
                <StatusRow
                  label="Result"
                  value={verification.examPersistence.ok ? "Pass" : "Fail"}
                  ok={verification.examPersistence.ok}
                />
                {verification.examPersistence.steps.map((s) => (
                  <StatusRow
                    key={s.step}
                    label={s.step}
                    value={s.ok ? "OK" : (s.detail ?? "failed")}
                    ok={s.ok}
                  />
                ))}
              </div>
            )}
            <StatusRow
              label="Repository cache after test"
              value={`${verification.cacheQuestions} questions, ${verification.cacheExams} exams`}
              ok
            />
          </CardContent>
        </Card>
      )}

      {diagnostics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Local persistence (attempts)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow
              label="Overall health"
              value={diagnostics.healthy ? "Healthy" : "Issues detected"}
              ok={diagnostics.healthy}
            />
            <StatusRow
              label="Saved attempts (localStorage)"
              value={String(diagnostics.attemptKeyCount)}
              ok
            />
            <StatusRow
              label="Audit log health"
              value={`${diagnostics.auditLogCount} event(s)`}
              ok
            />
            <StatusRow
              label="Failed/blocked operations"
              value={String(diagnostics.failedOperationCount)}
              ok={diagnostics.failedOperationCount === 0}
            />
            <StatusRow
              label="Session metrics"
              value={`${diagnostics.sessionMetricCount} session record(s)`}
              ok
            />
            <StatusRow
              label="localStorage usage"
              value={formatBytes(diagnostics.localStorageBytes)}
              ok
            />
            <p className="text-xs text-gray-500">
              CBT attempts intentionally remain in localStorage in Supabase mode.
            </p>
          </CardContent>
        </Card>
      )}

      {supabase && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supabase API (server)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow
              label="Connection"
              value={supabase.connection.replace(/_/g, " ")}
              ok={supabase.connection === "connected"}
            />
            <p className="rounded bg-gray-50 p-3 text-sm text-gray-700">
              {supabase.message}
            </p>
            <p className="text-xs text-gray-400">
              Last checked: {new Date(supabase.checkedAt).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      )}

      {isDev && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dev helpers</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const n = clearAllExamAttempts();
                refreshDiagnostics();
                alert(`Cleared ${n} attempt(s).`);
              }}
            >
              Clear all attempts
            </Button>
            {clientEnv.supabaseModeActive && (
              <Button
                variant="outline"
                size="sm"
                disabled={migrating}
                onClick={() => {
                  void (async () => {
                    if (
                      !confirm(
                        "Copy question bank and exams from localStorage into Supabase?",
                      )
                    ) {
                      return;
                    }
                    setMigrating(true);
                    const result = await migrateLocalToSupabase();
                    setMigrating(false);
                    const h = await refreshHydrationDiagnostics();
                    setHydration(h);
                    refreshDiagnostics();
                    if (result.success) {
                      alert(
                        `Migrated ${result.questionsMigrated} questions and ${result.examsMigrated} exams.`,
                      );
                    } else {
                      alert(`Migration failed:\n${result.errors.join("\n")}`);
                    }
                  })();
                }}
              >
                {migrating ? "Migrating…" : "Migrate local → Supabase"}
              </Button>
            )}
            <p className="w-full text-xs text-gray-500">
              Console: <code className="rounded bg-gray-100 px-1">__EXAMGRID_DEV__</code>
            </p>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-gray-400">
        <Link href="/admin" className="underline hover:text-gray-600">
          Back to admin
        </Link>
      </p>
    </div>
  );
}

function StatusRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-2 text-sm last:border-0">
      <span className="text-gray-600">{label}</span>
      <span
        className={cn(
          "max-w-[55%] truncate text-right font-medium",
          ok ? "text-green-700" : "text-amber-700",
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
