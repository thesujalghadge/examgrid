"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SessionHydrationGate } from "@/components/auth/session-hydration-gate";
import { WorkspaceShell } from "@/components/shells/workspace-shell";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

const NAV = [
  { href: "/platform", label: "Operations" },
  { href: "/platform/institutes", label: "Institutes" },
  { href: "/platform/intelligence", label: "Intelligence" },
  { href: "/platform/question-bank", label: "Question Bank" },
  { href: "/platform/ingestion", label: "Ingestion" },
  { href: "/platform/system-health", label: "System Health" },
  { href: "/platform/review", label: "Review" },
  { href: "/platform/analytics", label: "Analytics" },
];

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useWorkspaceAuthStore((s) => s.session);
  const isHydrated = useWorkspaceAuthStore((s) => s.isHydrated);
  const logout = useWorkspaceAuthStore((s) => s.logout);

  useEffect(() => {
    if (!isHydrated || pathname === "/platform/login") return;
    if (!session || session.role !== "super_admin") {
      router.replace("/platform/login");
    }
  }, [isHydrated, pathname, router, session]);

  if (pathname === "/platform/login") return <>{children}</>;

  return (
    <SessionHydrationGate loginPath="/platform/login">
      {!session || session.role !== "super_admin" ? (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 text-sm text-gray-600">
          Checking access…
        </div>
      ) : (
        <WorkspaceShell
          title="Super Admin Platform"
          subtitle="Academic Infrastructure Layer"
          identity={session.userId}
          role={session.role}
          instituteId={session.instituteId}
          nav={NAV}
          footer={
            <div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  void logout();
                  router.push("/platform/login");
                }}
              >
                Logout
              </Button>
            </div>
          }
        >
          {children}
        </WorkspaceShell>
      )}
    </SessionHydrationGate>
  );
}
