"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getInstituteDisplayName } from "@/lib/platform-institute-registry";
import { WorkspaceShell } from "@/components/shells/workspace-shell";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

const NAV = [
  { href: "/student/tests", label: "Upcoming Tests" },
  { href: "/student/attempted", label: "Attempted Tests" },
  { href: "/student/reports", label: "Reports" },
  { href: "/student/analysis", label: "Analysis" },
  { href: "/student/pyq", label: "PYQ Practice" },
];

export function StudentShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const candidate = useAuthStore((s) => s.candidate);
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId);
  const workspaceLogout = useWorkspaceAuthStore((s) => s.logout);
  const logout = useAuthStore((s) => s.logout);

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
      title="Student Access"
      subtitle={getInstituteDisplayName(instituteId)}
      identity={`${candidate.name} | ${candidate.rollNumber}`}
      nav={NAV}
      footer={
        <Button
          variant="outline"
          size="sm"
          className="w-full bg-white"
          onClick={() => {
            logout();
            void workspaceLogout();
            router.push("/student/login");
          }}
        >
          Logout
        </Button>
      }
    >
      {children}
    </WorkspaceShell>
  );
}
