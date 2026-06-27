"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TestAnalyticsPanel } from "@/components/institute/test-analytics-panel";
import { ExamSolutionProgress } from "@/components/institute/ExamSolutionProgress";
import { getRepositories } from "@/lib/repositories/provider";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import type { InstituteStudent } from "@/types/institute-ops";
import type { TestResultBreakdown } from "@/types/test-session";

type SubmissionRow = {
  sessionId: string;
  studentId: string;
  score: number;
  maxScore: number;
  submittedAt: number;
  flagged: boolean;
  resultBreakdown: TestResultBreakdown;
};

export default function InstituteTestDetailPage() {
  const params = useParams();
  const testId = params.testId as string;
  const router = useRouter();
  const hydrateSession = useWorkspaceAuthStore((s) => s.hydrateSession);
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId);
  const [students, setStudents] = useState<InstituteStudent[]>([]);
  const [serverSubmissions, setServerSubmissions] = useState<SubmissionRow[]>([]);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    setStudents(getRepositories().students.list());
  }, [testId, instituteId]);

  const test = useMemo(() => getRepositories().exams.getById(testId), [testId]);

  useEffect(() => {
    if (!test || !instituteId) return;
    fetch(`/api/institute/submissions/test/${encodeURIComponent(test.id)}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : { submissions: [] }))
      .then((data) => setServerSubmissions(data.submissions ?? []))
      .catch(() => setServerSubmissions([]));
  }, [test, instituteId]);

  const nameByRoll = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of students) m.set(s.rollNumber, s.fullName);
    return m;
  }, [students]);

  const nameByRollRecord = useMemo(() => {
    const o: Record<string, string> = {};
    nameByRoll.forEach((v, k) => {
      o[k] = v;
    });
    return o;
  }, [nameByRoll]);

  if (!test) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">Test not found or not in your workspace.</p>
        <Link href="/institute/tests" className={cn(buttonVariants({ variant: "link" }))}>
          Back
        </Link>
      </div>
    );
  }

  const avg =
    serverSubmissions.length > 0
      ? serverSubmissions.reduce((a, x) => a + x.score, 0) / serverSubmissions.length
      : null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link href="/institute/tests" className="text-sm text-[#1a3c6e] hover:underline">
          ← All tests
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{test.title}</h1>
        <p className="text-sm text-gray-600">
          {test.durationMinutes} min · {Object.keys(test.questions).length} questions · total marks{" "}
          {Object.values(test.questions).reduce((sum, q) => sum + (q.marks ?? 0), 0)}
          {avg != null && ` · cohort avg ${avg.toFixed(2)}`}
        </p>
        <ExamSolutionProgress testId={testId} totalQuestions={Object.keys(test.questions).length} />
      </div>

      {instituteId && (
        <TestAnalyticsPanel
          testId={test.id}
          instituteId={instituteId}
          nameByRoll={nameByRollRecord}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Student results</CardTitle>
          <CardDescription>Scores from submitted attempts in this tenant.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-gray-600">
                <tr>
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Roll</th>
                  <th className="py-2 pr-4">Score</th>
                  <th className="py-2">Correct / total Q</th>
                  <th className="py-2">Integrity</th>
                </tr>
              </thead>
              <tbody>
                {serverSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-gray-500">
                      No submissions yet.
                    </td>
                  </tr>
                ) : (
                  serverSubmissions.map((r) => (
                    <tr key={r.sessionId} className="border-t border-gray-100">
                      <td className="py-2 pr-4">
                        {nameByRoll.get(r.studentId) ?? "—"}
                      </td>
                      <td className="py-2 pr-4">{r.studentId}</td>
                      <td className="py-2 pr-4">
                        {r.score}/{r.maxScore}
                      </td>
                      <td className="py-2">
                        {r.resultBreakdown.correct}/{r.resultBreakdown.perQuestion.length}
                      </td>
                      <td className="py-2">
                        {r.flagged ? (
                          <span className="font-medium text-amber-700">Flagged</span>
                        ) : (
                          "Clear"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ButtonRow router={router} />
    </div>
  );
}

function ButtonRow({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className={cn(buttonVariants({ variant: "outline" }))}
        onClick={() => router.push("/institute/tests")}
      >
        Close
      </button>
    </div>
  );
}
