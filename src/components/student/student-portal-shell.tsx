"use client";

import { useRouter } from "next/navigation";
import { GraduationCap, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductMark } from "@/components/shared/product-ui";
import { DEMO_INSTITUTE } from "@/config/demo";
import type { Candidate } from "@/types/exam";

export function StudentPortalShell({
  candidate,
  onLogout,
  children,
}: {
  candidate: Candidate;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b border-border bg-primary text-primary-foreground shadow-md">
        <div className="eg-container flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <ProductMark compact />
            </div>
            <div className="border-l border-primary-foreground/20 pl-4">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary-foreground/80">
                <GraduationCap className="h-3.5 w-3.5" />
                Student portal
              </p>
              <h1 className="text-lg font-semibold">{DEMO_INSTITUTE.name}</h1>
              <p className="text-sm text-primary-foreground/80">
                {candidate.name} · Roll {candidate.rollNumber}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-white"
            onClick={() => {
              onLogout();
              router.push("/login");
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>
      <main className="eg-container py-6 sm:py-8 max-w-5xl">{children}</main>
    </div>
  );
}
