"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { WorkspaceShell } from "@/components/shells/workspace-shell";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

const NAV = [
  { href: "/platform", label: "Overview" },
  { href: "/platform/institutes", label: "Institutes" },
  { href: "/platform/monitoring", label: "Monitoring" },
];

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useWorkspaceAuthStore((s) => s.session);
  const isHydrated = useWorkspaceAuthStore((s) => s.isHydrated);
  const logout = useWorkspaceAuthStore((s) => s.logout);

  useEffect(() => {
    if (!isHydrated || pathname === "/platform/login") return;
    if (!session || session.role !== "platform_admin") {
      void logout();
      router.replace("/platform/login");
    }
  }, [isHydrated, logout, pathname, router, session]);

  if (pathname === "/platform/login") return <>{children}</>;
  if (!session || session.role !== "platform_admin") return null;

  return (
    <WorkspaceShell
      title="Platform Admin"
      subtitle="ExamGrid Operations Console"
      identity={session.userId}
      nav={NAV}
      footer={
        <Button
          variant="outline"
          size="sm"
          className="w-full bg-white"
          onClick={() => {
            void logout();
            router.push("/platform/login");
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
