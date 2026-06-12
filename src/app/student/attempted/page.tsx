"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildStudentInsights } from "@/lib/student-insights";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

export default function StudentAttemptedPage() {
  const candidate = useAuthStore((s) => s.candidate);
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId ?? "");

  const insights = useMemo(() => {
    if (!candidate || !instituteId) return null;
    return buildStudentInsights(candidate.rollNumber, instituteId);
  }, [candidate, instituteId]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Attempted tests</h2>
        <p className="text-sm text-[#5e5a52]">
          Your completed CBT attempts stay here with direct links to detailed results.
        </p>
      </div>

      <Card className="border-[#d8d2c7]">
        <CardHeader>
          <CardTitle className="text-base text-[#14213d]">History</CardTitle>
        </CardHeader>
        <CardContent>
          {!insights || insights.recentResults.length === 0 ? (
            <p className="text-sm text-[#5e5a52]">No submitted tests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#ece6da] text-[#6b7280]">
                  <tr>
                    <th className="pb-3">Test</th>
                    <th className="pb-3">Score</th>
                    <th className="pb-3">Correct</th>
                    <th className="pb-3">Attempted</th>
                    <th className="pb-3">Time</th>
                    <th className="pb-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.recentResults.map((result) => (
                    <tr key={result.testId} className="border-b border-[#f1ece4]">
                      <td className="py-3 font-medium text-[#14213d]">{result.title}</td>
                      <td className="py-3">{result.score.toFixed(1)}</td>
                      <td className="py-3">{result.correct}</td>
                      <td className="py-3">{result.attempted}</td>
                      <td className="py-3">{Math.round(result.durationSeconds / 60)} min</td>
                      <td className="py-3">
                        <Link
                          href={`/student/tests/${result.testId}/result`}
                          className="font-medium text-[#8a6f3e] hover:text-[#6f582f]"
                        >
                          View result
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
