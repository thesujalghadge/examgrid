"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DEMO_INSTITUTE } from "@/config/demo";
import { SessionHydrationGate } from "@/components/auth/session-hydration-gate";
import { WorkspaceShell } from "@/components/shells/workspace-shell";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

const NAV = [
  { href: "/institute/dashboard", label: "Dashboard" },
  { href: "/institute/students", label: "Students" },
  { href: "/institute/batches", label: "Batches" },
  { href: "/institute/tests", label: "Tests" },
  { href: "/institute/analytics", label: "Analytics" },
  { href: "/institute/question-bank", label: "Question Bank" },
  { href: "/institute/settings", label: "Settings" },
];

export function InstituteShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useWorkspaceAuthStore((s) => s.session);
  const isHydrated = useWorkspaceAuthStore((s) => s.isHydrated);
  const logout = useWorkspaceAuthStore((s) => s.logout);

  useEffect(() => {
    if (!isHydrated || pathname === "/institute/login") return;
    const invalidRole =
      !session ||
      (session.role !== "institute_admin" && session.role !== "teacher");
    const missingTenant =
      session &&
      session.role !== "super_admin" &&
      !session.instituteId;
    if (invalidRole) {
      router.replace("/institute/login");
      return;
    }
    if (missingTenant) {
      void logout();
      router.replace("/institute/login");
    }
  }, [isHydrated, logout, pathname, router, session]);

  if (pathname === "/institute/login") return <>{children}</>;

  const ready =
    session &&
    (session.role === "institute_admin" || session.role === "teacher") &&
    Boolean(session.instituteId);

  return (
    <SessionHydrationGate loginPath="/institute/login">
      {!ready ? (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 text-sm text-gray-600">
          Validating institute workspace…
        </div>
      ) : (
        <WorkspaceShell
          title="Institute Workspace"
          subtitle={DEMO_INSTITUTE.name}
          identity={`${session.userId} · tenant ${session.instituteId}`}
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
                  router.push("/institute/login");
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
