"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { DashboardPanel, SectionHeader, StatusBadge } from "@/components/shared/product-ui";
import { cn } from "@/lib/utils";
import { getExamById } from "@/data/mock-exams";
import { clearExamAttempt, loadExamAttempt } from "@/lib/persistence";
import { useAuthStore } from "@/stores/auth-store";
import type { ExamResult } from "@/types/exam";
import { Target, Trophy, Clock, BrainCircuit, Activity, AlertTriangle, ArrowRight, BookOpen } from "lucide-react";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

export default function ResultPage() {
  const params = useParams();
  const examId = params.examId as string;
  const router = useRouter();
  const candidate = useAuthStore((s) => s.candidate);
  const [result, setResult] = useState<ExamResult | null>(null);

  const exam = getExamById(examId);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!candidate) {
        router.replace("/login");
        return;
      }
      const attempt = loadExamAttempt(examId, candidate.rollNumber);
      if (attempt?.result) {
        setResult(attempt.result);
      } else {
        router.replace(`/exam/${examId}/instructions`);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [candidate, examId, router]);

  if (!candidate || !result || !exam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 text-sm text-muted-foreground">
        <Activity className="mr-2 h-4 w-4 animate-spin" /> Analyzing performance...
      </div>
    );
  }

  const accuracy = Math.round((result.correct / result.attempted) * 100) || 0;
  const timePerQ = Math.round(result.durationUsedSeconds / (result.attempted || 1));

  return (
    <div className="min-h-screen bg-muted/20 pb-12">
      {/* Top Banner */}
      <div className="bg-primary px-4 py-8 text-primary-foreground sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-primary-foreground/80 mb-1">
                Performance Intelligence
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {exam.title}
              </h1>
              <p className="mt-2 text-sm text-primary-foreground/80">
                {candidate.name} · Completed {new Date(result.submittedAt).toLocaleDateString("en-IN", { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {result.violationCount != null && result.violationCount > 0 ? (
              <div className="flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-200 ring-1 ring-amber-500/50">
                <AlertTriangle className="h-4 w-4" /> Integrity Flag
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 ring-1 ring-emerald-500/50">
                <Trophy className="h-4 w-4" /> Verified Clean Session
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 -mt-6">
        {/* Core Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <DashboardPanel className="bg-card shadow-md flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Total Score</p>
              <p className="text-2xl font-bold text-foreground">
                {result.totalScore} <span className="text-sm text-muted-foreground font-normal">/ {result.maxScore}</span>
              </p>
            </div>
          </DashboardPanel>

          <DashboardPanel className="bg-card shadow-md flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Accuracy</p>
              <p className="text-2xl font-bold text-foreground">{accuracy}%</p>
            </div>
          </DashboardPanel>

          <DashboardPanel className="bg-card shadow-md flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Time Invested</p>
              <p className="text-2xl font-bold text-foreground">{formatDuration(result.durationUsedSeconds)}</p>
            </div>
          </DashboardPanel>

          <DashboardPanel className="bg-card shadow-md flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Pacing</p>
              <p className="text-2xl font-bold text-foreground">{timePerQ}s <span className="text-sm text-muted-foreground font-normal">/ q</span></p>
            </div>
          </DashboardPanel>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <DashboardPanel>
              <SectionHeader title="Section Diagnostics" description="Detailed breakdown of your performance across subjects." />
              <div className="mt-4 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Subject</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-center">Score</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-center">Accuracy</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-right">Hit/Miss</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.sectionScores.map((s) => {
                      const secAccuracy = Math.round((s.correct / (s.attempted || 1)) * 100);
                      return (
                        <tr key={s.sectionId} className="bg-card hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-4 font-semibold text-foreground">{s.sectionName}</td>
                          <td className="px-4 py-4 text-center font-bold text-primary">{s.score}</td>
                          <td className="px-4 py-4 text-center">
                            <StatusBadge tone={secAccuracy > 70 ? "green" : secAccuracy > 40 ? "amber" : "red"}>
                              {secAccuracy}%
                            </StatusBadge>
                          </td>
                          <td className="px-4 py-4 text-right text-xs">
                            <span className="text-emerald-600 font-medium">{s.correct}</span>
                            <span className="text-muted-foreground mx-1">/</span>
                            <span className="text-red-600 font-medium">{s.incorrect}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </DashboardPanel>
            
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button onClick={() => router.push("/exams")} size="lg" className="flex-1 shadow-sm">
                Return to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  clearExamAttempt(examId, candidate.rollNumber);
                  router.push(`/exam/${examId}/instructions`);
                }}
                className="flex-1"
              >
                Retake Exam
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {result.academicInsights && (
              <DashboardPanel className="bg-gradient-to-b from-card to-muted/20 border-primary/10">
                <div className="flex items-center gap-2 mb-4">
                  <BrainCircuit className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold text-foreground">AI Knowledge Graph</h2>
                </div>
                
                {result.academicInsights.suggestedRevisionTopics.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Based on your error patterns, the intelligence engine recommends immediate revision in the following areas:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.academicInsights.suggestedRevisionTopics.map((topic) => (
                        <span
                          key={topic}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400"
                        >
                          <BookOpen className="h-3.5 w-3.5 opacity-70" />
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    No critical weaknesses detected in this session. Excellent performance!
                  </p>
                )}
                
                <div className="mt-8 border-t border-border pt-4">
                  <Button variant="link" className="px-0 text-primary h-auto font-semibold">
                    View full concept breakdown <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </DashboardPanel>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
