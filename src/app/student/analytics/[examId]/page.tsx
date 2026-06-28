"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { ArrowLeft, Target, Trophy, Clock, AlertTriangle, Lightbulb, CheckCircle2, TrendingUp } from "lucide-react";
import Link from "next/link";

import { fetchStudentExamAnalytics } from "@/app/student/actions/analytics-fetch";

export default function StudentAnalyticsPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  const candidate = useAuthStore((s) => s.candidate);
  
  const [data, setData] = useState<{
    result: any;
    subjects: any[];
    chapters: any[];
    concepts: any[];
    recommendations: any[];
    cumulative: any[];
    nodes: any[];
    answers: any[];
    qAnalytics: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const role = useWorkspaceAuthStore((s) => s.session?.role);

  useEffect(() => {
    if (!candidate?.rollNumber || role !== "student") return;
    loadAnalytics();
  }, [candidate?.rollNumber, role]);

  const loadAnalytics = async () => {
    try {
      const resultData = await fetchStudentExamAnalytics(examId);
      setData(resultData);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-muted-foreground animate-pulse">Loading Analytics...</div>;
  if (!data || !data.result) return <div className="p-12 text-center text-destructive">Error loading results. Please verify your attempt.</div>;

  const { result, subjects, chapters, concepts, recommendations, cumulative, nodes, answers, qAnalytics } = data;

  if (!subjects || subjects.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-12 mt-12 text-center border-2 border-dashed border-border rounded-2xl bg-muted/20">
        <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">Analysis is being generated.</h2>
        <p className="text-muted-foreground">Please check back in a few moments while we process your performance insights.</p>
        <Link href="/student/attempted" className="inline-block mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-full font-bold hover:opacity-90 transition-opacity">
          Back to Attempts
        </Link>
      </div>
    );
  }
  const getNodeName = (id: string) => nodes.find(n => n.id === id)?.name || "Unknown";

  const renderRecommendation = (rec: any) => {
    const name = getNodeName(rec.syllabus_node_id);
    switch(rec.code) {
      case 'NEEDS_REVISION':
        return <><AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" /><div><h4 className="font-semibold text-sm">Needs Revision: {name}</h4><p className="text-sm text-muted-foreground mt-1">Accuracy is low ({rec.payload.accuracy}%) over {rec.payload.attempts} attempts.</p></div></>;
      case 'GOOD_ACCURACY_LOW_ATTEMPTS':
        return <><Target className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" /><div><h4 className="font-semibold text-sm">Good Accuracy, Low Attempts: {name}</h4><p className="text-sm text-muted-foreground mt-1">Excellent accuracy ({rec.payload.accuracy}%) but only {rec.payload.attempts} attempts. Try more questions.</p></div></>;
      case 'HIGH_ATTEMPTS_LOW_ACCURACY':
        return <><AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" /><div><h4 className="font-semibold text-sm">High Attempts, Low Accuracy: {name}</h4><p className="text-sm text-muted-foreground mt-1">You are struggling here ({rec.payload.accuracy}% across {rec.payload.attempts} attempts). Revisit the core concepts.</p></div></>;
      case 'STRONG_CONCEPT':
        return <><CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><div><h4 className="font-semibold text-sm">Strong Concept: {name}</h4><p className="text-sm text-muted-foreground mt-1">Consistently high accuracy ({rec.payload.accuracy}%). Keep it up!</p></div></>;
      default:
        return <><Lightbulb className="w-5 h-5 text-primary shrink-0 mt-0.5" /><div><h4 className="font-semibold text-sm">Insight: {name}</h4><p className="text-sm text-muted-foreground mt-1">{rec.code}</p></div></>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-10">
      <div className="flex items-center gap-4">
        <Link href={`/student/reports`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exam Performance Analytics</h1>
          <p className="text-muted-foreground">Comprehensive insights based on your recent attempt.</p>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" /> Overall Performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border rounded-xl p-5 shadow-sm"><p className="text-sm font-medium text-muted-foreground mb-1">Score</p><p className="text-3xl font-bold">{result.score}</p></div>
          <div className="bg-card border rounded-xl p-5 shadow-sm"><p className="text-sm font-medium text-muted-foreground mb-1">Rank</p><p className="text-3xl font-bold">{result.rank || '-'}</p><p className="text-xs text-muted-foreground mt-1">out of {result.total_candidates || '-'}</p></div>
          <div className="bg-card border rounded-xl p-5 shadow-sm"><p className="text-sm font-medium text-muted-foreground mb-1">Percentile</p><p className="text-3xl font-bold">{result.percentile || '-'}%</p></div>
          <div className="bg-card border rounded-xl p-5 shadow-sm"><p className="text-sm font-medium text-muted-foreground mb-1">Accuracy</p><p className="text-3xl font-bold">{result.accuracy ? Math.round(result.accuracy) : Math.round((result.correct_count / (result.correct_count + result.incorrect_count)) * 100) || 0}%</p></div>
        </div>
      </section>

      {recommendations.length > 0 && (
        <section className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-blue-700 mb-4"><Lightbulb className="w-5 h-5" /> Actionable Recommendations</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex gap-3 bg-card p-4 rounded-lg border shadow-sm">
                {renderRecommendation(rec)}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Cumulative Subject Journey</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {cumulative.map((sub, i) => (
            <div key={i} className="bg-card border rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-lg border-b pb-2 mb-4">{getNodeName(sub.syllabus_node_id)}</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Overall Accuracy</span><span className="font-medium text-primary">{Math.round(sub.overall_accuracy)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Attempted</span><span className="font-medium">{sub.total_attempted}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Correct</span><span className="font-medium text-green-600">{sub.total_correct}</span></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Subject Performance (This Test)</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {subjects.map((sub, i) => (
            <div key={i} className="bg-card border rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-lg border-b pb-2 mb-4">{getNodeName(sub.syllabus_node_id)}</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Accuracy</span><span className="font-medium">{Math.round(sub.accuracy)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Correct</span><span className="font-medium text-green-600">{sub.correct_count}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Incorrect</span><span className="font-medium text-destructive">{sub.incorrect_count}</span></div>
              </div>
              <div className="mt-4 pt-4 border-t w-full bg-muted/30 rounded-full h-2 overflow-hidden flex">
                <div style={{ width: `${(sub.correct_count / sub.attempted_count) * 100}%` }} className="bg-green-500 h-full" />
                <div style={{ width: `${(sub.incorrect_count / sub.attempted_count) * 100}%` }} className="bg-destructive h-full" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Chapter Insights (This Test)</h2>
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b">
              <tr>
                <th className="px-6 py-4 font-medium">Chapter Name</th>
                <th className="px-6 py-4 font-medium text-right">Attempted</th>
                <th className="px-6 py-4 font-medium text-right">Correct</th>
                <th className="px-6 py-4 font-medium text-right">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {chapters.sort((a, b) => b.accuracy - a.accuracy).map((chap, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="px-6 py-4 font-medium text-foreground">{getNodeName(chap.syllabus_node_id)}</td>
                  <td className="px-6 py-4 text-right">{chap.attempted_count}</td>
                  <td className="px-6 py-4 text-right text-green-600 font-medium">{chap.correct_count}</td>
                  <td className="px-6 py-4 text-right font-medium">
                    <span className={`px-2 py-1 rounded-full text-xs ${chap.accuracy >= 70 ? 'bg-green-500/10 text-green-700' : chap.accuracy < 40 ? 'bg-destructive/10 text-destructive' : 'bg-orange-500/10 text-orange-700'}`}>
                      {Math.round(chap.accuracy)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Topic Insights (This Test)</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {concepts.sort((a, b) => b.accuracy - a.accuracy).map((topic, i) => (
            <div key={i} className="bg-card border rounded-xl p-5 shadow-sm flex flex-col justify-between hover:shadow-clay-sm transition-all hover:-translate-y-1">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold">{getNodeName(topic.syllabus_node_id)}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${topic.accuracy >= 70 ? 'bg-green-500/10 text-green-700' : topic.accuracy < 40 ? 'bg-destructive/10 text-destructive' : 'bg-orange-500/10 text-orange-700'}`}>
                  {Math.round(topic.accuracy)}% Acc
                </span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Attempts: {topic.attempted_count}</span>
                <span className="text-green-600">Correct: {topic.correct_count}</span>
                <span className="text-destructive">Incorrect: {topic.incorrect_count}</span>
              </div>
              <div className="mt-3 w-full bg-muted/30 rounded-full h-1.5 overflow-hidden flex">
                <div style={{ width: `${(topic.correct_count / Math.max(1, topic.attempted_count)) * 100}%` }} className="bg-green-500 h-full" />
                <div style={{ width: `${(topic.incorrect_count / Math.max(1, topic.attempted_count)) * 100}%` }} className="bg-destructive h-full" />
              </div>
            </div>
          ))}
          {concepts.length === 0 && (
             <div className="col-span-2 text-center p-8 border border-dashed rounded-xl text-muted-foreground">No topic data recorded.</div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Question Analytics</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-destructive/5 border-2 border-destructive/20 rounded-xl p-5">
            <h3 className="font-bold text-destructive mb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Wrong Answers & Skipped</h3>
            <div className="space-y-2">
              {answers.filter(a => !a.is_correct).slice(0, 5).map((a, i) => {
                const globalQ = qAnalytics.find(q => q.question_id === a.question_id);
                return (
                  <div key={i} className="bg-card p-3 rounded-lg border shadow-sm text-sm flex justify-between items-center">
                    <span className="font-medium text-foreground">Question ID: ...{a.question_id.slice(-6)}</span>
                    <div className="flex gap-3 text-xs">
                      <span className={a.selected_answer ? "text-destructive font-bold" : "text-muted-foreground font-bold"}>
                        {a.selected_answer ? "Wrong" : "Skipped"}
                      </span>
                      <span className="text-muted-foreground">Global Acc: {globalQ ? Math.round(globalQ.accuracy) : '-'}%</span>
                    </div>
                  </div>
                )
              })}
              {answers.filter(a => !a.is_correct).length === 0 && <p className="text-sm text-muted-foreground">No incorrect or skipped answers. Perfect!</p>}
            </div>
          </div>

          <div className="bg-blue-500/5 border-2 border-blue-500/20 rounded-xl p-5">
            <h3 className="font-bold text-blue-700 mb-3 flex items-center gap-2"><Clock className="w-5 h-5"/> Time Consuming Questions</h3>
            <div className="space-y-2">
              {answers.sort((a, b) => (b.time_taken_seconds || 0) - (a.time_taken_seconds || 0)).slice(0, 5).map((a, i) => {
                return (
                  <div key={i} className="bg-card p-3 rounded-lg border shadow-sm text-sm flex justify-between items-center">
                    <span className="font-medium text-foreground">Question ID: ...{a.question_id.slice(-6)}</span>
                    <div className="flex gap-3 text-xs">
                       <span className={a.is_correct ? "text-green-600" : (a.selected_answer ? "text-destructive" : "text-muted-foreground")}>
                        {a.is_correct ? "Correct" : (a.selected_answer ? "Wrong" : "Skipped")}
                      </span>
                      <span className="text-muted-foreground font-bold">{a.time_taken_seconds}s</span>
                    </div>
                  </div>
                )
              })}
              {answers.length === 0 && <p className="text-sm text-muted-foreground">No questions attempted.</p>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
