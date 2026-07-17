"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { createClient } from "@supabase/supabase-js";
import { getRepositories } from "@/lib/repositories/provider";
import { listAssignedExams } from "@/services/cbt-test-service";
import { findStudentForCandidate } from "@/services/institute-ops-service";
import { listSessionsLocal } from "@/services/test-session-engine";
import { loadExamAttempt } from "@/lib/persistence";

import { fetchStudentAttemptedExams } from "@/app/student/actions/analytics-fetch";
import { StudentDashboardPresentation } from "./student-dashboard-presentation";
import { DashboardSkeleton, DashboardErrorState } from "./dashboard-states";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function StudentDashboardContainer() {
  const candidate = useAuthStore((s) => s.candidate);
  const ws = useWorkspaceAuthStore((s) => s.session);
  const instituteId = ws?.instituteId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [recentTestsData, setRecentTestsData] = useState<any[]>([]);
  const [submittedTestIds, setSubmittedTestIds] = useState<Set<string>>(new Set());

  // Fetch student attempts and analytics
  const fetchDashboardData = async () => {
    if (!candidate || !instituteId || ws?.role !== "student") return;

    setLoading(true);
    setError(false);
    try {
      // 1. Fetch recent results via Server Action
      const recent = await fetchStudentAttemptedExams();
      setRecentTestsData(recent || []);

      // 2. Fetch raw attempts for assigned exams diffing
      if (candidate.studentId) {
        const { data: attempts } = await supabase
          .from("cbt_attempts")
          .select("test_id, submitted_at")
          .eq("student_id", candidate.studentId)
          .not("submitted_at", "is", null);

        if (attempts) {
          setSubmittedTestIds(new Set(attempts.map((r) => r.test_id)));
        }
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [candidate, instituteId, ws?.role]);

  // Derive Upcoming Tests
  const upcomingTests = useMemo(() => {
    if (!candidate) return [];

    const repos = getRepositories();
    const student = findStudentForCandidate(candidate);
    const exams = repos.exams.list();
    const schedules = repos.schedules.list();

    const assigned = listAssignedExams(student, exams, schedules).filter(
      ({ schedule }) => (!schedule.instituteId || !instituteId || schedule.instituteId === instituteId)
    );

    const activeLocalSessions = listSessionsLocal().filter(s => s.status === "in_progress" && s.studentId === candidate.rollNumber);

    const upcoming = assigned.map((row) => {
      const hasSubmitted = submittedTestIds.has(row.exam.id) || listSessionsLocal().some(s => (s.status === "submitted" || s.status === "auto_submitted") && s.testId === row.exam.id && s.studentId === candidate.rollNumber);
      const hasInProgress = !hasSubmitted && (activeLocalSessions.some(s => s.testId === row.exam.id) || Boolean(loadExamAttempt(row.exam.id, candidate.rollNumber)));

      return { ...row, hasSubmitted, hasInProgress };
    }).filter(row => {
      // Exclude tests that are submitted or completely missed (past their limit)
      if (row.hasSubmitted) return false;
      const startLimit = new Date(row.schedule.startAt).getTime() + 10 * 60 * 1000;
      const isLate = Date.now() > startLimit;
      const missed = row.status === "active" && !row.hasInProgress && isLate;
      if (missed || row.status === "completed") return false;
      return true;
    });

    return upcoming.map((row) => {
      const startDate = new Date(row.schedule.startAt);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let timeGroup: "Tomorrow" | "This Week" | "Later" = "Later";

      if (startDate.toDateString() === today.toDateString() || startDate.toDateString() === tomorrow.toDateString()) {
        timeGroup = "Tomorrow";
      } else if (startDate.getTime() < today.getTime() + 7 * 24 * 60 * 60 * 1000) {
        timeGroup = "This Week";
      }

      const dateStr = startDate.toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
      });

      return {
        id: row.exam.id,
        title: row.exam.title,
        dateStr,
        startAt: row.schedule.startAt,
        durationMinutes: row.exam.durationMinutes,
        questionCount: Object.keys(row.exam.questions).length,
        isActive: row.status === "active" || row.hasInProgress,
        timeGroup
      };
    }).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [candidate, instituteId, submittedTestIds]);

  // Derive Recent Tests
  const recentTests = useMemo(() => {
    return recentTestsData.slice(0, 3).map(result => {
      const accuracy = result.attempted_count && result.attempted_count > 0
        ? Math.round((result.correct_count / result.attempted_count) * 100)
        : 0;

      return {
        id: result.id,
        testId: result.cbt_attempts?.test_id,
        title: result.exams?.title || "Unknown Test",
        dateStr: new Date(result.generated_at).toLocaleDateString("en-IN", {
          day: "numeric", month: "short", year: "numeric"
        }),
        score: result.score || 0,
        accuracy,
        rank: result.rank || null
      };
    });
  }, [recentTestsData]);

  // Derive Performance Pulse
  const pulseProps = useMemo(() => {
    const testsTaken = recentTestsData.length;
    if (testsTaken === 0) {
      return { testsTaken: 0, avgAccuracy: null, avgRank: null, isPersonalBest: false };
    }

    let totalAccuracy = 0;
    let validRanks = 0;
    let totalRank = 0;
    let maxAccuracy = 0;

    let olderTotalAccuracy = 0;
    let olderValidRanks = 0;
    let olderTotalRank = 0;

    recentTestsData.forEach((result, index) => {
      let acc = 0;
      if (result.attempted_count && result.attempted_count > 0) {
        acc = Math.round((result.correct_count / result.attempted_count) * 100);
        totalAccuracy += acc;
        if (acc > maxAccuracy) maxAccuracy = acc;

        if (index > 0) {
          olderTotalAccuracy += acc;
        }
      }
      if (result.rank) {
        totalRank += result.rank;
        validRanks++;

        if (index > 0) {
          olderTotalRank += result.rank;
          olderValidRanks++;
        }
      }
    });

    const avgAccuracy = Math.round(totalAccuracy / testsTaken);
    const avgRank = validRanks > 0 ? Math.round(totalRank / validRanks) : null;

    const olderAvgAccuracy = testsTaken > 1 ? Math.round(olderTotalAccuracy / (testsTaken - 1)) : avgAccuracy;
    const olderAvgRank = olderValidRanks > 0 ? Math.round(olderTotalRank / olderValidRanks) : avgRank;

    let accuracyDelta;
    if (testsTaken > 1) {
      const diff = avgAccuracy - olderAvgAccuracy;
      accuracyDelta = {
        value: `${Math.abs(diff)}%`,
        trend: diff > 0 ? "up" : diff < 0 ? "down" : "neutral"
      } as const;
    }

    let rankDelta;
    if (testsTaken > 1 && avgRank !== null && olderAvgRank !== null) {
      const diff = olderAvgRank - avgRank; // lower rank is better, so older - current > 0 means up
      rankDelta = {
        value: `${Math.abs(diff)}`,
        trend: diff > 0 ? "up" : diff < 0 ? "down" : "neutral"
      } as const;
    }

    const latestAccuracy = recentTestsData[0]?.attempted_count ? Math.round((recentTestsData[0].correct_count / recentTestsData[0].attempted_count) * 100) : 0;
    const isPersonalBest = testsTaken > 1 && latestAccuracy >= maxAccuracy;

    return {
      testsTaken,
      avgAccuracy,
      avgRank,
      deltas: {
        ...(accuracyDelta ? { accuracy: accuracyDelta } : {}),
        ...(rankDelta ? { rank: rankDelta } : {})
      },
      isPersonalBest
    };
  }, [recentTestsData]);

  // Derive Hero Context — follows blueprint priority table exactly
  const heroProps = useMemo(() => {
    const hour = new Date().getHours();
    let timeGreeting = "Good evening";
    if (hour >= 5 && hour < 12) timeGreeting = "Good morning";
    else if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";

    const firstName = candidate?.name?.split(" ")[0] || "Student";
    
    // Sometimes we just say "Welcome back." if it feels appropriate, but timeGreeting is usually better.
    const baseGreeting = `${timeGreeting}, ${firstName}.`;

    // 1. Priority: Active or imminent upcoming test
    const immediateTest = upcomingTests.find((t) => t.isActive || t.timeGroup === "Tomorrow");
    if (immediateTest) {
      if (immediateTest.isActive) {
        return {
          greeting: baseGreeting,
          recommendation: `You have an active test, "${immediateTest.title}". You can start it now before the window closes.`,
          ctaText: "Start Test",
          ctaHref: `/student/tests/${immediateTest.id}`,
        };
      } else {
        return {
          greeting: baseGreeting,
          recommendation: `You have an upcoming test tomorrow: "${immediateTest.title}". Spend some time reviewing the relevant topics.`,
          ctaText: "View Details",
          ctaHref: `/student/tests`,
        };
      }
    }

    // 2. Priority: Recent result
    const latestResult = recentTests[0];
    if (latestResult && latestResult.testId) {
      const isVeryRecent = latestResult.dateStr === new Date().toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric"
      }) ? "today" : "recently";

      return {
        greeting: baseGreeting,
        recommendation: `You completed "${latestResult.title}" ${isVeryRecent}. Review the solutions before attempting another paper.`,
        ctaText: "Review Solutions",
        ctaHref: `/student/tests/${latestResult.testId}/solutions`,
      };
    }

    // 3. Priority: has history, no immediate action
    if (recentTests.length > 0) {
      return {
        greeting: "Welcome back.",
        recommendation: "Your schedule is clear today. Take a moment to review your past performance and identify weak areas.",
        ctaText: "View Performance",
        ctaHref: "/student/reports",
      };
    }

    // 4. Priority: truly new student
    return {
      greeting: baseGreeting,
      recommendation: "Welcome to ExamGrid. Your performance companion is ready. Take your first test to see your dashboard come alive.",
      ctaText: "View Upcoming Tests",
      ctaHref: "/student/tests",
    };
  }, [candidate, upcomingTests, recentTests]);

  // Compute Weekly Momentum (Active Days)
  const activeDays = useMemo(() => {
    const active = new Set<number>();
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday as 0
    startOfWeek.setHours(0, 0, 0, 0);

    recentTestsData.forEach(result => {
      const d = new Date(result.generated_at);
      if (d.getTime() >= startOfWeek.getTime()) {
        active.add(d.getDay());
      }
    });

    return Array.from(active).sort();
  }, [recentTestsData]);

  if (!candidate) return null;

  if (error) {
    return <DashboardErrorState onRetry={fetchDashboardData} />;
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <StudentDashboardPresentation
      hero={heroProps}
      pulse={pulseProps}
      upcoming={{ tests: upcomingTests }}
      recent={{ tests: recentTests }}
      weekly={{ activeDays }}
    />
  );
}
