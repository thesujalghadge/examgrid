"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import {
  getInstituteOverview,
  getBatchOverview,
  getTestOverview,
  getStudentOverview,
  getInstituteAcademicInsights,
} from "@/app/institute/actions/dashboard-analytics";
import type {
  InstituteOverviewDTO,
  BatchOverviewDTO,
  TestOverviewDTO,
  StudentOverviewDTO,
} from "@/lib/analytics/institute/dashboard";
import type {
  AcademicNodeInsight,
  BatchAcademicInsight,
} from "@/lib/analytics/institute/academic-insights";

export default function InstituteAnalyticsDashboard() {
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId ?? "");
  const [overview, setOverview] = useState<InstituteOverviewDTO | null>(null);
  const [batches, setBatches] = useState<BatchOverviewDTO[]>([]);
  const [tests, setTests] = useState<TestOverviewDTO[]>([]);
  const [students, setStudents] = useState<StudentOverviewDTO[]>([]);
  const [academicInsights, setAcademicInsights] = useState<{
    instituteWeakestSubjects: AcademicNodeInsight[];
    instituteWeakestChapters: AcademicNodeInsight[];
    instituteWeakestConcepts: AcademicNodeInsight[];
    batchSubjectInsights: BatchAcademicInsight[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!instituteId) return;
    async function loadData() {
      try {
        const [o, b, t, s, ai] = await Promise.all([
          getInstituteOverview(),
          getBatchOverview(),
          getTestOverview(),
          getStudentOverview(),
          getInstituteAcademicInsights(),
        ]);
        setOverview(o);
        setBatches(b);
        setTests(t);
        setStudents(s);
        setAcademicInsights(ai);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [instituteId]);

  if (loading) {
    return (
      <div className="space-y-10">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    );
  }

  if (!overview) return null;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Institute Analytics</h2>
        <p className="text-sm text-[#5e5a52]">
          Phase 1: High-level overview of performance across batches and tests.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Total Tests" value={String(overview.totalTests)} />
        <MetricCard label="Total Students" value={String(overview.totalStudents)} />
        <MetricCard label="Total Batches" value={String(overview.totalBatches)} />
        <MetricCard label="Avg Score" value={String(overview.averageScore)} />
        <MetricCard label="Avg Percentage" value={`${overview.averagePercentage}%`} />
        <MetricCard label="Avg Accuracy" value={`${overview.averageAccuracy}%`} />
      </div>

      {academicInsights && (
        <section>
          <h3 className="mb-4 text-xl font-semibold text-[#14213d]">Academic Insights (Areas for Intervention)</h3>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-[#d8d2c7]">
              <CardHeader className="pb-3 border-b border-[#ece6da]">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-[#6b7280]">Weakest Subjects</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {academicInsights.instituteWeakestSubjects.slice(0, 5).map(node => (
                    <div key={node.nodeId} className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-[#14213d]">{node.nodeName}</p>
                        <p className="text-xs text-gray-500">{node.totalAttempted} attempts</p>
                      </div>
                      <span className={`text-sm font-bold ${node.overallAccuracy < 50 ? 'text-rose-600' : 'text-[#14213d]'}`}>{node.overallAccuracy}%</span>
                    </div>
                  ))}
                  {academicInsights.instituteWeakestSubjects.length === 0 && <p className="text-sm text-gray-500">No data yet.</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#d8d2c7]">
              <CardHeader className="pb-3 border-b border-[#ece6da]">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-[#6b7280]">Weakest Chapters</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {academicInsights.instituteWeakestChapters.slice(0, 5).map(node => (
                    <div key={node.nodeId} className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-[#14213d]">{node.nodeName}</p>
                        <p className="text-xs text-gray-500">{node.totalAttempted} attempts</p>
                      </div>
                      <span className={`text-sm font-bold ${node.overallAccuracy < 50 ? 'text-rose-600' : 'text-[#14213d]'}`}>{node.overallAccuracy}%</span>
                    </div>
                  ))}
                  {academicInsights.instituteWeakestChapters.length === 0 && <p className="text-sm text-gray-500">No data yet.</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#d8d2c7]">
              <CardHeader className="pb-3 border-b border-[#ece6da]">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-[#6b7280]">Topics Requiring Intervention</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {academicInsights.instituteWeakestConcepts.filter(c => c.totalAttempted > 5).slice(0, 5).map(node => (
                    <div key={node.nodeId} className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-[#14213d]">{node.nodeName}</p>
                        <p className="text-xs text-gray-500">{node.totalAttempted} attempts</p>
                      </div>
                      <span className={`text-sm font-bold ${node.overallAccuracy < 50 ? 'text-rose-600' : 'text-[#14213d]'}`}>{node.overallAccuracy}%</span>
                    </div>
                  ))}
                  {academicInsights.instituteWeakestConcepts.filter(c => c.totalAttempted > 5).length === 0 && <p className="text-sm text-gray-500">No data yet.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {academicInsights && academicInsights.batchSubjectInsights.length > 0 && (
        <section>
          <h3 className="mb-4 text-xl font-semibold text-[#14213d]">Batch Struggles (By Subject)</h3>
          <Card className="border-[#d8d2c7]">
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#ece6da] text-[#6b7280]">
                    <tr>
                      <th className="pb-3">Batch</th>
                      <th className="pb-3">Weak Subject</th>
                      <th className="pb-3">Accuracy</th>
                      <th className="pb-3">Total Attempts</th>
                      <th className="pb-3">Students Affected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicInsights.batchSubjectInsights.slice(0, 10).map((b) => (
                      <tr key={`${b.batchId}_${b.nodeId}`} className="border-b border-[#f1ece4]">
                        <td className="py-3 font-medium text-[#14213d]">{b.batchName}</td>
                        <td className="py-3 font-medium text-[#14213d]">{b.nodeName}</td>
                        <td className={`py-3 font-bold ${b.overallAccuracy < 50 ? 'text-rose-600' : ''}`}>{b.overallAccuracy}%</td>
                        <td className="py-3">{b.totalAttempted}</td>
                        <td className="py-3">{b.studentCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        <h3 className="mb-4 text-xl font-semibold text-[#14213d]">Batch Overview</h3>
        <Card className="border-[#d8d2c7]">
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#ece6da] text-[#6b7280]">
                  <tr>
                    <th className="pb-3">Batch Name</th>
                    <th className="pb-3">Students</th>
                    <th className="pb-3">Tests Conducted</th>
                    <th className="pb-3">Avg Percentage</th>
                    <th className="pb-3">Avg Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.batchId} className="border-b border-[#f1ece4]">
                      <td className="py-3 font-medium text-[#14213d]">{b.batchName}</td>
                      <td className="py-3">{b.studentsCount}</td>
                      <td className="py-3">{b.testsConducted}</td>
                      <td className="py-3">{b.averagePercentage}%</td>
                      <td className="py-3">{b.averageAccuracy}%</td>
                    </tr>
                  ))}
                  {batches.length === 0 && (
                     <tr><td colSpan={5} className="py-3 text-center text-[#6b7280]">No batch data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <h3 className="mb-4 text-xl font-semibold text-[#14213d]">Test Overview</h3>
        <Card className="border-[#d8d2c7]">
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#ece6da] text-[#6b7280]">
                  <tr>
                    <th className="pb-3">Test Title</th>
                    <th className="pb-3">Participants</th>
                    <th className="pb-3">Avg Percentage</th>
                    <th className="pb-3">Avg Accuracy</th>
                    <th className="pb-3">Highest Score</th>
                    <th className="pb-3">Lowest Score</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((t) => (
                    <tr key={t.testId} className="border-b border-[#f1ece4]">
                      <td className="py-3 font-medium text-[#14213d]">{t.testTitle}</td>
                      <td className="py-3">{t.participantsCount}</td>
                      <td className="py-3">{t.averagePercentage}%</td>
                      <td className="py-3">{t.averageAccuracy}%</td>
                      <td className="py-3">{t.highestScore}</td>
                      <td className="py-3">{t.lowestScore}</td>
                    </tr>
                  ))}
                  {tests.length === 0 && (
                     <tr><td colSpan={6} className="py-3 text-center text-[#6b7280]">No test data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <h3 className="mb-4 text-xl font-semibold text-[#14213d]">Student Overview (Latest Results)</h3>
        <Card className="border-[#d8d2c7]">
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#ece6da] text-[#6b7280]">
                  <tr>
                    <th className="pb-3">Student Name</th>
                    <th className="pb-3">Batch</th>
                    <th className="pb-3">Latest Test</th>
                    <th className="pb-3">Score</th>
                    <th className="pb-3">Percentage</th>
                    <th className="pb-3">Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.studentId} className="border-b border-[#f1ece4]">
                      <td className="py-3 font-medium">
                        <Link href={`/institute/analytics/student/${s.studentId}`} className="text-[#3b82f6] hover:underline">
                          {s.studentName}
                        </Link>
                      </td>
                      <td className="py-3">{s.batchName}</td>
                      <td className="py-3 text-gray-500">{s.latestTestTitle}</td>
                      <td className="py-3">{s.latestScore}</td>
                      <td className="py-3">{s.latestPercentage}%</td>
                      <td className="py-3">{s.latestRank != null && s.latestRank > 0 ? `#${s.latestRank}` : "-"}</td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                     <tr><td colSpan={6} className="py-3 text-center text-[#6b7280]">No student data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-[#d8d2c7]">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-[#5e5a52]">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-xl font-bold text-[#14213d]">{value}</CardContent>
    </Card>
  );
}
