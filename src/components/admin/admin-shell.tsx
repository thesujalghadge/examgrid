"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Calendar,
  ClipboardList,
  FileQuestion,
  BrainCircuit,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  ScrollText,
  Settings,
  Users,
  Search,
  Bell,
  Command,
  Menu,
  X,
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
  { href: "/admin/intelligence/review", label: "PYQ Review", icon: BrainCircuit },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated || isLoginPage) return;
    if (!admin) router.replace("/admin/login");
  }, [admin, isHydrated, isLoginPage, router]);

  useEffect(() => {
    // Close mobile menu on navigation
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!admin || isLoginPage) return;
    const markActivity = () => {
      touch();
      setSessionWarning(null);
    };
    window.addEventListener("click", markActivity);
    window.addEventListener("keydown", markActivity);
    window.addEventListener("mousemove", markActivity);
    window.addEventListener("touchstart", markActivity); // Added touch for mobile
    return () => {
      window.removeEventListener("click", markActivity);
      window.removeEventListener("keydown", markActivity);
      window.removeEventListener("mousemove", markActivity);
      window.removeEventListener("touchstart", markActivity);
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

  const SidebarContent = () => (
    <>
      <div className="flex h-16 items-center justify-between px-4">
        <ProductMark subtitle="Operations Console" />
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary font-medium">
            {DEMO_INSTITUTE.name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="truncate text-sm font-medium text-foreground">
              {DEMO_INSTITUTE.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">{admin.name}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 overscroll-contain">
        <p className="mb-2 px-2 text-meta text-muted-foreground">
          Platform
        </p>
        <nav className="space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2.5 py-3 lg:py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-5 w-5 lg:h-4 lg:w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-2 border-t border-border p-4 pb-safe">
        <Link
          href="/exams"
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-3 lg:py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <BarChart3 className="h-5 w-5 lg:h-4 lg:w-4" />
          Student Portal Preview
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 py-6 lg:py-2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            logout();
            router.push("/admin/login");
          }}
        >
          <LogOut className="h-5 w-5 lg:h-4 lg:w-4" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-sidebar shadow-2xl transition-transform duration-300 ease-in-out lg:hidden",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <main className="flex min-w-0 flex-1 flex-col h-full">
        {/* Global Topbar */}
        <header className="flex h-14 lg:h-16 shrink-0 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 sm:px-6 lg:px-8 z-30 sticky top-0">
          <div className="flex flex-1 items-center gap-4">
            {/* Mobile menu toggle */}
            <Button variant="ghost" size="icon" className="lg:hidden -ml-2 text-foreground" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="h-6 w-6" />
            </Button>
            
            <div className="lg:hidden flex items-center">
              <ProductMark compact />
            </div>
            
            {/* Command Palette Placeholder */}
            <button className="hidden w-full max-w-md items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex lg:w-80">
              <Search className="h-4 w-4 shrink-0" />
              <span>Search platform...</span>
              <kbd className="ml-auto inline-flex h-5 items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <Command className="h-3 w-3" /> K
              </kbd>
            </button>
          </div>
          
          <div className="flex items-center gap-3 lg:gap-4">
            <button className="relative rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Bell className="h-5 w-5 lg:h-5 lg:w-5" />
              <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-primary ring-2 ring-background"></span>
            </button>
            <div className="h-7 w-7 lg:h-8 lg:w-8 rounded-full bg-gradient-to-tr from-primary to-primary/50 ring-2 ring-background ring-offset-1"></div>
          </div>
        </header>

        {/* Scrollable Canvas */}
        <div className="flex-1 overflow-y-auto bg-muted/20 overscroll-none">
          <div className="eg-container py-4 sm:py-6 lg:py-8 min-h-full">
            {children}
          </div>
        </div>
      </main>

      {sessionWarning && (
        <div className="fixed bottom-safe right-4 left-4 lg:left-auto lg:w-96 z-50 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 shadow-lg mb-4">
          {sessionWarning}
        </div>
      )}
    </div>
  );
}
