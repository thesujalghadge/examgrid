"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getInstituteDisplayName } from "@/lib/platform-institute-registry";
import { SessionHydrationGate } from "@/components/auth/session-hydration-gate";
import { WorkspaceShell } from "@/components/shells/workspace-shell";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

const NAV = [
  { href: "/institute", label: "Overview" },
  { href: "/institute/students", label: "Students" },
  { href: "/institute/batches", label: "Batches" },
  { href: "/institute/tests", label: "Conduct CBT" },
  { href: "/institute/analysis", label: "Analysis" },
  { href: "/institute/reports", label: "Reports" },
];

export function InstituteShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useWorkspaceAuthStore((s) => s.session);
  const isHydrated = useWorkspaceAuthStore((s) => s.isHydrated);
  const logout = useWorkspaceAuthStore((s) => s.logout);

  useEffect(() => {
    if (!isHydrated || pathname === "/institute/login") return;
    const invalidRole = !session || session.role !== "institute";
    const missingTenant = session && !session.instituteId;
    if (invalidRole || missingTenant) {
      void logout();
      router.replace("/institute/login");
    }
  }, [isHydrated, logout, pathname, router, session]);

  if (pathname === "/institute/login") return <>{children}</>;

  const ready = session && session.role === "institute" && Boolean(session.instituteId);

  return (
    <SessionHydrationGate loginPath="/institute/login">
      {!ready ? (
        <div className="flex min-h-screen items-center justify-center bg-[#f5f1e8] text-sm text-[#5e5a52]">
          Validating institute workspace...
        </div>
      ) : (
        <WorkspaceShell
          title="Institute Operations"
          subtitle={getInstituteDisplayName(session.instituteId)}
          identity={`${session.userId} | ${session.instituteId}`}
          nav={NAV}
          footer={
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-white"
              onClick={() => {
                void logout();
                router.push("/institute/login");
              }}
            >
              Logout
            </Button>
          }
        >
          {children}
        </WorkspaceShell>
      )}
    </SessionHydrationGate>
  );
}
