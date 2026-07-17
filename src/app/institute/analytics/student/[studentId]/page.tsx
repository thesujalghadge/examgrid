"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getInstituteStudentReports } from "@/app/institute/actions/dashboard-analytics";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { StudentCumulativeReportView } from "@/components/ui/student/student-report-view";

type AnalyticsRow = {
  id?: string;
  name?: string;
  score?: number;
  attempted_count?: number;
  correct_count?: number;
  rank?: number;
  syllabus_node_id?: string;
  overall_accuracy?: number;
  total_attempted?: number;
  title?: string;
};

const metricNumber = (value: number | undefined) => value ?? 0;
const nodeId = (row: AnalyticsRow) => row.syllabus_node_id ?? "";

export default function InstituteStudentDrillDownPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId ?? "");
  const role = useWorkspaceAuthStore((s) => s.session?.role);
  
  const [studentName, setStudentName] = useState("");
  const [results, setResults] = useState<AnalyticsRow[]>([]);
  const [subjects, setSubjects] = useState<AnalyticsRow[]>([]);
  const [nodes, setNodes] = useState<AnalyticsRow[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!instituteId || role !== "institute" || !studentId) return;

    const loadReports = async () => {
      try {
        const data = await getInstituteStudentReports(studentId);
        setStudentName(data.studentName);
        setResults(data.results);
        setSubjects(data.sub);
        setNodes(data.nodes);
        setIsGenerating(data.isGenerating);
      } catch (err) {
        console.error("Failed to load student reports", err);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [instituteId, role, studentId]);

  const metrics = useMemo(() => {
    if (!results.length) return null;

    const totalTests = results.length;
    const avgScore = Math.round(results.reduce((acc, r) => acc + (r.score || 0), 0) / totalTests);

    let totalAttempted = 0;
    let totalCorrect = 0;
    results.forEach((r) => {
      totalAttempted += r.attempted_count || 0;
      totalCorrect += metricNumber(r.correct_count);
    });

    const avgAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    const ranks = results.map((r) => r.rank).filter((r) => r != null && r !== 0) as number[];
    const bestRank = ranks.length > 0 ? Math.min(...ranks) : "-";

    const progressData = [...results].reverse().map((r, i) => ({
      name: `Mock ${i + 1}`,
      score: r.score || 0,
      accuracy: r.attempted_count ? Math.round((metricNumber(r.correct_count) / r.attempted_count) * 100) : 0,
      rank: r.rank || 0,
    }));

    return {
      totalTests,
      avgScore,
      avgAccuracy,
      bestRank,
      progressData,
    };
  }, [results]);

  const getNodeName = useCallback((id: string) => nodes.find((n) => n.id === id)?.name || "Unknown", [nodes]);

  const subjectData = useMemo(() => {
    if (subjects.length > 0) {
      return subjects.map((s) => ({
        subject: getNodeName(nodeId(s)),
        score: Math.round(metricNumber(s.overall_accuracy)),
      }));
    }
    return [];
  }, [subjects, getNodeName]);

  return (
    <StudentCumulativeReportView
      role="institute"
      loading={loading}
      isGenerating={isGenerating}
      hasData={results.length > 0}
      studentName={studentName}
      metrics={metrics}
      subjectData={subjectData}
    />
  );
}
