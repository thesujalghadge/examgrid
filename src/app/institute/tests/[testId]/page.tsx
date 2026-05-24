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
import { getRepositories } from "@/lib/repositories/provider";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import type { InstituteStudent } from "@/types/institute-ops";

export default function InstituteTestDetailPage() {
  const params = useParams();
  const testId = params.testId as string;
  const router = useRouter();
  const hydrateSession = useWorkspaceAuthStore((s) => s.hydrateSession);
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId);
  const [students, setStudents] = useState<InstituteStudent[]>([]);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    setStudents(getRepositories().students.list());
  }, [testId, instituteId]);

  const test = useMemo(() => getRepositories().cbtTests.getById(testId), [testId]);

  const attempts = useMemo(
    () => (test ? getRepositories().cbtAttempts.listByTestId(test.id) : []),
    [test],
  );

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
    attempts.length === 0
      ? null
      : attempts.reduce((a, x) => a + (x.attempt.score ?? 0), 0) / attempts.length;

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link href="/institute/tests" className="text-sm text-[#1a3c6e] hover:underline">
          ← All tests
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{test.title}</h1>
        <p className="text-sm text-gray-600">
          {test.durationMinutes} min · {test.questions.length} questions · total marks{" "}
          {test.totalMarks}
          {avg != null && ` · cohort avg ${avg.toFixed(2)}`}
        </p>
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
                </tr>
              </thead>
              <tbody>
                {attempts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-gray-500">
                      No submissions yet.
                    </td>
                  </tr>
                ) : (
                  attempts.map((r) => {
                    const correct = r.responses.filter((x) => x.isCorrect).length;
                    return (
                      <tr key={r.attempt.id} className="border-t border-gray-100">
                        <td className="py-2 pr-4">
                          {nameByRoll.get(r.attempt.studentId) ?? "—"}
                        </td>
                        <td className="py-2 pr-4">{r.attempt.studentId}</td>
                        <td className="py-2 pr-4">{r.attempt.score ?? "—"}</td>
                        <td className="py-2">
                          {correct}/{r.responses.length}
                        </td>
                      </tr>
                    );
                  })
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
