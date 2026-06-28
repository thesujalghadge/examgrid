"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { createClient } from "@supabase/supabase-js";
import { getRepositories } from "@/lib/repositories/provider";
import { hydrateSupabaseRepositories } from "@/lib/supabase/hydrate-repositories";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { Loader2, TrendingUp, Target, Award, CheckCircle2, AlertTriangle, BookOpen, BrainCircuit } from "lucide-react";

import { fetchStudentReports } from "@/app/student/actions/analytics-fetch";

export default function StudentCumulativeReportPage() {
  const candidate = useAuthStore((s) => s.candidate);
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId ?? "");
  const role = useWorkspaceAuthStore((s) => s.session?.role);
  const [results, setResults] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [concepts, setConcepts] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reposHydrated, setReposHydrated] = useState(false);

  useEffect(() => {
    hydrateSupabaseRepositories().then(() => setReposHydrated(true));
  }, []);

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
    } catch (err) {
      console.error("Failed to load reports", err);
    } finally {
      setLoading(false);
    }
  }
    loadReports();
  }, [candidate, instituteId, role]);

  const metrics = useMemo(() => {
    if (!results.length) return null;

    const totalTests = results.length;
    const avgScore = Math.round(results.reduce((acc, r) => acc + (r.score || 0), 0) / totalTests);
    
    let totalAttempted = 0;
    let totalCorrect = 0;
    results.forEach(r => {
      totalAttempted += (r.attempted_count || 0);
      totalCorrect += (r.correct_count || 0);
    });
    
    const avgAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    
    const ranks = results.map(r => r.rank).filter(Boolean) as number[];
    const bestRank = ranks.length > 0 ? Math.min(...ranks) : "—";
    
    // Progress Data for Charts
    const progressData = results.map((r, i) => ({
      name: `T${i + 1}`,
      score: r.score || 0,
      accuracy: r.attempted_count ? Math.round((r.correct_count / r.attempted_count) * 100) : 0,
      rank: r.rank || 0,
    }));

    return {
      totalTests,
      avgScore,
      avgAccuracy,
      bestRank,
      progressData
    };
  }, [results]);

  if (loading || !reposHydrated) return (
    <div className="flex h-screen items-center justify-center text-muted-foreground gap-2">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>Generating cumulative report...</span>
    </div>
  );

  if (!metrics || results.length === 0) {
    return (
      <div className="space-y-6">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">Performance Report</h2>
          <p className="text-muted-foreground mt-1 text-lg">Your permanent performance record.</p>
        </div>
        <div className="flex flex-col h-64 items-center justify-center rounded-3xl border border-dashed border-border bg-muted/20">
          <div className="text-center">
            <BrainCircuit className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-20" />
            <p className="text-muted-foreground font-medium">No performance data recorded yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Complete a test to unlock your cumulative analytics.</p>
          </div>
        </div>
      </div>
    );
  }

  if (subjects.length === 0 && results.length > 0) {
    return (
      <div className="space-y-6">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">Performance Report</h2>
        </div>
        <div className="flex flex-col h-64 items-center justify-center rounded-3xl border border-dashed border-border bg-muted/20">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-muted-foreground mb-3 opacity-50" />
            <h2 className="text-xl font-bold tracking-tight text-foreground mb-1">Analysis is being generated.</h2>
            <p className="text-sm text-muted-foreground">We are crunching your numbers. Check back in a few moments.</p>
          </div>
        </div>
      </div>
    );
  }

  const getNodeName = (id: string) => nodes.find(n => n.id === id)?.name || "Unknown";

  const subjectData = subjects.length > 0 ? subjects.map(s => ({
    subject: getNodeName(s.syllabus_node_id),
    score: Math.round(s.overall_accuracy),
    fullMark: 100
  })) : [
    { subject: 'Physics', score: Math.min(100, metrics.avgScore + 10), fullMark: 100 },
    { subject: 'Chemistry', score: Math.min(100, metrics.avgScore + 25), fullMark: 100 },
    { subject: 'Mathematics', score: Math.max(0, metrics.avgScore - 5), fullMark: 100 },
  ];

  const weakTopics = concepts.filter(c => c.overall_accuracy < 50 && c.total_attempted >= 3)
    .sort((a, b) => a.overall_accuracy - b.overall_accuracy)
    .map(c => ({ name: getNodeName(c.syllabus_node_id), type: "Topic" })).slice(0, 4);

  const strongTopics = concepts.filter(c => c.overall_accuracy >= 80 && c.total_attempted >= 2)
    .sort((a, b) => b.overall_accuracy - a.overall_accuracy)
    .map(c => ({ name: getNodeName(c.syllabus_node_id), type: "Topic" })).slice(0, 4);

  const displayWeak = weakTopics.length > 0 ? weakTopics : [
    { name: "Attempt more tests", type: "System" }
  ];

  const displayStrong = strongTopics.length > 0 ? strongTopics : [
    { name: "Attempt more tests", type: "System" }
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">Cumulative Report</h2>
        <p className="text-muted-foreground mt-1 text-lg">
          Track your overall journey, strengths, and weaknesses across all attempted tests.
        </p>
      </div>

      {/* OVERALL JOURNEY STATS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-backwards" style={{ animationDelay: '100ms' }}>
        <Card className="border-2 border-border shadow-clay-sm bg-card rounded-2xl transition-all hover:-translate-y-1 hover:shadow-clay-md">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Tests Attempted</p>
            </div>
            <div className="mt-4 flex items-baseline space-x-2">
              <h3 className="text-4xl font-black tracking-tight text-foreground">{metrics.totalTests}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-2 border-border shadow-clay-sm bg-card rounded-2xl transition-all hover:-translate-y-1 hover:shadow-clay-md">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-secondary" />
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Average Score</p>
            </div>
            <div className="mt-4 flex items-baseline space-x-2">
              <h3 className="text-4xl font-black tracking-tight text-foreground">{metrics.avgScore}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border shadow-clay-sm bg-card rounded-2xl transition-all hover:-translate-y-1 hover:shadow-clay-md">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Average Accuracy</p>
            </div>
            <div className="mt-4 flex items-baseline space-x-2">
              <h3 className="text-4xl font-black tracking-tight text-foreground">{metrics.avgAccuracy}%</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border shadow-clay-sm bg-card rounded-2xl transition-all hover:-translate-y-1 hover:shadow-clay-md">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-accent" />
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Best Rank</p>
            </div>
            <div className="mt-4 flex items-baseline space-x-2">
              <h3 className="text-4xl font-black tracking-tight text-foreground">{metrics.bestRank}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 animate-in fade-in slide-in-from-bottom-6 duration-700 fill-mode-backwards" style={{ animationDelay: '200ms' }}>
        {/* SCORE TREND */}
        <Card className="shadow-clay-md border-2 border-border rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/50 border-b-2 border-border pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
              <TrendingUp className="w-6 h-6" />
              Score Trend
            </CardTitle>
            <CardDescription className="font-medium">Your score progression over time</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.progressData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-clay-md)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--background))' }} 
                  activeDot={{ r: 8 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ACCURACY TREND */}
        <Card className="shadow-clay-md border-2 border-border rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/50 border-b-2 border-border pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-secondary">
              <Target className="w-6 h-6" />
              Accuracy Trend
            </CardTitle>
            <CardDescription className="font-medium">Percentage of correct answers per test</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.progressData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-clay-md)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="accuracy" 
                  stroke="#10b981" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: 'hsl(var(--background))' }} 
                  activeDot={{ r: 8 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-backwards" style={{ animationDelay: '300ms' }}>
        {/* SUBJECT WISE PERFORMANCE */}
        <Card className="shadow-clay-md border-2 border-border rounded-2xl overflow-hidden lg:col-span-1">
          <CardHeader className="bg-muted/50 border-b-2 border-border pb-4">
            <CardTitle className="text-lg font-bold">Subject Performance</CardTitle>
            <CardDescription className="font-medium">Relative strength across subjects</CardDescription>
          </CardHeader>
          <CardContent className="h-72 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={subjectData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* WEAKNESS ENGINE & TOPICS */}
        <Card className="shadow-clay-md border-2 border-border rounded-2xl overflow-hidden lg:col-span-2 flex flex-col">
          <CardHeader className="bg-muted/50 border-b-2 border-border pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
              <BrainCircuit className="w-6 h-6" />
              Weakness Engine & Insights
            </CardTitle>
            <CardDescription className="font-medium">AI-driven analysis of your frequently incorrect areas</CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/40">
            <div className="p-6 bg-destructive/5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" />
                <h4 className="font-bold text-foreground">Topics Needing Revision</h4>
              </div>
              <ul className="space-y-3">
                {displayWeak.map((topic, i) => (
                  <li key={i} className="bg-card border-2 border-border rounded-xl p-3 flex justify-between items-center shadow-clay-sm transition-all hover:-translate-y-1 hover:shadow-clay">
                    <span className="font-bold text-sm text-foreground">{topic.name}</span>
                    <span className="text-[10px] uppercase font-black text-muted-foreground bg-muted border border-border px-2 py-1 rounded-md">{topic.type}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="p-6 bg-success/5 border-t-2 sm:border-t-0 sm:border-l-2 border-border">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-6 h-6 text-success" />
                <h4 className="font-bold text-foreground">Mastered Topics</h4>
              </div>
              <ul className="space-y-3">
                {displayStrong.map((topic, i) => (
                  <li key={i} className="bg-card border-2 border-border rounded-xl p-3 flex justify-between items-center shadow-clay-sm transition-all hover:-translate-y-1 hover:shadow-clay">
                    <span className="font-bold text-sm text-foreground">{topic.name}</span>
                    <span className="text-[10px] uppercase font-black text-muted-foreground bg-muted border border-border px-2 py-1 rounded-md">{topic.type}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
