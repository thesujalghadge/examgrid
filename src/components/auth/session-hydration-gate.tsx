"use client";

import { useEffect, useState } from "react";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { hydrateSupabaseRepositories } from "@/lib/supabase/hydrate-repositories";

export function SessionHydrationGate({
  children,
  loginPath,
}: {
  children: React.ReactNode;
  loginPath?: string;
}) {
  const hydrateSession = useWorkspaceAuthStore((s) => s.hydrateSession);
  const isHydrated = useWorkspaceAuthStore((s) => s.isHydrated);
  const session = useWorkspaceAuthStore((s) => s.session);
  const checkExpiry = useWorkspaceAuthStore((s) => s.checkExpiry);
  const [reposHydrated, setReposHydrated] = useState(false);

  useEffect(() => {
    if (isHydrated) return;
    void hydrateSession();
  }, [hydrateSession, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    checkExpiry();
    if (session?.instituteId) {
      setReposHydrated(false);
      hydrateSupabaseRepositories().then(() => setReposHydrated(true));
    } else {
      setReposHydrated(true); // If no institute session, just let it pass
    }
  }, [checkExpiry, isHydrated, session]);

  if (!isHydrated || !reposHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f1e8] text-sm text-[#5e5a52]">
        Validating session...
      </div>
    );
  }

  if (loginPath && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f1e8] text-sm text-[#5e5a52]">
        Redirecting to login...
      </div>
    );
  }

  return <>{children}</>;
}
