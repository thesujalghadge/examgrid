"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DEMO_INSTITUTE } from "@/config/demo";
import { WorkspaceShell } from "@/components/shells/workspace-shell";
import { useParentAccessStore } from "@/stores/parent-access-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

const NAV = [
  { href: "/parent", label: "Overview" },
  { href: "/parent/reports", label: "Reports" },
];

export function ParentShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useWorkspaceAuthStore((s) => s.session);
  const workspaceHydrated = useWorkspaceAuthStore((s) => s.isHydrated);
  const workspaceLogout = useWorkspaceAuthStore((s) => s.logout);
  const linkedStudent = useParentAccessStore((s) => s.linkedStudent);
  const parentHydrated = useParentAccessStore((s) => s.isHydrated);
  const parentLogout = useParentAccessStore((s) => s.logout);

  useEffect(() => {
    if (!workspaceHydrated || !parentHydrated || pathname === "/parent/login") return;
    if (!session || session.role !== "parent" || !linkedStudent) {
      parentLogout();
      void workspaceLogout();
      router.replace("/parent/login");
    }
  }, [
    linkedStudent,
    parentHydrated,
    parentLogout,
    pathname,
    router,
    session,
    workspaceHydrated,
    workspaceLogout,
  ]);

  if (pathname === "/parent/login") return <>{children}</>;
  if (!session || session.role !== "parent" || !linkedStudent) return null;

  return (
    <WorkspaceShell
      title="Parent Access"
      subtitle={DEMO_INSTITUTE.name}
      identity={`${linkedStudent.fullName} | ${linkedStudent.rollNumber}`}
      nav={NAV}
      footer={
        <Button
          variant="outline"
          size="sm"
          className="w-full bg-white"
          onClick={() => {
            parentLogout();
            void workspaceLogout();
            router.push("/parent/login");
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
