"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdminAuthStore } from "@/stores/admin-auth-store";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/batches", label: "Batches" },
  { href: "/admin/questions", label: "Question Bank" },
  { href: "/admin/exams", label: "Exams" },
  { href: "/admin/create-exam", label: "Create Exam" },
  { href: "/admin/schedules", label: "Schedules" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
  { href: "/admin/system/status", label: "System Status" },
];

const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ADMIN_ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
const SESSION_WARNING_MS = 2 * 60 * 1000;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const admin = useAdminAuthStore((s) => s.admin);
  const isHydrated = useAdminAuthStore((s) => s.isHydrated);
  const hydrate = useAdminAuthStore((s) => s.hydrate);
  const touch = useAdminAuthStore((s) => s.touch);
  const expire = useAdminAuthStore((s) => s.expire);
  const logout = useAdminAuthStore((s) => s.logout);
  const [sessionWarning, setSessionWarning] = useState<string | null>(null);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated || isLoginPage) return;
    if (!admin) router.replace("/admin/login");
  }, [admin, isHydrated, isLoginPage, router]);

  useEffect(() => {
    if (!admin || isLoginPage) return;
    const markActivity = () => {
      touch();
      setSessionWarning(null);
    };
    window.addEventListener("click", markActivity);
    window.addEventListener("keydown", markActivity);
    window.addEventListener("mousemove", markActivity);
    return () => {
      window.removeEventListener("click", markActivity);
      window.removeEventListener("keydown", markActivity);
      window.removeEventListener("mousemove", markActivity);
    };
  }, [admin, isLoginPage, touch]);

  useEffect(() => {
    if (!admin || isLoginPage) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      const started = new Date(admin.sessionStartedAtUTC ?? now).getTime();
      const last = new Date(admin.lastActivityAtUTC ?? started).getTime();
      const idleRemaining = ADMIN_IDLE_TIMEOUT_MS - (now - last);
      const absoluteRemaining = ADMIN_ABSOLUTE_TIMEOUT_MS - (now - started);
      const remaining = Math.min(idleRemaining, absoluteRemaining);
      if (remaining <= 0) {
        expire(idleRemaining <= 0 ? "idle_timeout" : "absolute_timeout");
        router.replace("/admin/login");
      } else if (remaining <= SESSION_WARNING_MS) {
        setSessionWarning(
          `Session expires in ${Math.ceil(remaining / 60000)} minute(s).`,
        );
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [admin, expire, isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;

  if (!isHydrated || !admin) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Loading admin…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="flex w-56 shrink-0 flex-col border-r border-gray-300 bg-white">
        <div className="border-b border-gray-200 px-4 py-4">
          <p className="text-xs font-semibold uppercase text-gray-500">
            ExamGrid Admin
          </p>
          <p className="truncate text-sm font-medium text-gray-900">
            {admin.name}
          </p>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded px-3 py-2 text-sm font-medium",
                pathname === item.href
                  ? "bg-[#1a3c6e] text-white"
                  : "text-gray-700 hover:bg-gray-100",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 border-t border-gray-200 p-3">
          <Link
            href="/exams"
            className="block text-xs text-[#1a3c6e] hover:underline"
          >
            → Student portal
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              logout();
              router.push("/admin/login");
            }}
          >
            Logout
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
      {sessionWarning && (
        <div className="fixed bottom-4 right-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow">
          {sessionWarning}
        </div>
      )}
    </div>
  );
}
