"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { createClient } from "@supabase/supabase-js";
import { getRepositories } from "@/lib/repositories/provider";
import { fetchStudentAttemptedExams } from "@/app/student/actions/analytics-fetch";

export default function StudentAttemptedTestsPage() {
  const candidate = useAuthStore((s) => s.candidate);
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId ?? "");
  const role = useWorkspaceAuthStore((s) => s.session?.role);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!candidate || !instituteId || role !== "student") return;

    async function loadReports() {
      try {
        const data = await fetchStudentAttemptedExams();
        setResults(data);
      } catch (err) {
        console.error("Failed to load reports", err);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, [candidate, instituteId, role]);

  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading attempted tests...</div>;

  const exams = getRepositories().exams;

  return (
    <div className="space-y-6">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">Attempted Tests</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review your past test performances, view solutions, and analyze your progress.
        </p>
      </div>

      {results.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20">
          <p className="text-sm text-muted-foreground">Complete a test to see your results here.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((result, index) => {
            const testId = result.cbt_attempts?.test_id;
            const examTitle = exams.getById(testId)?.title || `Test: ${testId}`;
            const dateAttempted = new Date(result.generated_at).toLocaleDateString("en-IN", {
              day: "numeric", month: "short", year: "numeric"
            });
            const accuracy = result.attempted_count && result.attempted_count > 0 
              ? Math.round((result.correct_count / result.attempted_count) * 100) 
              : 0;

            return (
              <Card key={result.id} className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-clay-md border-2 border-border animate-in fade-in slide-in-from-bottom-4 bg-card rounded-2xl" style={{ animationFillMode: 'backwards', animationDelay: `${index * 100}ms` }}>
                <CardHeader className="pb-3 border-b-2 border-border bg-muted/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">{examTitle}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1 font-medium bg-background px-2 py-0.5 rounded-md inline-block border border-border">Attempted: {dateAttempted}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 pb-5">
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-primary/10 border-2 border-primary/20 p-3 rounded-xl text-center">
                      <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Score</p>
                      <p className="text-2xl font-black text-foreground">{result.score}</p>
                    </div>
                    <div className="bg-secondary/10 border-2 border-secondary/20 p-3 rounded-xl text-center">
                      <p className="text-[10px] uppercase tracking-wider text-secondary font-bold">Accuracy</p>
                      <p className="text-2xl font-black text-foreground">{accuracy}%</p>
                    </div>
                    <div className="bg-muted border-2 border-border/20 p-3 rounded-xl text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Rank</p>
                      <p className="text-xl font-bold text-foreground">{result.rank ?? "—"}</p>
                    </div>
                    <div className="bg-muted border-2 border-border/20 p-3 rounded-xl text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Percentile</p>
                      <p className="text-xl font-bold text-foreground">{result.percentile ? `${result.percentile}%` : "—"}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      href={`/student/tests/${testId}/solutions`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full text-xs font-bold border-2 border-border shadow-clay-sm hover:shadow-clay transition-all hover:-translate-y-1")}
                    >
                      Solution
                    </Link>
                    <Link
                      href={`/student/analytics/${testId}`}
                      className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-full text-xs font-bold bg-accent text-accent-foreground border-2 border-border shadow-clay-sm hover:bg-accent/90 hover:shadow-clay transition-all hover:-translate-y-1")}
                    >
                      Analysis
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
