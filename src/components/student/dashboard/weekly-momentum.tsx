"use client";

import { SectionHeader } from "@/components/ui/student/section-header";

const DAYS = ["M", "T", "W", "Th", "F", "Sa", "Su"];
const JS_TO_MON: Record<number, number> = { 0: 6, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };

interface WeeklyMomentumProps {
  activeDays: number[];
}

export function WeeklyMomentum({ activeDays }: WeeklyMomentumProps) {
  const activeSet = new Set(activeDays.map((d) => JS_TO_MON[d]));
  const activeCount = activeSet.size;
  const message = activeCount >= 4 ? "Momentum is building." : activeCount > 0 ? "A few steady sessions count." : "Start with one small review.";

  return (
    <section aria-label="Momentum">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[14px] font-bold uppercase tracking-[0.12em] text-[var(--eg-text-tertiary)]">
          Momentum
        </h2>
        <span className="text-xs font-bold text-[var(--eg-text-tertiary)]">{activeCount}/7</span>
      </div>

      <div className="eg-animate-in">
        <div className="grid grid-cols-7 gap-4 px-2 py-4">
          {DAYS.map((day, i) => {
            const isActive = activeSet.has(i);
            return (
              <div key={day} className="flex flex-col items-center gap-4 group">
                <span className="text-[11px] font-bold text-[var(--eg-text-tertiary)] group-hover:text-[var(--eg-text-secondary)] transition-colors">{day}</span>
                <div
                  title={isActive ? "Active" : "Open"}
                  className="h-[14px] w-[14px] rounded-full transition-all duration-500 ease-out"
                  style={{
                    backgroundColor: isActive ? "var(--eg-text-primary)" : "transparent",
                    border: isActive ? "1px solid var(--eg-text-primary)" : "1px solid rgba(0,0,0,0.1)",
                    opacity: isActive ? 0.9 : 1,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-8">
          <p className="text-[14px] font-semibold text-[var(--eg-text-primary)]">{message}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--eg-text-secondary)] max-w-md">
            Consistency beats cramming. Keep the week gentle and visible.
          </p>
        </div>
      </div>
    </section>
  );
}

export function WeeklyMomentumSkeleton() {
  return (
    <section aria-label="Momentum loading">
      <div className="eg-skeleton mb-4 h-5 w-32" />
      <div className="grid grid-cols-7 gap-4 px-2 py-4">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex flex-col items-center gap-4">
            <div className="eg-skeleton h-3 w-3" />
            <div className="eg-skeleton h-[14px] w-[14px] rounded-full" />
          </div>
        ))}
      </div>
      <div className="eg-skeleton mt-8 h-12 w-full max-w-sm rounded-lg" />
    </section>
  );
}
