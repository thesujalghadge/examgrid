"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface WorkspaceNavItem {
  href: string;
  label: string;
}

export function WorkspaceShell({
  title,
  subtitle,
  identity,
  nav,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  identity: string;
  nav: WorkspaceNavItem[];
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f1e8_0%,#fbf9f4_18%,#f7f4ee_100%)] text-[#1f2933]">
      <header className="border-b border-[#d8d2c7] bg-[#fbf9f4]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6f3e]">
                {title}
              </p>
              <div>
                <h1 className="text-xl font-semibold text-[#14213d] md:text-2xl">{subtitle}</h1>
                <p className="text-sm text-[#5e5a52]">{identity}</p>
              </div>
            </div>
            {footer ? <div className="md:min-w-[220px]">{footer}</div> : null}
          </div>
          <nav className="flex flex-wrap gap-2">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition",
                    active
                      ? "border-[#14213d] bg-[#14213d] text-white"
                      : "border-[#d8d2c7] bg-white text-[#4a5565] hover:border-[#8a6f3e] hover:text-[#14213d]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  );
}
