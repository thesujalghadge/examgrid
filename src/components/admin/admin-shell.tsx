"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdminAuthStore } from "@/stores/admin-auth-store";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/questions", label: "Question Bank" },
  { href: "/admin/exams", label: "Exams" },
  { href: "/admin/create-exam", label: "Create Exam" },
  { href: "/admin/system/status", label: "System Status" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const admin = useAdminAuthStore((s) => s.admin);
  const isHydrated = useAdminAuthStore((s) => s.isHydrated);
  const hydrate = useAdminAuthStore((s) => s.hydrate);
  const logout = useAdminAuthStore((s) => s.logout);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated || isLoginPage) return;
    if (!admin) router.replace("/admin/login");
  }, [admin, isHydrated, isLoginPage, router]);

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
    </div>
  );
}
