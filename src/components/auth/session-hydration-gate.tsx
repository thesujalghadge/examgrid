"use client";

import { useEffect } from "react";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

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

  useEffect(() => {
    if (isHydrated) return;
    void hydrateSession();
  }, [hydrateSession, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    checkExpiry();
  }, [checkExpiry, isHydrated, session]);

  if (!isHydrated) {
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
