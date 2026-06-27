"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  fetchServerTestAnalytics,
} from "@/lib/cbt/client-test-analytics";
import type { TestAnalytics } from "@/types/test-session";

export function TestAnalyticsPanel({
  testId,
  instituteId,
  nameByRoll,
}: {
  testId: string;
  instituteId: string;
  nameByRoll: Record<string, string>;
}) {
  const [server, setServer] = useState<TestAnalytics | null>(null);

  useEffect(() => {
    void fetchServerTestAnalytics(testId).then(setServer);
  }, [testId]);

  const data = server;

  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Test analytics</CardTitle>
        <CardDescription>
          Completion, averages, top performers, and weak questions (tenant-scoped).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Submissions" value={String(data.attemptCount)} />
          <Metric
            label="Completion rate"
            value={`${(data.completionRate * 100).toFixed(1)}%`}
          />
          <Metric label="Avg score" value={data.averageScore.toFixed(2)} />
          <Metric label="Avg %" value={`${data.averagePercent.toFixed(1)}%`} />
        </div>

        {data.topPerformers.length > 0 && (
          <div>
            <p className="mb-2 font-medium text-gray-800">Top performers</p>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="pb-1">Rank</th>
                  <th className="pb-1">Student</th>
                  <th className="pb-1">Score</th>
                  <th className="pb-1">Time</th>
                </tr>
              </thead>
              <tbody>
                {data.topPerformers.map((e) => (
                  <tr key={e.studentId} className="border-b border-gray-100">
                    <td className="py-1">{e.rank}</td>
                    <td className="py-1">
                      {e.studentName ?? e.studentId}
                      {e.flagged ? (
                        <span className="ml-1 text-xs text-amber-600">flagged</span>
                      ) : null}
                    </td>
                    <td className="py-1">
                      {e.score}/{e.maxScore}
                    </td>
                    <td className="py-1">{e.durationSeconds}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.weakQuestions.length > 0 && (
          <div>
            <p className="mb-2 font-medium text-gray-800">Weak questions</p>
            <ul className="list-inside list-disc text-gray-700">
              {data.weakQuestions.slice(0, 8).map((w) => (
                <li key={w.questionId}>
                  {w.questionId}: {(w.incorrectRate * 100).toFixed(0)}% incorrect (
                  {w.attemptCount} attempts)
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-[#1a3c6e]">{value}</p>
    </div>
  );
}
