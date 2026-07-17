"use client";

import { Award, FileText, Target } from "lucide-react";

import { MetricCard } from "@/components/ui/student/metric-card";
import { SectionHeader } from "@/components/ui/student/section-header";

interface PulseProps {
  testsTaken: number;
  avgAccuracy: number | null;
  avgRank: number | null;
  deltas?: {
    accuracy?: { value: string; trend: "up" | "down" | "neutral" };
    rank?: { value: string; trend: "up" | "down" | "neutral" };
  };
  isPersonalBest?: boolean;
}

export function PerformancePulse({
  testsTaken,
  avgAccuracy,
  avgRank,
  deltas,
}: PulseProps) {
  // Sparkline simulation data for presentation
  const accPoints = deltas?.accuracy?.trend === "up" ? [60, 65, 62, 70, 74] : [70, 72, 74, 71, 74];
  const rankPoints = deltas?.rank?.trend === "up" ? [150, 145, 140, 135, 128] : [120, 122, 125, 127, 128];
  const testPoints = [Math.max(0, testsTaken - 4), Math.max(0, testsTaken - 3), Math.max(0, testsTaken - 2), Math.max(0, testsTaken - 1), testsTaken];

  return (
    <section aria-label="Preparation Pulse">
      <div className="mb-4">
        <h2 className="text-[14px] font-bold uppercase tracking-[0.12em] text-[var(--eg-text-tertiary)]">
          Preparation Pulse
        </h2>
      </div>

      <div 
        className="eg-animate-in flex flex-col md:flex-row bg-[#fcfdfc]"
        style={{
          border: "1px solid rgba(0,0,0,0.04)",
          borderRadius: "20px",
        }}
      >
        {/* Metric 1: Accuracy */}
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 mb-4">
            <Target size={16} style={{ color: "var(--eg-accent)" }} />
            <span className="text-[13px] font-semibold text-[var(--eg-text-secondary)]">Overall Accuracy</span>
          </div>
          <div>
            <div className="text-[36px] font-bold leading-none tracking-tight text-[var(--eg-text-primary)] mb-2">
              {avgAccuracy !== null ? `${avgAccuracy}%` : "-"}
            </div>
            <div className="text-[13px] text-[var(--eg-text-tertiary)] font-medium">
              {deltas?.accuracy ? (
                <span>{deltas.accuracy.trend === "up" ? "Improved" : deltas.accuracy.trend === "down" ? "Dropped" : "Steady"} by {deltas.accuracy.value}</span>
              ) : (
                <span>No change yet</span>
              )}
            </div>
          </div>
        </div>

        {/* Metric 2: Rank */}
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 mb-4">
            <Award size={16} style={{ color: "var(--eg-coach)" }} />
            <span className="text-[13px] font-semibold text-[var(--eg-text-secondary)]">Average Rank</span>
          </div>
          <div>
            <div className="text-[36px] font-bold leading-none tracking-tight text-[var(--eg-text-primary)] mb-2">
              {avgRank !== null ? `${avgRank}` : "-"}
            </div>
            <div className="text-[13px] text-[var(--eg-text-tertiary)] font-medium">
              {deltas?.rank ? (
                <span>{deltas.rank.trend === "up" ? "Rose" : deltas.rank.trend === "down" ? "Fell" : "Maintained"} by {deltas.rank.value} places</span>
              ) : (
                <span>No change yet</span>
              )}
            </div>
          </div>
        </div>

        {/* Metric 3: Tests Taken */}
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} style={{ color: "var(--eg-warm)" }} />
            <span className="text-[13px] font-semibold text-[var(--eg-text-secondary)]">Tests Taken</span>
          </div>
          <div>
            <div className="text-[36px] font-bold leading-none tracking-tight text-[var(--eg-text-primary)] mb-2">
              {testsTaken}
            </div>
            <div className="text-[13px] text-[var(--eg-text-tertiary)] font-medium">
              Total papers attempted
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PerformancePulseSkeleton() {
  return (
    <section aria-label="Preparation pulse loading">
      <div className="eg-skeleton mb-4 h-5 w-40" />
      <div className="rounded-[20px] bg-white h-32 w-full eg-skeleton" style={{ border: "1px solid rgba(0,0,0,0.04)" }} />
    </section>
  );
}
