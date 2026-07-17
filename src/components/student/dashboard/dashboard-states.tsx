"use client";

import { DashboardHeroSkeleton } from "./dashboard-hero-card";
import { PerformancePulseSkeleton } from "./performance-pulse";
import { UpcomingTestsSkeleton } from "./upcoming-tests-preview";
import { RecentActivitySkeleton } from "./recent-tests-table";

const SECTION_GAP = "48px";

export function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading dashboard"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SECTION_GAP,
      }}
    >
      <DashboardHeroSkeleton />
      <PerformancePulseSkeleton />
      <UpcomingTestsSkeleton />
      <RecentActivitySkeleton />
      {/* Weekly Momentum skeleton */}
      <section aria-label="Weekly Momentum loading">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
          <div className="eg-skeleton" style={{ height: "18px", width: "30%" }} />
          <div className="eg-skeleton" style={{ height: "18px", width: "15%" }} />
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div className="eg-skeleton" style={{ width: "10px", height: "10px", borderRadius: "50%" }} />
              <div className="eg-skeleton" style={{ width: "14px", height: "11px" }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function DashboardErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "40vh",
        textAlign: "center",
        gap: "8px",
      }}
    >
      <p
        style={{
          fontSize: "14px",
          fontWeight: 500,
          color: "var(--eg-text-primary)",
        }}
      >
        We couldn&apos;t load your dashboard.
      </p>
      <p
        style={{
          fontSize: "13px",
          color: "var(--eg-text-secondary)",
          marginBottom: "12px",
        }}
      >
        This is usually a temporary issue.
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center rounded-md transition-all duration-150 focus-visible:outline-none"
        style={{
          backgroundColor: "var(--eg-accent)",
          color: "#ffffff",
          padding: "10px 24px",
          fontSize: "14px",
          fontWeight: 500,
          borderRadius: "6px",
        }}
      >
        Retry
      </button>
    </div>
  );
}
