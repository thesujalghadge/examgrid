"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Settings2, ShieldCheck, Target, ArrowRight, BarChart3, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardPanel, SectionHeader, StatusBadge } from "@/components/shared/product-ui";
import { awaitRepositoryPersist } from "@/lib/repositories/await-persist";
import { examCatalogRepository } from "@/repositories/exam-catalog-repository";
import { recordAuditEvent } from "@/services/audit-service";
import { buildExamDefinition } from "@/services/exam-builder-service";
import { getQuestionBank } from "@/services/question-bank-service";
import type { ExamBuildDraft } from "@/types/exam-builder";
import { cn } from "@/lib/utils";

// Mock blueprint constraints for the UX
interface BlueprintConstraints {
  subjectMix: Record<string, number>;
  difficulty: { easy: number; medium: number; hard: number };
  sourceRatio: { pyq: number; ai: number; custom: number };
}

export function CreateExamForm() {
  const router = useRouter();
  const bank = useMemo(() => getQuestionBank(), []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // Constraint state
  const [title, setTitle] = useState("Target Mock Exam 1");
  const [duration, setDuration] = useState("180");
  const [totalQuestions, setTotalQuestions] = useState("90");
  const [examType, setExamType] = useState("JEE_MAIN");
  const [difficultyCurve, setDifficultyCurve] = useState("standard"); // standard, hard, adaptive

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setShowReview(true);
    }, 1500);
  };

  const handlePublish = () => {
    void (async () => {
      // Mock publish behavior for UX implementation
      router.push("/admin");
    })();
  };

  if (showReview) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Blueprint Review</h2>
            <p className="text-sm text-muted-foreground">AI has assembled the test based on your constraints.</p>
          </div>
          <Button variant="outline" onClick={() => setShowReview(false)}>Edit Constraints</Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <DashboardPanel>
              <SectionHeader title="Composition Analysis" />
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-lg bg-muted/50 p-4 border border-border">
                  <p className="text-xs font-medium uppercase text-muted-foreground mb-1">Total Questions</p>
                  <p className="text-2xl font-semibold text-foreground">{totalQuestions}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 border border-border">
                  <p className="text-xs font-medium uppercase text-muted-foreground mb-1">Est. Duration</p>
                  <p className="text-2xl font-semibold text-foreground">{duration} min</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 border border-border">
                  <p className="text-xs font-medium uppercase text-muted-foreground mb-1">Avg Confidence</p>
                  <p className="text-2xl font-semibold text-emerald-600">94%</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Syllabus Coverage</h3>
                {['Physics', 'Chemistry', 'Mathematics'].map(sub => (
                  <div key={sub} className="flex items-center justify-between text-sm">
                    <span className="w-24 font-medium text-foreground">{sub}</span>
                    <div className="flex-1 mx-4 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-[33%] rounded-full" />
                    </div>
                    <span className="w-12 text-right text-muted-foreground">30 Q</span>
                  </div>
                ))}
              </div>
            </DashboardPanel>

            <DashboardPanel>
              <div className="flex items-center justify-between mb-4">
                <SectionHeader title="Generated Sections" />
                <Button variant="ghost" size="sm">Regenerate all</Button>
              </div>
              <div className="space-y-3">
                {['Physics Sec A (MCQ)', 'Physics Sec B (Num)', 'Chemistry Sec A (MCQ)'].map(sec => (
                  <div key={sec} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-medium text-foreground">{sec}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge tone="neutral">20 Qs</StatusBadge>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">Review</Button>
                    </div>
                  </div>
                ))}
              </div>
            </DashboardPanel>
          </div>

          <div className="space-y-6">
            <DashboardPanel className="bg-primary/5 border-primary/20">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground">AI Health Check</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">The blueprint meets all target parameters.</p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex gap-2 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> <span>Balanced difficulty curve</span>
                    </li>
                    <li className="flex gap-2 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> <span>70% PYQ coverage achieved</span>
                    </li>
                    <li className="flex gap-2 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4" /> <span>'Modern Physics' under-represented</span>
                    </li>
                  </ul>
                </div>
              </div>
            </DashboardPanel>

            <Button onClick={handlePublish} className="w-full" size="lg">
              Approve & Publish Exam
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <DashboardPanel>
          <div className="flex items-center gap-2 mb-6 border-b border-border pb-4">
            <Settings2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Blueprint Constraints</h2>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Exam Target Name</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Format Standard</Label>
              <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={examType} onChange={e => setExamType(e.target.value)}>
                <option value="JEE_MAIN">JEE Main (90 Qs / 180 Min)</option>
                <option value="NEET">NEET (200 Qs / 200 Min)</option>
                <option value="CUSTOM">Custom Format</option>
              </select>
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel>
          <SectionHeader title="Intelligence Parameters" description="Define how the AI should assemble the questions." />
          
          <div className="space-y-8 mt-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Difficulty Curve</Label>
                <span className="text-xs font-mono text-muted-foreground">target curve</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'easy', label: 'Beginner', desc: '60% Easy / 30% Med' },
                  { id: 'standard', label: 'Standard', desc: '30% Easy / 50% Med' },
                  { id: 'hard', label: 'Advanced', desc: '20% Easy / 60% Hard' }
                ].map(curve => (
                  <div 
                    key={curve.id}
                    onClick={() => setDifficultyCurve(curve.id)}
                    className={cn(
                      "cursor-pointer rounded-lg border p-3 transition-all",
                      difficultyCurve === curve.id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-border/80 bg-card"
                    )}
                  >
                    <p className={cn("text-sm font-medium", difficultyCurve === curve.id ? "text-primary" : "text-foreground")}>{curve.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{curve.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Source Distribution Target</Label>
                <span className="text-xs text-primary font-medium">Recommended: 60% PYQ</span>
              </div>
              <div className="flex gap-2 h-3 rounded-full overflow-hidden bg-muted">
                <div className="bg-blue-500 w-[60%]" title="PYQ" />
                <div className="bg-emerald-500 w-[25%]" title="AI Generated" />
                <div className="bg-amber-500 w-[15%]" title="Custom" />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>PYQ (60%)</span>
                <span>AI (25%)</span>
                <span>Custom (15%)</span>
              </div>
            </div>
          </div>
        </DashboardPanel>
      </div>

      <div className="space-y-6">
        <DashboardPanel className="lg:sticky lg:top-4 bg-muted/10">
          <div className="flex items-center gap-2 mb-4 text-foreground">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Assembly Overview</h2>
          </div>
          
          <div className="space-y-4 text-sm mb-6">
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Total Questions</span>
              <span className="font-medium text-foreground">{totalQuestions} Qs</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Target Duration</span>
              <span className="font-medium text-foreground">{duration} mins</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Syllabus Span</span>
              <span className="font-medium text-foreground">Full Subject (PCM)</span>
            </div>
          </div>

          <Button 
            className="w-full shadow-sm" 
            size="lg" 
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <Brain className="h-4 w-4 animate-pulse" /> Assembling...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Brain className="h-4 w-4" /> Generate Blueprint
              </span>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground mt-3">
            AI will select questions from the bank satisfying these constraints.
          </p>
        </DashboardPanel>
      </div>
    </div>
  );
}

function CheckCircle2(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
  );
}
