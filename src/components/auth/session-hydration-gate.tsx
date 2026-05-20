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
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    if (!isHydrated) return;
    checkExpiry();
  }, [isHydrated, checkExpiry, session]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 text-sm text-gray-600">
        Validating session…
      </div>
    );
  }

  if (loginPath && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 text-sm text-gray-600">
        Redirecting to login…
      </div>
    );
  }

  return <>{children}</>;
}
