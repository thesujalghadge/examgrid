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
import { getQuestionBank } from "@/services/question-bank-service";
import { listTestSessionsForTest } from "@/services/test-session-engine";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import type { ExamResult } from "@/types/exam";

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
    const test = getRepositories().cbtTests.getById(testId);
    const ws = useWorkspaceAuthStore.getState().session;
    if (!test || (ws?.instituteId && test.instituteId !== ws.instituteId)) {
      router.replace("/student/tests");
      return;
    }
    const attempt = loadExamAttempt(testId, candidate.rollNumber);
    if (attempt?.result) {
      setResult(attempt.result);
    } else {
      router.replace(`/student/tests/${testId}`);
    }
    if (ws?.instituteId) {
      const session = listTestSessionsForTest(testId, ws.instituteId).find(
        (entry) =>
          entry.studentId === candidate.rollNumber &&
          (entry.status === "submitted" || entry.status === "auto_submitted"),
      );
      if (session) {
        setIntegrityScore(session.integrityScore ?? null);
        setFlagged(session.flagged ?? false);
      }
    }
  }, [candidate, router, testId]);

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
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Total" value={`${result.totalScore} / ${result.maxScore}`} />
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

        <SolutionsPanel testId={testId} />

        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/student/tests" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to tests
          </Link>
          <Button className="bg-[#1a3c6e]" onClick={() => router.push("/student/reports")}>
            View analysis
          </Button>
        </div>
      </main>
    </div>
  );
}

function SolutionsPanel({ testId }: { testId: string }) {
  const test = getRepositories().cbtTests.getById(testId);
  const bank = new Map(getQuestionBank().map((q) => [q.id, q]));
  if (!test) return null;

  const rows = test.questions
    .map((row, index) => {
      const bankQ = row.bankQuestionId ? bank.get(row.bankQuestionId) : null;
      if (!bankQ?.solution) return null;
      return {
        key: row.questionId,
        index: index + 1,
        subject: bankQ.subject,
        text: bankQ.questionText.slice(0, 120),
        solution: bankQ.solution,
        correct: bankQ.correctAnswer,
      };
    })
    .filter(Boolean) as Array<{
    key: string;
    index: number;
    subject: string;
    text: string;
    solution: string;
    correct: string;
  }>;

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Solutions & review</CardTitle>
        <CardDescription>Official solutions for this paper (PYQ-style review).</CardDescription>
      </CardHeader>
      <CardContent className="max-h-96 space-y-3 overflow-y-auto text-sm">
        {rows.map((row) => (
          <div key={row.key} className="rounded border border-gray-100 p-3">
            <p className="font-medium text-[#1a3c6e]">
              Q{row.index} · {row.subject}
            </p>
            <p className="text-gray-600">{row.text}…</p>
            <p className="mt-1 text-green-800">Answer: {row.correct}</p>
            <p className="mt-1 text-gray-700">{row.solution}</p>
          </div>
        ))}
      </CardContent>
    </Card>
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
