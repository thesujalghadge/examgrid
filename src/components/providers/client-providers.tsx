"use client";

import { useEffect, useState } from "react";
import { getRepositoryMode, getRepositories } from "@/lib/repositories/provider";
import {
  logStartupSummary,
  runStartupDiagnostics,
} from "@/lib/supabase/startup-diagnostics";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

const STUDENT_IDLE_TIMEOUT_MS = 45 * 60 * 1000;
const STUDENT_ABSOLUTE_TIMEOUT_MS = 6 * 60 * 60 * 1000;

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const isAuthHydrated = useAuthStore((s) => s.isHydrated);
  const candidate = useAuthStore((s) => s.candidate);
  const touchAuth = useAuthStore((s) => s.touch);
  const expireAuth = useAuthStore((s) => s.expire);
  const hydrateWorkspaceAuth = useWorkspaceAuthStore((s) => s.hydrateSession);
  const isWorkspaceHydrated = useWorkspaceAuthStore((s) => s.isHydrated);
  const [reposReady, setReposReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        getRepositories();

        const startup = await runStartupDiagnostics();
        if (cancelled) return;
        logStartupSummary(startup);
      } finally {
        if (cancelled) return;
        hydrateAuth();
        await hydrateWorkspaceAuth();
        setReposReady(true);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [hydrateAuth, hydrateWorkspaceAuth]);

  useEffect(() => {
    if (!candidate) return;
    const markActivity = () => touchAuth();
    window.addEventListener("click", markActivity);
    window.addEventListener("keydown", markActivity);
    return () => {
      window.removeEventListener("click", markActivity);
      window.removeEventListener("keydown", markActivity);
    };
  }, [candidate, touchAuth]);

  useEffect(() => {
    if (!candidate) return;
    const timer = window.setInterval(() => {
      const raw = sessionStorage.getItem("examgrid:session");
      if (!raw) return;
      try {
        const session = JSON.parse(raw) as {
          sessionStartedAtUTC?: string;
          lastActivityAtUTC?: string;
        };
        const now = Date.now();
        const started = new Date(session.sessionStartedAtUTC ?? now).getTime();
        const last = new Date(session.lastActivityAtUTC ?? started).getTime();
        if (now - last > STUDENT_IDLE_TIMEOUT_MS) {
          expireAuth("idle_timeout");
        } else if (now - started > STUDENT_ABSOLUTE_TIMEOUT_MS) {
          expireAuth("absolute_timeout");
        }
      } catch {
        expireAuth("corrupt_session");
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [candidate, expireAuth]);

  if (!isAuthHydrated || !isWorkspaceHydrated || !reposReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-[#f5f1e8] text-sm text-[#5e5a52]">
        <p>Loading operational workspace...</p>
        {getRepositoryMode() === "supabase" && (
          <p className="text-xs text-[#8a857c]">
            Connecting to Supabase and hydrating repositories...
          </p>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
