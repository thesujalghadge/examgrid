"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Calendar,
  ClipboardList,
  FileQuestion,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_INSTITUTE } from "@/config/demo";
import { LoadingState, ProductMark } from "@/components/shared/product-ui";
import { cn } from "@/lib/utils";
import { useAdminAuthStore } from "@/stores/admin-auth-store";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/batches", label: "Batches", icon: GraduationCap },
  { href: "/admin/questions", label: "Question Bank", icon: FileQuestion },
  { href: "/admin/exams", label: "Exams", icon: ClipboardList },
  { href: "/admin/create-exam", label: "Create Exam", icon: PlusCircle },
  { href: "/admin/schedules", label: "Schedules", icon: Calendar },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/system/status", label: "System Status", icon: Settings },
] as const;

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
    return <LoadingState label="Loading operations console…" />;
  }

  return (
    <div className="flex min-h-screen bg-[var(--eg-canvas)]">
      <aside className="hidden w-[17rem] shrink-0 flex-col border-r border-[var(--eg-border)] bg-[var(--eg-surface)] lg:flex">
        <div className="border-b border-[var(--eg-border)] px-4 py-5">
          <ProductMark subtitle="Operations console" />
          <div className="mt-4 rounded-lg border border-[var(--eg-border)] bg-slate-50/80 px-3 py-2.5">
            <p className="eg-section-title">Institute</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              {DEMO_INSTITUTE.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{admin.name}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          <p className="px-3 pb-2 pt-1 eg-section-title">Operations</p>
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--eg-brand)] text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-[var(--eg-border)] p-3">
          <Link
            href="/exams"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--eg-cbt)] transition hover:bg-slate-50"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Student portal preview
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
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 border-b border-[var(--eg-border)] bg-[var(--eg-surface)]/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between">
            <ProductMark compact />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                logout();
                router.push("/admin/login");
              }}
            >
              Logout
            </Button>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  pathname === item.href
                    ? "bg-[var(--eg-brand)] text-white"
                    : "bg-slate-100 text-slate-700",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="eg-container max-w-7xl py-6 sm:py-8">{children}</div>
      </main>
      {sessionWarning && (
        <div className="fixed bottom-4 right-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg">
          {sessionWarning}
        </div>
      )}
    </div>
  );
}

