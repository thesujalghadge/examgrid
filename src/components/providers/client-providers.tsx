"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 text-sm text-gray-600">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
