"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionDebugPanel } from "@/components/debug/session-debug-panel";
import { cn } from "@/lib/utils";

export interface WorkspaceNavItem {
  href: string;
  label: string;
}

export function WorkspaceShell({
  title,
  subtitle,
  identity,
  role,
  instituteId,
  nav,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  identity: string;
  role: string;
  instituteId?: string;
  nav: WorkspaceNavItem[];
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="flex w-64 shrink-0 flex-col border-r border-gray-300 bg-white">
        <div className="border-b border-gray-200 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {title}
          </p>
          <p className="text-sm font-medium text-gray-900">{subtitle}</p>
          <p className="mt-1 truncate text-xs text-gray-500">{identity}</p>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {nav.map((item) => (
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
        {footer && <div className="border-t border-gray-200 p-3">{footer}</div>}
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
      <SessionDebugPanel role={role} instituteId={instituteId} />
    </div>
  );
}
