"use client";

import { useMemo, useState } from "react";
import { Search, Filter, Plus, BookOpen, Clock, Activity, CheckCircle2, ChevronRight, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StatusBadge, DashboardPanel } from "@/components/shared/product-ui";
import { analyzeQuestionMetadataQuality } from "@/lib/question-intelligence/quality";
import type { BankQuestion } from "@/types/question-bank";
import { cn } from "@/lib/utils";

interface QuestionBankListProps {
  questions: BankQuestion[];
}

export function QuestionBankList({ questions }: QuestionBankListProps) {
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [type, setType] = useState("all");
  const [chapter, setChapter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const subjects = useMemo(
    () => [...new Set(questions.map((q) => q.subject))].sort(),
    [questions],
  );
  const chapters = useMemo(
    () => [...new Set(questions.map((q) => q.chapter))].sort(),
    [questions],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      if (subject !== "all" && item.subject !== subject) return false;
      if (difficulty !== "all" && item.difficulty !== difficulty) return false;
      if (type !== "all" && item.questionType !== type) return false;
      if (chapter !== "all" && item.chapter !== chapter) return false;
      if (!q) return true;
      return (
        item.questionText.toLowerCase().includes(q) ||
        item.topic.toLowerCase().includes(q) ||
        item.chapter.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
      );
    });
  }, [questions, search, subject, difficulty, type, chapter]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedQuestions = useMemo(() => {
    return questions.filter(q => selectedIds.has(q.id));
  }, [selectedIds, questions]);

  return (
    <div className="relative space-y-6 pb-24">
      {/* Sticky Search & Filter Bar */}
      <div className="sticky top-[73px] z-30 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-md border-b border-border shadow-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search question text, topics, IDs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 bg-card border-input focus-visible:ring-primary"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="all">All Subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hidden sm:block"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
            >
              <option value="all">All Chapters</option>
              {chapters.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="all">Difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <Button variant="outline" size="icon" className="shrink-0 sm:hidden">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span>Showing {filtered.length} results</span>
          <div className="flex gap-4">
            <span>Sort by: Relevance</span>
          </div>
        </div>
      </div>

      {/* Question List */}
      <div className="space-y-4">
        {filtered.map((q) => (
          <QuestionCard 
            key={q.id} 
            question={q} 
            selected={selectedIds.has(q.id)}
            onToggle={() => toggleSelect(q.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
            <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-lg font-medium text-foreground">No questions found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or search terms.</p>
          </div>
        )}
      </div>

      {/* Floating Persistent Test Cart */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl animate-in slide-in-from-bottom-8 fade-in duration-300">
          <div className="flex items-center justify-between rounded-full border border-border bg-card/95 p-2 pl-6 pr-2 shadow-xl backdrop-blur-md ring-1 ring-primary/5">
            <div className="flex items-center gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                {selectedIds.size}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-foreground">Questions selected</p>
                <p className="text-xs text-muted-foreground">
                  ~{selectedIds.size * 2} mins est. time
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
              <Button className="rounded-full shadow-sm" size="sm">
                Create Test <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionCard({ question: q, selected, onToggle }: { question: BankQuestion, selected: boolean, onToggle: () => void }) {
  // Simulate AI/historical metadata for the demo UX
  const aiConfidence = Math.floor(Math.random() * 15) + 85; 
  const successRate = Math.floor(Math.random() * 40) + 30;

  return (
    <article 
      className={cn(
        "group relative rounded-xl border bg-card p-5 transition-all hover:shadow-md cursor-pointer",
        selected ? "border-primary ring-1 ring-primary/20 bg-primary/5" : "border-border hover:border-border/80"
      )}
      onClick={onToggle}
    >
      <div className="absolute top-5 right-5">
        <div className={cn(
          "flex h-6 w-6 items-center justify-center rounded-md border transition-colors",
          selected ? "bg-primary border-primary text-primary-foreground" : "border-input bg-background group-hover:border-primary/50"
        )}>
          {selected && <CheckCircle2 className="h-4 w-4" />}
        </div>
      </div>

      <div className="mb-4 pr-10 flex flex-wrap items-center gap-2">
        <StatusBadge tone="blue">{q.subject}</StatusBadge>
        <StatusBadge tone={q.difficulty === 'hard' ? 'red' : q.difficulty === 'medium' ? 'amber' : 'green'}>
          {q.difficulty}
        </StatusBadge>
        <StatusBadge tone="neutral" className="border-dashed">
          {q.sourceType === "PYQ" ? "🏛️ PYQ" : "🤖 AI Generated"}
        </StatusBadge>
        <span className="text-xs font-mono text-muted-foreground ml-2">{q.id}</span>
      </div>

      <p className="text-sm text-foreground leading-relaxed pr-8">
        {q.questionText}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border/50 pt-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{q.chapter}</span>
          <span className="mx-1 opacity-50">/</span>
          <span>{q.topic}</span>
        </div>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground ml-auto">
          <div className="flex items-center gap-1.5" title="AI Verification Confidence">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            <span>{aiConfidence}% AI Conf.</span>
          </div>
          <div className="flex items-center gap-1.5" title="Historical Success Rate">
            <GraduationCap className="h-3.5 w-3.5 text-blue-500" />
            <span>{successRate}% Success</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 opacity-70" />
            <span>{q.difficulty === 'hard' ? '3m' : '1.5m'} est.</span>
          </div>
        </div>
      </div>
    </article>
  );
}
