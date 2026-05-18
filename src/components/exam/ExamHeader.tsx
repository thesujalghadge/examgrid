"use client";

import type { Candidate } from "@/types/exam";
import { Timer } from "./Timer";
import { ProductMark } from "@/components/shared/product-ui";
import { Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

interface ExamHeaderProps {
  examTitle: string;
  candidate: Candidate;
  violationCount?: number;
  onTimeUp?: () => void;
}

export function ExamHeader({
  examTitle,
  candidate,
  violationCount = 0,
  onTimeUp,
}: ExamHeaderProps) {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 768);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    return () => window.removeEventListener("resize", checkOrientation);
  }, []);

  return (
    <>
      {isPortrait && (
        <div className="bg-primary text-primary-foreground px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 md:hidden">
          <Smartphone className="h-4 w-4 rotate-90" />
          <span>Rotate device to landscape for optimal CBT experience</span>
        </div>
      )}
      <header className="flex h-14 md:h-16 shrink-0 items-stretch border-b border-border bg-background shadow-sm sticky top-0 z-40">
        <div className="hidden md:flex w-48 shrink-0 flex-col justify-center border-r border-border px-4 py-2">
          <ProductMark compact />
        </div>

        <div className="flex flex-1 items-center justify-between px-3 md:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight text-foreground md:text-base">
              {examTitle}
            </h1>
            <p className="mt-0.5 hidden text-xs text-muted-foreground md:block">
              <span className="font-medium text-foreground">{candidate.name}</span>
              {" · "}Roll: {candidate.rollNumber}
              {violationCount > 0 && (
                <span className="ml-2 font-medium text-amber-600 dark:text-amber-400">
                  · Violations: {violationCount}
                </span>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-4 md:gap-6">
            <div className="text-right">
              <p className="hidden text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:block mb-0.5">
                Time Remaining
              </p>
              <Timer onTimeUp={onTimeUp} />
            </div>
            <div className="hidden md:flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary ring-1 ring-primary/20">
              {candidate.name.charAt(0)}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
