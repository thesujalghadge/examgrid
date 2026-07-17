"use client";

import Link from "next/link";
import { ArrowRight, Play, BookOpen, Clock, BarChart2 } from "lucide-react";

interface NextActionProps {
  nextAction: {
    type: "active" | "upcoming" | "review" | "performance";
    title: string;
    subtitle: string;
    ctaText: string;
    ctaHref: string;
  };
}

export function UpcomingTestsPreview({ nextAction }: NextActionProps) {
  if (!nextAction) return null;

  const Icon = nextAction.type === "active" ? Play 
             : nextAction.type === "upcoming" ? Clock
             : nextAction.type === "review" ? BookOpen
             : BarChart2;

  const accentColor = nextAction.type === "active" ? "var(--eg-accent)" : "var(--eg-text-primary)";
  const bgSoft = nextAction.type === "active" ? "color-mix(in srgb, var(--eg-accent) 5%, transparent)" : "var(--eg-surface-soft)";

  return (
    <section aria-label="Next Action">
      <div className="mb-4">
        <h2 className="text-[14px] font-bold uppercase tracking-[0.12em] text-[var(--eg-text-tertiary)]">
          Next Action
        </h2>
      </div>

      <div 
        className="eg-animate-in relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-6 sm:p-8 rounded-[24px] bg-[#ffffff]"
        style={{
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.02)",
        }}
      >
        <div className="flex items-start sm:items-center gap-5">
          <div 
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: bgSoft, color: accentColor }}
          >
            <Icon size={22} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)] mb-1">
              {nextAction.subtitle}
            </div>
            <h3 className="text-[20px] sm:text-[24px] font-bold text-[var(--eg-text-primary)] leading-tight">
              {nextAction.title}
            </h3>
          </div>
        </div>
        
        <Link 
          href={nextAction.ctaHref}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-[12px] font-semibold text-[14px] transition-all"
          style={{
            backgroundColor: accentColor,
            color: "#ffffff",
          }}
        >
          {nextAction.ctaText}
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

export function UpcomingTestsSkeleton() {
  return (
    <section aria-label="Next action loading">
      <div className="eg-skeleton mb-4 h-5 w-32" />
      <div className="rounded-[24px] h-[120px] w-full bg-white eg-skeleton" style={{ border: "1px solid rgba(0,0,0,0.04)" }} />
    </section>
  );
}
