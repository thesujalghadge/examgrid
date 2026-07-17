"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CTAButton } from "@/components/ui/student/cta-button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getExamById } from "@/lib/exam-catalog";
import { loadExamAttempt } from "@/lib/persistence";
import { getRepositories } from "@/lib/repositories/provider";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import type { ExamResult, SectionScore } from "@/types/exam";
import type { TestQuestionResult, TestResultBreakdown } from "@/types/test-session";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function StudentCbtResultPage() {
  const params = useParams();
  const testId = params.testId as string;
  const router = useRouter();
  const candidate = useAuthStore((s) => s.candidate);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [integrityScore, setIntegrityScore] = useState<number | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [rank, setRank] = useState<number | null>(null);
  const [percentile, setPercentile] = useState<number | null>(null);
  const [negativeMarks, setNegativeMarks] = useState<number>(0);

  const exam = getExamById(testId);

  useEffect(() => {
    if (!candidate) {
      router.replace("/student/login");
      return;
    }
    const ws = useWorkspaceAuthStore.getState().session;
    if (
      !exam
    ) {
      router.replace("/student/tests");
      return;
    }

    if (ws?.instituteId) {
      // Institute CBT: fetch from server
      fetch(`/api/cbt/test-session/result?testId=${encodeURIComponent(testId)}`)
        .then((res) => {
          if (!res.ok) throw new Error("Not found");
          return res.json();
        })
        .then((data) => {
          setIntegrityScore(data.integrityScore ?? null);
          setFlagged(data.flagged ?? false);
          if (data.rank != null) setRank(data.rank);
          if (data.percentile != null) setPercentile(data.percentile);
          
          // Map backend breakdown to ExamResult format
          const bd = data.resultBreakdown as TestResultBreakdown | undefined;
          if (bd) {
            setNegativeMarks(bd.negativeMarks || 0);
            const sectionScores: SectionScore[] = exam.sections.map((section) => {
              const rows = bd.perQuestion.filter((row: TestQuestionResult) =>
                section.questionIds.includes(row.questionId),
              );
              return {
                sectionId: section.id,
                sectionName: section.name,
                total: section.questionIds.length,
                attempted: rows.filter((row) => row.selected != null).length,
                correct: rows.filter((row) => row.correct).length,
                incorrect: rows.filter(
                  (row) => row.selected != null && !row.correct,
                ).length,
                unattempted:
                  section.questionIds.length -
                  rows.filter((row) => row.selected != null).length,
                score: rows.reduce(
                  (sum, row) => sum + row.marksAwarded,
                  0,
                ),
              };
            });
            setResult({
              examId: testId,
              examTitle: exam.title,
              totalQuestions: bd.correct + bd.incorrect + bd.unattempted,
              candidateName: candidate.name,
              rollNumber: candidate.rollNumber,
              totalScore: bd.finalScore,
              maxScore: bd.maxScore,
              correct: bd.correct,
              incorrect: bd.incorrect,
              unattempted: bd.unattempted,
              attempted: bd.attempted,
              durationUsedSeconds: bd.durationSeconds,
              submittedAt: data.submittedAt,
              sectionScores,
            });
          }
        })
        .catch(() => {
          setFetchError("Fetch failed");
        });
    } else {
      // Standalone/Mock fallback
      const attempt = loadExamAttempt(testId, candidate.rollNumber);
      if (attempt?.result) {
        setResult(attempt.result);
      } else {
        router.replace(`/student/tests/${testId}`);
      }
    }
  }, [candidate, exam, router, testId]);

  if (fetchError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-red-600 bg-red-50 p-6 rounded border border-red-200">
          <h2 className="font-bold text-lg mb-2">Pipeline Divergence Detected</h2>
          <pre className="text-sm whitespace-pre-wrap">{fetchError}</pre>
        </div>
      </div>
    );
  }


  if (!candidate || !result || !exam) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[15px] text-[var(--eg-text-secondary)]">
        Loading result...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--eg-background)] pb-16">
      <header className="bg-[var(--eg-accent)] px-6 py-10 text-center text-white">
        <h1 className="text-[32px] font-bold tracking-tight">Test submitted</h1>
        <p className="mt-2 text-[15px] font-medium text-white/80">{exam.title}</p>
      </header>

      <main className="mx-auto max-w-[900px] -mt-6 space-y-6 px-4 sm:px-6">
        <div className="rounded-[32px] bg-white p-6 sm:p-8" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 30px rgba(0,0,0,0.02)" }}>
          <div className="mb-6">
            <h2 className="text-[20px] font-bold text-[var(--eg-text-primary)]">Score summary</h2>
            <div className="flex justify-between items-center">
              <p className="text-[14px] text-[var(--eg-text-secondary)]">
                {result.candidateName} | Roll {result.rollNumber}
              </p>
              <div className="flex gap-4">
                {rank != null && (
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)]">Rank</p>
                    <p className="text-[18px] font-bold text-[var(--eg-text-primary)]">#{rank}</p>
                  </div>
                )}
                {percentile != null && (
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)]">Percentile</p>
                    <p className="text-[18px] font-bold text-[#14213d]">{percentile}%</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-6">
            <Stat label="Total" value={`${result.totalScore} / ${result.maxScore}`} />
            <Stat
              label="Accuracy"
              value={
                result.attempted > 0
                  ? `${Math.round((result.correct / result.attempted) * 100)}%`
                  : "0%"
              }
            />
            <Stat label="Correct" value={String(result.correct)} green />
            <Stat label="Incorrect" value={String(result.incorrect)} red />
            <Stat label="Unattempted" value={String(result.unattempted)} />
            <Stat label="-Ve Marks" value={String(negativeMarks)} red />
          </div>
          
          <div className="rounded-2xl bg-[var(--eg-surface-soft)] p-4 text-[13px] font-semibold text-[var(--eg-text-secondary)] flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-6">
              <div>
                <span className="uppercase tracking-wider text-[var(--eg-text-tertiary)] mr-2">Time used</span> 
                {formatDuration(result.durationUsedSeconds)}
              </div>
              <div>
                <span className="uppercase tracking-wider text-[var(--eg-text-tertiary)] mr-2">Avg Time / Q</span> 
                {result.attempted > 0 ? `${Math.round((result.durationUsedSeconds / result.attempted))}s` : "0s"}
              </div>
            </div>
            <div>
              <span className="uppercase tracking-wider text-[var(--eg-text-tertiary)] mr-2">Submitted</span> 
              {new Date(result.submittedAt).toLocaleString("en-IN")}
            </div>
          </div>
          
          {integrityScore != null ? (
            <p className="mt-4 text-[13px] font-semibold text-[var(--eg-text-secondary)]">
              Integrity score: {integrityScore}/100
              {flagged ? (
                <span className="ml-2 font-bold text-[var(--eg-danger)]">
                  Session flagged for review
                </span>
              ) : null}
            </p>
          ) : null}
        </div>

        <div className="rounded-[32px] bg-white p-6 sm:p-8" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 30px rgba(0,0,0,0.02)" }}>
          <h2 className="mb-6 text-[20px] font-bold text-[var(--eg-text-primary)]">Sections</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--eg-border)] text-left text-[12px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)]">
                  <th className="pb-3 px-2">Section</th>
                  <th className="pb-3 px-2">Attempted</th>
                  <th className="pb-3 px-2">Correct</th>
                  <th className="pb-3 px-2">Wrong</th>
                  <th className="pb-3 px-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {result.sectionScores.map((section) => (
                  <tr key={section.sectionId} className="border-b border-[var(--eg-border)] last:border-0 text-[14px]">
                    <td className="py-4 px-2 font-bold text-[var(--eg-text-primary)]">{section.sectionName}</td>
                    <td className="py-4 px-2 font-medium text-[var(--eg-text-secondary)]">
                      {section.attempted}/{section.total}
                    </td>
                    <td className="py-4 px-2 font-bold text-[var(--eg-success)]">{section.correct}</td>
                    <td className="py-4 px-2 font-bold text-[var(--eg-danger)]">{section.incorrect}</td>
                    <td className="py-4 px-2 font-bold text-[var(--eg-text-primary)]">{section.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4 pt-6">
          <CTAButton href="/student/tests" variant="outline">
            Back to tests
          </CTAButton>
          <CTAButton href={`/student/tests/${testId}/solutions`} variant="primary">
            View Solutions
          </CTAButton>
          <CTAButton href="/student/reports" variant="ghost">
            View analysis
          </CTAButton>
        </div>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  green,
  red,
}: {
  label: string;
  value: string;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[20px] bg-[var(--eg-surface-soft)] p-4 sm:p-5">
      <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)]">{label}</span>
      <span
        className={`text-[22px] sm:text-[24px] font-bold leading-none ${
          green ? "text-[var(--eg-success)]" : red ? "text-[var(--eg-danger)]" : "text-[var(--eg-text-primary)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
