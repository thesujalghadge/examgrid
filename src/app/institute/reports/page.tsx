"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { fetchInstituteReports } from "@/app/institute/actions/analytics-fetch";

export default function InstituteReportsPage() {
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId ?? "");
  const [reportRows, setReportRows] = useState<any[]>([]);

  useEffect(() => {
    if (!instituteId) return;
    async function load() {
      try {
        const data = await fetchInstituteReports();
        
        const rows = data.exams.map((exam: any) => ({
          id: exam.id,
          title: exam.title,
          submissions: exam.studentsCount || 0,
          averageScore: exam.averageScore || 0,
          averagePercent: 0, // Calculate this if needed or fetch total_marks server-side
          weakQuestions: 0,
        }));
        
        setReportRows(rows);
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, [instituteId]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Reports</h2>
        <p className="text-sm text-[#5e5a52]">
          This is the institute readout after students attempt the CBT: submissions, averages, and weak spots.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Tests with submissions" value={String(reportRows.filter((row) => row.submissions > 0).length)} />
        <MetricCard label="Total submissions" value={String(reportRows.reduce((sum, row) => sum + row.submissions, 0))} />
        <MetricCard label="Weak-question flags" value={String(reportRows.reduce((sum, row) => sum + row.weakQuestions, 0))} />
      </div>

      <Card className="border-[#d8d2c7]">
        <CardHeader>
          <CardTitle className="text-base text-[#14213d]">Test performance summary</CardTitle>
        </CardHeader>
        <CardContent>
          {reportRows.length === 0 ? (
            <p className="text-sm text-[#5e5a52]">No completed test data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#ece6da] text-[#6b7280]">
                  <tr>
                    <th className="pb-3">Test</th>
                    <th className="pb-3">Submissions</th>
                    <th className="pb-3">Average score</th>
                    <th className="pb-3">Average %</th>
                    <th className="pb-3">Weak questions</th>
                    <th className="pb-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((row) => (
                     <tr key={row.id} className="border-b border-[#f1ece4]">
                      <td className="py-3 font-medium text-[#14213d]">{row.title}</td>
                      <td className="py-3">{row.submissions}</td>
                      <td className="py-3">{row.averageScore.toFixed(1)}</td>
                      <td className="py-3">{row.averagePercent.toFixed(1)}%</td>
                      <td className="py-3">{row.weakQuestions}</td>
                      <td className="py-3">
                        <Link href={`/institute/tests/${row.id}`} className="font-medium text-[#8a6f3e] hover:text-[#6f582f]">
                          Open test
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-[#d8d2c7]">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-[#5e5a52]">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold text-[#14213d]">{value}</CardContent>
    </Card>
  );
}
