import React from "react";
import { TrendIndicator } from "./trend-indicator";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
  dataPoints?: number[];
  animationDelay?: number;
  tone?: "indigo" | "green" | "warm";
}

export function MetricCard({
  title,
  value,
  icon,
  trend,
  dataPoints,
  animationDelay = 0,
  tone = "indigo",
}: MetricCardProps) {
  const toneColor = {
    indigo: "var(--eg-accent)",
    green: "var(--eg-coach)",
    warm: "var(--eg-warm)",
  }[tone];

  return (
    <article
      className="eg-animate-in group relative overflow-hidden rounded-[22px] bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--eg-shadow-hover)] sm:p-6"
      style={{
        animationDelay: `${animationDelay}ms`,
        border: "1px solid rgba(232,234,243,0.9)",
        boxShadow: "var(--eg-shadow-rest)",
      }}
    >
      <div
        className="absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20"
        style={{ backgroundColor: toneColor }}
      />
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "var(--eg-surface-soft)", color: toneColor }}
            >
              {icon}
            </div>
          )}
          <h3 className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--eg-text-tertiary)]">
            {title}
          </h3>
        </div>
      </div>

      <div className="relative mt-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p
            className="font-mono text-[34px] font-bold leading-none tracking-tight sm:text-[38px]"
            style={{ color: toneColor }}
          >
            {value}
          </p>
          {trend && (
            <div className="mt-3">
              <TrendIndicator trend={trend.direction} value={trend.value} dataPoints={dataPoints} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
