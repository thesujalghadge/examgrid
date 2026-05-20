"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DEMO_INSTITUTE } from "@/config/demo";
import { WorkspaceShell } from "@/components/shells/workspace-shell";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

const NAV = [
  { href: "/student/dashboard", label: "Dashboard" },
  { href: "/student/tests", label: "Tests" },
  { href: "/student/practice", label: "Practice" },
  { href: "/student/analytics", label: "Analytics" },
  { href: "/student/revision", label: "Revision" },
  { href: "/student/question-bank", label: "Question Bank" },
  { href: "/student/profile", label: "Profile" },
];

export function StudentShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrateWorkspace = useWorkspaceAuthStore((s) => s.hydrateSession);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const candidate = useAuthStore((s) => s.candidate);
  const workspaceSession = useWorkspaceAuthStore((s) => s.session);
  const workspaceLogout = useWorkspaceAuthStore((s) => s.logout);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    hydrate();
    void hydrateWorkspace();
  }, [hydrate, hydrateWorkspace]);

  useEffect(() => {
    if (!isHydrated || pathname === "/student/login") return;
    if (!candidate) router.replace("/student/login");
  }, [candidate, isHydrated, pathname, router]);

  if (pathname === "/student/login") return <>{children}</>;
  if (!isHydrated || !candidate) return null;

  const isCbtTestDeepRoute =
    pathname.startsWith("/student/tests/") &&
    pathname.length > "/student/tests/".length;
  if (isCbtTestDeepRoute) return <>{children}</>;

  return (
    <WorkspaceShell
      title="Student Experience"
      subtitle={DEMO_INSTITUTE.name}
      identity={`${candidate.name} · ${candidate.rollNumber}`}
      role={workspaceSession?.role ?? "student"}
      instituteId={workspaceSession?.instituteId}
      nav={NAV}
      footer={
        <div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              logout();
              workspaceLogout();
              router.push("/student/login");
            }}
          >
            Logout
          </Button>
        </div>
      }
    >
      {children}
    </WorkspaceShell>
  );
}
