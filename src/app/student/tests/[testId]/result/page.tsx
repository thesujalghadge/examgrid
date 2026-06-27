"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
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
  const hydrateWs = useWorkspaceAuthStore((s) => s.hydrate);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [integrityScore, setIntegrityScore] = useState<number | null>(null);
  const [flagged, setFlagged] = useState(false);

  useEffect(() => {
    hydrateWs();
  }, [hydrateWs]);

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
          
          // Map backend breakdown to ExamResult format
          const bd = data.resultBreakdown as TestResultBreakdown | undefined;
          if (bd) {
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
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Loading result...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-[#1a3c6e] px-6 py-4 text-center text-white">
        <h1 className="text-xl font-bold">Test submitted</h1>
        <p className="text-sm text-blue-100">{exam.title}</p>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-[#1a3c6e]">Score summary</CardTitle>
            <CardDescription>
              {result.candidateName} | Roll {result.rollNumber}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
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
            </div>
            <p className="text-sm text-gray-600">
              Time used: {formatDuration(result.durationUsedSeconds)} | Submitted:{" "}
              {new Date(result.submittedAt).toLocaleString("en-IN")}
            </p>
            {integrityScore != null ? (
              <p className="mt-2 text-sm text-gray-600">
                Integrity score: {integrityScore}/100
                {flagged ? (
                  <span className="ml-2 font-medium text-amber-700">
                    Session flagged for review
                  </span>
                ) : null}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sections</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="pb-2">Section</th>
                  <th className="pb-2">Attempted</th>
                  <th className="pb-2">Correct</th>
                  <th className="pb-2">Wrong</th>
                  <th className="pb-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {result.sectionScores.map((section) => (
                  <tr key={section.sectionId} className="border-b border-gray-100">
                    <td className="py-2 font-medium">{section.sectionName}</td>
                    <td className="py-2">
                      {section.attempted}/{section.total}
                    </td>
                    <td className="py-2 text-green-700">{section.correct}</td>
                    <td className="py-2 text-red-700">{section.incorrect}</td>
                    <td className="py-2 font-semibold">{section.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/student/tests" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to tests
          </Link>
          <Link href={`/student/tests/${testId}/solutions`} className={cn(buttonVariants({ variant: "default" }), "bg-[#1a3c6e]")}>
            View Solutions
          </Link>
          <Button variant="ghost" onClick={() => router.push("/student/reports")}>
            View analysis
          </Button>
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
    <div className="rounded border bg-white p-3 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={`text-lg font-bold ${
          green ? "text-green-700" : red ? "text-red-700" : "text-[#1a3c6e]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
