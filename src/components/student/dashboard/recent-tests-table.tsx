"use client";

import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

import { EmptyState } from "@/components/ui/student/empty-state";
import { SectionHeader } from "@/components/ui/student/section-header";
import { RecentTestCard } from "@/components/ui/student/test-card";

interface RecentTest {
  id: string;
  testId?: string;
  title: string;
  dateStr: string;
  score: number;
  rank: number | null;
}

interface RecentActivityProps {
  tests: RecentTest[];
}

export function RecentActivity({ tests }: RecentActivityProps) {
  const visible = tests.slice(0, 3);

  return (
    <section aria-label="Recent learning">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[14px] font-bold uppercase tracking-[0.12em] text-[var(--eg-text-tertiary)]">
          Recent Learning
        </h2>
        {visible.length > 0 && (
          <Link href="/student/tests?tab=completed" className="text-[13px] font-semibold text-[var(--eg-accent)] hover:underline">
            View all
          </Link>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No tests completed yet."
          description="Once you take your first test, your review path will appear here with scores, rank, and solutions."
          ctaText="View Upcoming Tests"
          ctaHref="/student/tests"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((test) => (
            <div 
              key={test.id} 
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 px-2 hover:bg-[var(--eg-surface-soft)] rounded-xl transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-[16px] font-bold text-[var(--eg-text-primary)] truncate">
                  {test.title}
                </h3>
                <div className="text-[13px] text-[var(--eg-text-tertiary)] mt-0.5">
                  {test.dateStr}
                </div>
              </div>

              <div className="flex items-center gap-6 sm:gap-8 shrink-0">
                <div className="text-right">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)]">Score</div>
                  <div className="text-[16px] font-bold text-[var(--eg-text-primary)]">{test.score}</div>
                </div>
                <div className="text-right w-12">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)]">Rank</div>
                  <div className="text-[16px] font-bold text-[var(--eg-text-primary)]">{test.rank || "-"}</div>
                </div>
                {/* 
                  Route contract: /student/tests/[examId]/solutions
                  Always pass examId (test.testId). Never resultId (test.id).
                */}
                <Link 
                  href={`/student/tests/${test.testId}/solutions`}
                  className="inline-flex h-9 items-center justify-center rounded-lg px-4 text-[13px] font-semibold text-[var(--eg-accent)] bg-[color-mix(in_srgb,var(--eg-accent)_8%,transparent)] hover:bg-[color-mix(in_srgb,var(--eg-accent)_15%,transparent)] transition-colors"
                >
                  Review
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function RecentActivitySkeleton() {
  return (
    <section aria-label="Recent learning loading">
      <div className="eg-skeleton mb-4 h-5 w-40" />
      <div className="flex flex-col gap-4 mt-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <div>
              <div className="eg-skeleton mb-2 h-5 w-48" />
              <div className="eg-skeleton h-4 w-24" />
            </div>
            <div className="flex gap-6">
              <div className="eg-skeleton h-8 w-12" />
              <div className="eg-skeleton h-8 w-12" />
              <div className="eg-skeleton h-8 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
