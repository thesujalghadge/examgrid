"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@supabase/supabase-js";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import {
  Users,
  AlertTriangle,
  Trophy,
  BrainCircuit,
  ArrowLeft,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

import { fetchInstituteExamAnalytics } from "@/app/institute/actions/analytics-fetch";

export default function InstituteAnalyticsPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  const session = useWorkspaceAuthStore((s) => s.session);

  const [data, setData] = useState<{
    results: any[];
    questions: any[];
    subjects: any[];
    nodes: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.instituteId) return;
    loadAnalytics();
  }, [session?.instituteId]);

  const loadAnalytics = async () => {
    try {
      const data = await fetchInstituteExamAnalytics(examId);
      setData({
        results: data.results,
        questions: data.qAnalytics,
        subjects: data.subjects,
        nodes: data.nodes
      });
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <div className="p-12 text-center text-muted-foreground animate-pulse">
        Loading Institute Analytics...
      </div>
    );
  if (!data || data.results.length === 0)
    return (
      <div className="p-12 text-center text-muted-foreground">
        No analytics data available yet. Please ensure students have submitted
        the exam.
      </div>
    );

  const { results, questions, subjects, nodes } = data;
  const getNodeName = (id: string) =>
    nodes.find((n) => n.id === id)?.name || "Unknown";

  const scores = results.map((r) => Number(r.score));
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const highestScore = Math.max(...scores);
  const lowestScore = Math.min(...scores);
  const sortedScores = [...scores].sort((a, b) => a - b);
  const medianScore =
    sortedScores.length % 2 === 0
      ? (sortedScores[sortedScores.length / 2 - 1] +
          sortedScores[sortedScores.length / 2]) /
        2
      : sortedScores[Math.floor(sortedScores.length / 2)];

  const atRiskStudents = results.filter((r) => r.percentile < 25);
  const mostIncorrect = [...questions]
    .sort((a, b) => b.incorrect_count - a.incorrect_count)
    .slice(0, 5);
  const mostSkipped = [...questions]
    .sort((a, b) => b.unattempted_count - a.unattempted_count)
    .slice(0, 5);
  const hardest = [...questions]
    .sort((a, b) => a.difficulty_index - b.difficulty_index)
    .slice(0, 5);

  // Subject Averages
  const subjectAgg: Record<string, { totalAcc: number; count: number }> = {};
  subjects.forEach((s) => {
    if (!subjectAgg[s.syllabus_node_id])
      subjectAgg[s.syllabus_node_id] = { totalAcc: 0, count: 0 };
    subjectAgg[s.syllabus_node_id].totalAcc += Number(s.accuracy);
    subjectAgg[s.syllabus_node_id].count++;
  });

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-10">
      <div className="flex items-center gap-4">
        <Link
          href={`/institute/tests`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Batch Test Analytics
          </h1>
          <p className="text-muted-foreground">
            Comprehensive insights driven solely by completed snapshots.
          </p>
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Total Students
          </p>
          <p className="text-3xl font-bold">{results.length}</p>
        </div>
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Average Score
          </p>
          <p className="text-3xl font-bold">{Math.round(avgScore)}</p>
        </div>
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Median Score
          </p>
          <p className="text-3xl font-bold">{medianScore}</p>
        </div>
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Highest Score
          </p>
          <p className="text-3xl font-bold text-green-600">{highestScore}</p>
        </div>
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Lowest Score
          </p>
          <p className="text-3xl font-bold text-destructive">{lowestScore}</p>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> Leaderboard
          </h2>
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Student Roll No</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-right">Percentile</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {results.slice(0, 15).map((res, i) => (
                  <tr key={res.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-bold text-primary">
                      #{res.rank || i + 1}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {res.cbt_attempts?.student_roll_number || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {res.score}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {res.percentile || "-"}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/student/analytics/${examId}`}
                        className="text-blue-500 hover:underline"
                      >
                        View Analytics
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" /> Risk Detection
          </h2>
          <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-orange-700 mb-2">
              At Risk Students ({atRiskStudents.length})
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Below 25th percentile.
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {atRiskStudents.slice(0, 10).map((r) => (
                <div
                  key={r.id}
                  className="flex justify-between items-center text-sm p-2 bg-background border rounded"
                >
                  <span className="font-medium">
                    {r.cbt_attempts?.student_roll_number}
                  </span>
                  <span className="text-destructive font-semibold">
                    Score: {r.score}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <h2 className="text-xl font-semibold flex items-center gap-2 mt-8">
            <BarChart3 className="w-5 h-5 text-blue-500" /> Subject Averages
          </h2>
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            {Object.entries(subjectAgg).map(([sId, agg]) => {
              const avgAcc = agg.totalAcc / agg.count;
              return (
                <div key={sId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{getNodeName(sId)}</span>
                    <span>{Math.round(avgAcc)}% Acc</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      style={{ width: `${avgAcc}%` }}
                      className="bg-blue-500 h-full rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-primary" /> Question Analytics
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-card border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold mb-4 text-destructive">
              Most Incorrect
            </h3>
            <div className="space-y-4">
              {mostIncorrect.map((q, i) => (
                <div key={i} className="border-b pb-3 text-sm">
                  <p className="font-medium line-clamp-2 mb-1">
                    {q.exam_questions?.published_question_text || q.question_id}
                  </p>
                  <p className="text-xs text-destructive">
                    {q.incorrect_count} Incorrect (Acc: {Math.round(q.accuracy)}
                    %)
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold mb-4 text-orange-600">Most Skipped</h3>
            <div className="space-y-4">
              {mostSkipped.map((q, i) => (
                <div key={i} className="border-b pb-3 text-sm">
                  <p className="font-medium line-clamp-2 mb-1">
                    {q.exam_questions?.published_question_text || q.question_id}
                  </p>
                  <p className="text-xs text-orange-600">
                    {q.unattempted_count} Skipped
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold mb-4 text-purple-600">
              Hardest (By Diff Index)
            </h3>
            <div className="space-y-4">
              {hardest.map((q, i) => (
                <div key={i} className="border-b pb-3 text-sm">
                  <p className="font-medium line-clamp-2 mb-1">
                    {q.exam_questions?.published_question_text || q.question_id}
                  </p>
                  <p className="text-xs text-purple-600">
                    Diff Index: {q.difficulty_index.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
