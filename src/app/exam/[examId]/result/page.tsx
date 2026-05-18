"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { MetricCard, StatusBadge } from "@/components/shared/product-ui";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getExamById } from "@/data/mock-exams";
import { clearExamAttempt, loadExamAttempt } from "@/lib/persistence";
import { useAuthStore } from "@/stores/auth-store";
import type { ExamResult } from "@/types/exam";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
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
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Loading result…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-[#123763] px-6 py-4 text-center text-white">
        <h1 className="text-xl font-bold">Examination Submitted Successfully</h1>
        <p className="text-sm text-blue-100">{exam.title}</p>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-[#123763]">Score Summary</CardTitle>
              <StatusBadge tone={result.violationCount ? "amber" : "green"}>
                {result.violationCount ? "Review integrity log" : "Clean session"}
              </StatusBadge>
            </div>
            <CardDescription>
              {result.candidateName} · Roll {result.rollNumber}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MetricCard label="Total Score" value={`${result.totalScore} / ${result.maxScore}`} />
              <MetricCard label="Correct" value={result.correct} tone="good" />
              <MetricCard label="Incorrect" value={result.incorrect} tone="warn" />
              <MetricCard label="Unattempted" value={result.unattempted} />
            </div>
            <p className="text-sm text-gray-600">
              Time used: {formatDuration(result.durationUsedSeconds)} · Submitted:{" "}
              {new Date(result.submittedAt).toLocaleString("en-IN")}
              {result.violationCount != null && result.violationCount > 0 && (
                <> · Integrity violations: {result.violationCount}</>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Section-wise Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-600">
                    <th className="pb-2 pr-4">Section</th>
                    <th className="pb-2 pr-4">Attempted</th>
                    <th className="pb-2 pr-4">Correct</th>
                    <th className="pb-2 pr-4">Wrong</th>
                    <th className="pb-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {result.sectionScores.map((s) => (
                    <tr key={s.sectionId} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-medium">{s.sectionName}</td>
                      <td className="py-2 pr-4">{s.attempted}/{s.total}</td>
                      <td className="py-2 pr-4 text-green-700">{s.correct}</td>
                      <td className="py-2 pr-4 text-red-700">{s.incorrect}</td>
                      <td className="py-2 font-semibold">{s.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {result.academicInsights && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Academic Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {result.academicInsights.subjectBreakdown.map((subject) => (
                  <div key={subject.name} className="rounded border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase text-gray-500">
                      {subject.name}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[#123763]">
                      {subject.accuracy}%
                    </p>
                    <p className="text-xs text-gray-500">
                      {subject.correct}/{subject.attempted || subject.total} correct
                    </p>
                  </div>
                ))}
              </div>
              {result.academicInsights.suggestedRevisionTopics.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
                    Suggested revision
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.academicInsights.suggestedRevisionTopics.map((topic) => (
                      <span
                        key={topic}
                        className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/exams"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Back to Exams
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              clearExamAttempt(examId, candidate.rollNumber);
              router.push(`/exam/${examId}/instructions`);
            }}
          >
            Retake Exam
          </Button>
          <Button
            className="bg-[#1a3c6e] hover:bg-[#152d52]"
            onClick={() => router.push("/login")}
          >
            Logout
          </Button>
        </div>

        <p className="text-center text-xs text-gray-500">
          Scores are calculated from the configured answer key for this demo exam.
        </p>
      </main>
    </div>
  );
}
