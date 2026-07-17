"use client";

import { DashboardHero } from "./dashboard-hero-card";
import { PerformancePulse } from "./performance-pulse";
import { RecentActivity } from "./recent-tests-table";
import { UpcomingTestsPreview } from "./upcoming-tests-preview";
import { WeeklyMomentum } from "./weekly-momentum";

interface HeroData {
  greeting: string;
  recommendation: string;
  ctaText: string;
  ctaHref: string;
}

interface PulseData {
  testsTaken: number;
  avgAccuracy: number | null;
  avgRank: number | null;
  deltas?: {
    accuracy?: { value: string; trend: "up" | "down" | "neutral" };
    rank?: { value: string; trend: "up" | "down" | "neutral" };
  };
  isPersonalBest?: boolean;
}

interface UpcomingData {
  tests: {
    id: string;
    title: string;
    dateStr: string;
    startAt: string;
    durationMinutes: number;
    questionCount: number;
    isActive: boolean;
    timeGroup: "Tomorrow" | "This Week" | "Later";
  }[];
}

interface RecentData {
  tests: {
    id: string;
    testId?: string;
    title: string;
    dateStr: string;
    score: number;
    rank: number | null;
  }[];
}

interface WeeklyData {
  activeDays: number[];
}

interface StudentDashboardPresentationProps {
  hero: HeroData;
  pulse: PulseData;
  upcoming: UpcomingData;
  recent: RecentData;
  weekly: WeeklyData;
}

export function StudentDashboardPresentation({
  hero,
  pulse,
  upcoming,
  recent,
  weekly,
}: StudentDashboardPresentationProps) {

  // Derive the single Next Action
  let nextAction: any = null;
  const activeTest = upcoming.tests.find(t => t.isActive);
  const tomorrowTest = upcoming.tests.find(t => t.timeGroup === "Tomorrow");
  const laterTest = upcoming.tests.length > 0 ? upcoming.tests[0] : null;
  const lastCompleted = recent.tests.length > 0 ? recent.tests[0] : null;

  if (activeTest) {
    nextAction = {
      type: "active",
      title: activeTest.title,
      subtitle: "In Progress",
      ctaText: "Continue",
      ctaHref: `/student/tests/${activeTest.id}`
    };
  } else if (tomorrowTest) {
    nextAction = {
      type: "upcoming",
      title: tomorrowTest.title,
      subtitle: "Starts tomorrow",
      ctaText: "Prepare",
      ctaHref: `/student/tests`
    };
  } else if (laterTest) {
    nextAction = {
      type: "upcoming",
      title: laterTest.title,
      subtitle: `Starts ${laterTest.timeGroup.toLowerCase()}`,
      ctaText: "View Schedule",
      ctaHref: `/student/tests`
    };
  } else if (lastCompleted) {
    // Route contract: /student/tests/[examId]/solutions
    // Always pass examId (testId).
    nextAction = {
      type: "review",
      title: lastCompleted.title,
      subtitle: "Last completed",
      ctaText: "Review Solutions",
      ctaHref: `/student/tests/${lastCompleted.testId}/solutions`
    };
  } else {
    nextAction = {
      type: "performance",
      title: "No immediate tests",
      subtitle: "Check your analytics",
      ctaText: "View Performance",
      ctaHref: "/student/reports"
    };
  }

  return (
    <div className="flex flex-col gap-12 lg:gap-16 pb-16">
      <DashboardHero
        greeting={hero.greeting}
        recommendation={hero.recommendation}
        ctaText={hero.ctaText}
        ctaHref={hero.ctaHref}
      />

      <PerformancePulse
        testsTaken={pulse.testsTaken}
        avgAccuracy={pulse.avgAccuracy}
        avgRank={pulse.avgRank}
        deltas={pulse.deltas}
        isPersonalBest={pulse.isPersonalBest}
      />

      {/* Visually 'Next Action', using the existing component file */}
      <UpcomingTestsPreview nextAction={nextAction} />

      <RecentActivity tests={recent.tests} />

      <WeeklyMomentum activeDays={weekly.activeDays} />
    </div>
  );
}
