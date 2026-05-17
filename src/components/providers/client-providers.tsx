"use client";

import { useEffect, useState } from "react";
import { getRepositoryMode } from "@/lib/repositories/provider";
import { getRepositories } from "@/lib/repositories/provider";
import {
  logStartupSummary,
  runStartupDiagnostics,
} from "@/lib/supabase/startup-diagnostics";
import { installDevHelpers } from "@/lib/test-helpers/dev-environment";
import { useAuthStore } from "@/stores/auth-store";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const isAuthHydrated = useAuthStore((s) => s.isHydrated);
  const [reposReady, setReposReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      getRepositories();
      installDevHelpers();

      const startup = await runStartupDiagnostics();
      if (!cancelled) {
        logStartupSummary(startup);
        hydrateAuth();
        setReposReady(true);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [hydrateAuth]);

  if (!isAuthHydrated || !reposReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-gray-100 text-sm text-gray-600">
        <p>Loading…</p>
        {getRepositoryMode() === "supabase" && (
          <p className="text-xs text-gray-400">
            Connecting to Supabase and hydrating repositories…
          </p>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
