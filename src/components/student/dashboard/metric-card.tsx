"use client";

import { useEffect, useRef, useState } from "react";

interface MetricCardProps {
  label: string;
  value: string | null;
  rawValue?: number | null; // for count-up
  delta?: { value: string; trend: "up" | "down" | "neutral" } | null;
  isPersonalBest?: boolean;
  animationDelay?: number;
}

function useCountUp(target: number | null, duration = 600, delay = 0) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === null || target === undefined) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) { setDisplay(target); return; }

    const timer = setTimeout(() => {
      const start = performance.now();
      const step = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out quad
        const eased = 1 - (1 - progress) * (1 - progress);
        setDisplay(Math.round(eased * target));
        if (progress < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay]);

  return display;
}

export function MetricCard({
  label,
  value,
  rawValue,
  delta,
  isPersonalBest = false,
  animationDelay = 0,
}: MetricCardProps) {
  // Count-up only for numeric rawValues
  const counted = useCountUp(rawValue ?? null, 600, animationDelay);
  const displayValue = rawValue !== undefined && rawValue !== null
    ? value?.replace(String(rawValue), String(counted)) ?? String(counted)
    : value;

  const deltaColor =
    delta?.trend === "up"
      ? "var(--eg-success)"
      : delta?.trend === "down"
      ? "var(--eg-danger)"
      : "var(--eg-text-tertiary)";

  const deltaSymbol =
    delta?.trend === "up" ? "↑" : delta?.trend === "down" ? "↓" : "→";

  return (
    <article
      className="eg-animate-in rounded-xl flex flex-col"
      style={{
        animationDelay: `${animationDelay}ms`,
        padding: "24px",
        backgroundColor: "var(--eg-surface)",
        border: "1px solid var(--eg-border)",
        borderRadius: "12px",
        boxShadow: "var(--eg-shadow-rest)",
        transition: "box-shadow 150ms ease-in, transform 150ms ease-in",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--eg-shadow-hover)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--eg-shadow-rest)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      {/* Label */}
      <p
        style={{
          fontSize: "12px",
          fontWeight: 500,
          color: "var(--eg-text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "8px",
        }}
      >
        {label}
      </p>

      {/* Value */}
      <p
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: value === null ? "var(--eg-text-tertiary)" : "var(--eg-text-primary)",
          fontFamily: "var(--eg-font-mono)",
          lineHeight: 1.1,
        }}
      >
        {displayValue ?? "—"}
      </p>

      {/* Delta */}
      {delta && (
        <p
          className="eg-animate-in"
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: deltaColor,
            marginTop: "4px",
            animationDelay: `${animationDelay + 650}ms`,
          }}
        >
          {deltaSymbol} {delta.value}
        </p>
      )}

      {/* Personal Best */}
      {isPersonalBest && (
        <p
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--eg-accent)",
            marginTop: delta ? "6px" : "8px",
          }}
        >
          ★ Personal Best
        </p>
      )}
    </article>
  );
}

export function MetricCardSkeleton() {
  return (
    <div
      className="rounded-xl"
      style={{
        padding: "24px",
        backgroundColor: "var(--eg-surface)",
        border: "1px solid var(--eg-border)",
        borderRadius: "12px",
      }}
    >
      <div className="eg-skeleton" style={{ height: "12px", width: "60%", marginBottom: "12px" }} />
      <div className="eg-skeleton" style={{ height: "36px", width: "55%", marginBottom: "8px" }} />
      <div className="eg-skeleton" style={{ height: "13px", width: "40%" }} />
    </div>
  );
}
