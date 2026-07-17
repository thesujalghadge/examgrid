"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchStudentReports } from "@/app/student/actions/analytics-fetch";
import { useAuthStore } from "@/stores/auth-store";
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
  recommendation?: string;
  title?: string;
};

const metricNumber = (value: number | undefined) => value ?? 0;
const nodeId = (row: AnalyticsRow) => row.syllabus_node_id ?? "";

export default function StudentCumulativeReportPage() {
  const candidate = useAuthStore((s) => s.candidate);
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId ?? "");
  const role = useWorkspaceAuthStore((s) => s.session?.role);
  const [results, setResults] = useState<AnalyticsRow[]>([]);
  const [subjects, setSubjects] = useState<AnalyticsRow[]>([]);
  const [chapters, setChapters] = useState<AnalyticsRow[]>([]);
  const [concepts, setConcepts] = useState<AnalyticsRow[]>([]);
  const [recommendations, setRecommendations] = useState<AnalyticsRow[]>([]);
  const [nodes, setNodes] = useState<AnalyticsRow[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!candidate || !instituteId || role !== "student") return;

    const loadReports = async () => {
      try {
        const data = await fetchStudentReports();
        setResults(data.results);
        setSubjects(data.sub);
        setChapters(data.chap);
        setConcepts(data.con);
        setRecommendations(data.recs);
        setNodes(data.nodes);
        setIsGenerating(data.isGenerating);
      } catch (err) {
        console.error("Failed to load reports", err);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [candidate, instituteId, role]);

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

  const weakTopics = concepts
    .filter((c) => metricNumber(c.overall_accuracy) < 60 && metricNumber(c.total_attempted) >= 2)
    .sort((a, b) => metricNumber(a.overall_accuracy) - metricNumber(b.overall_accuracy))
    .map((c) => ({ name: getNodeName(nodeId(c)), accuracy: Math.round(metricNumber(c.overall_accuracy)) }))
    .slice(0, 4);

  const strongTopics = concepts
    .filter((c) => metricNumber(c.overall_accuracy) >= 75 && metricNumber(c.total_attempted) >= 2)
    .sort((a, b) => metricNumber(b.overall_accuracy) - metricNumber(a.overall_accuracy))
    .map((c) => ({ name: getNodeName(nodeId(c)), accuracy: Math.round(metricNumber(c.overall_accuracy)) }))
    .slice(0, 4);

  const displayWeak = weakTopics.length > 0 ? weakTopics : chapters
    .filter((c) => metricNumber(c.overall_accuracy) < 65)
    .sort((a, b) => metricNumber(a.overall_accuracy) - metricNumber(b.overall_accuracy))
    .map((c) => ({ name: getNodeName(nodeId(c)), accuracy: Math.round(metricNumber(c.overall_accuracy)) }))
    .slice(0, 3);

  const displayStrong = strongTopics.length > 0 ? strongTopics : chapters
    .filter((c) => metricNumber(c.overall_accuracy) >= 75)
    .sort((a, b) => metricNumber(b.overall_accuracy) - metricNumber(a.overall_accuracy))
    .map((c) => ({ name: getNodeName(nodeId(c)), accuracy: Math.round(metricNumber(c.overall_accuracy)) }))
    .slice(0, 3);

  const topRecommendation = recommendations[0]?.recommendation || recommendations[0]?.title || (displayWeak[0]?.name ? `Revise ${displayWeak[0].name} before your next test.` : "Complete one more test to unlock sharper recommendations.");

  const actionPlan = useMemo(() => {
    const plan: string[] = [];
    if (displayWeak[0]) plan.push(`Review ${displayWeak[0].name} concepts.`);
    if (displayWeak[1]) plan.push(`Solve one timed ${displayWeak[1].name} practice set.`);
    if (plan.length < 3 && displayStrong[0]) plan.push(`Retake a test covering ${displayStrong[0].name} to solidify your score.`);
    if (plan.length === 0) plan.push("Complete your scheduled upcoming test.");
    return plan.slice(0, 3);
  }, [displayWeak, displayStrong]);

  return (
    <StudentCumulativeReportView
      role="student"
      loading={loading}
      isGenerating={isGenerating}
      hasData={results.length > 0}
      metrics={metrics}
      subjectData={subjectData}
      topRecommendation={topRecommendation}
      keyInsight={displayWeak.length > 0 ? `${displayWeak[0].name} accuracy has been lower in recent tests.` : "Your test scores are showing steady consistency."}
      actionPlan={actionPlan}
      strongAreas={displayStrong}
      needsAttention={displayWeak}
    />
  );
}
