"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, FileText, LayoutDashboard, LogOut, Sparkles } from "lucide-react";

import { useInstituteName } from "@/hooks/use-institute-name";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { SessionHydrationGate } from "@/components/auth/session-hydration-gate";

const NAV = [
  { href: "/student/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/student/tests", label: "Tests", icon: FileText },
  { href: "/student/reports", label: "Progress", icon: BarChart3 },
];

export function StudentShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const isHydrated = useAuthStore((s) => s.isHydrated);
  const candidate = useAuthStore((s) => s.candidate);
  const session = useWorkspaceAuthStore((s) => s.session);
  const workspaceLogout = useWorkspaceAuthStore((s) => s.logout);
  const logout = useAuthStore((s) => s.logout);
  const wsHydrated = useWorkspaceAuthStore((s) => s.isHydrated);
  const sessionRole = useWorkspaceAuthStore((s) => s.session?.role);
  const instituteName = useInstituteName(session?.instituteId);

  useEffect(() => {
    if (!isHydrated || pathname === "/student/login") return;
    if (wsHydrated && sessionRole && sessionRole !== "student") {
      logout();
      void workspaceLogout();
      router.replace("/student/login");
      return;
    }
    if (!candidate) {
      router.replace("/student/login");
      return;
    }
    import("@/lib/cbt/test-session-answers-storage").then((m) => m.cleanupOldSessions());
  }, [candidate, isHydrated, wsHydrated, sessionRole, pathname, router, logout, workspaceLogout]);

  if (pathname === "/student/login") return <>{children}</>;
  if (!isHydrated || !candidate) return null;

  const isCbtTestDeepRoute =
    pathname.startsWith("/student/tests/") &&
    pathname.length > "/student/tests/".length;
  if (isCbtTestDeepRoute) return <>{children}</>;

  const handleLogout = () => {
    logout();
    void workspaceLogout();
    router.push("/student/login");
  };

  return (
    <SessionHydrationGate loginPath="/student/login">
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at 78% 0%, rgba(81,71,232,0.10), transparent 34%), linear-gradient(180deg, #FBFCFF 0%, var(--eg-bg) 52%, #F5F7FC 100%)",
        color: "var(--eg-text-primary)",
        fontFamily: "var(--eg-font-sans)",
      }}
    >
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-[248px] flex-col px-5 py-6">
        <div
          className="flex h-full flex-col rounded-[24px] px-4 py-5"
          style={{
            backgroundColor: "rgba(255,255,255,0.82)",
            border: "1px solid rgba(232,234,243,0.9)",
            boxShadow: "0 24px 70px rgba(31, 37, 73, 0.08)",
            backdropFilter: "blur(20px)",
          }}
        >
          <Link href="/student/dashboard" className="mb-8 flex items-center gap-3 px-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-white"
              style={{ background: "linear-gradient(145deg, var(--eg-accent), #7C6BFF)" }}
            >
              <Sparkles size={19} strokeWidth={2.3} />
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-tight">ExamGrid</p>
              <p className="text-[11px] font-medium" style={{ color: "var(--eg-text-tertiary)" }}>
                Student companion
              </p>
            </div>
          </Link>

          <nav className="space-y-1">
            {NAV.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition-all duration-200",
                    isActive ? "translate-x-0" : "hover:translate-x-0.5",
                  )}
                  style={{
                    color: isActive ? "var(--eg-accent)" : "var(--eg-text-secondary)",
                    backgroundColor: isActive ? "var(--eg-accent-light)" : "transparent",
                  }}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3">
            <div
              className="rounded-3xl p-4"
              style={{ backgroundColor: "var(--eg-surface-soft)" }}
            >
              <div className="mb-3 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white"
                  style={{ background: "linear-gradient(145deg, var(--eg-accent), var(--eg-coach))" }}
                >
                  {candidate.name?.charAt(0)?.toUpperCase() || "S"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{candidate.name}</p>
                  <p className="truncate text-xs" style={{ color: "var(--eg-text-tertiary)" }}>
                    {candidate.rollNumber}
                  </p>
                </div>
              </div>
              {instituteName && (
                <p className="truncate text-xs" style={{ color: "var(--eg-text-secondary)" }}>
                  {instituteName}
                </p>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-red-50 hover:text-red-600"
              style={{ color: "var(--eg-text-secondary)" }}
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <header
        className="sticky top-0 z-30 flex h-16 items-center justify-between px-4 lg:hidden"
        style={{
          backgroundColor: "rgba(251,252,255,0.84)",
          borderBottom: "1px solid rgba(232,234,243,0.8)",
          backdropFilter: "blur(18px)",
        }}
      >
        <Link href="/student/dashboard" className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white"
            style={{ background: "linear-gradient(145deg, var(--eg-accent), #7C6BFF)" }}
          >
            <Sparkles size={16} />
          </div>
          <span className="text-sm font-semibold">ExamGrid</span>
        </Link>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: "linear-gradient(145deg, var(--eg-accent), var(--eg-coach))" }}
        >
          {candidate.name?.charAt(0)?.toUpperCase() || "S"}
        </div>
      </header>

      <main className="pb-24 lg:pl-[248px] lg:pb-0">
        <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 md:py-8 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>

      <nav
        className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-3 rounded-[24px] p-1 shadow-2xl lg:hidden"
        style={{
          backgroundColor: "rgba(255,255,255,0.9)",
          border: "1px solid rgba(232,234,243,0.95)",
          backdropFilter: "blur(18px)",
        }}
      >
        {NAV.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-14 flex-col items-center justify-center gap-1 rounded-[20px] text-[11px] font-semibold transition-all"
              style={{
                color: isActive ? "var(--eg-accent)" : "var(--eg-text-tertiary)",
                backgroundColor: isActive ? "var(--eg-accent-light)" : "transparent",
              }}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
    </SessionHydrationGate>
  );
}
