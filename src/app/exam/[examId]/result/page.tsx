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
      <header className="bg-[#1a3c6e] px-6 py-4 text-center text-white">
        <h1 className="text-xl font-bold">Examination Submitted Successfully</h1>
        <p className="text-sm text-blue-100">{exam.title}</p>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-[#1a3c6e]">Score Summary</CardTitle>
            <CardDescription>
              {result.candidateName} · Roll {result.rollNumber}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Total Score" value={`${result.totalScore} / ${result.maxScore}`} />
              <Stat label="Correct" value={String(result.correct)} highlight="green" />
              <Stat label="Incorrect" value={String(result.incorrect)} highlight="red" />
              <Stat label="Unattempted" value={String(result.unattempted)} />
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
          Phase 1 demo — scores computed from mock answer keys stored locally.
        </p>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "green" | "red";
}) {
  return (
    <div className="rounded border bg-white p-3 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={`text-lg font-bold ${
          highlight === "green"
            ? "text-green-700"
            : highlight === "red"
              ? "text-red-700"
              : "text-[#1a3c6e]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
