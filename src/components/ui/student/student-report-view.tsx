import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BrainCircuit, CheckCircle2, Target, Award, Loader2 } from "lucide-react";
import { DoughnutChart } from "@/components/ui/student/doughnut-chart";
import { SectionHeader } from "@/components/ui/student/section-header";
import { CTAButton } from "@/components/ui/student/cta-button";

interface StudentCumulativeReportViewProps {
  role: "student" | "institute";
  loading: boolean;
  isGenerating: boolean;
  hasData: boolean;
  studentName?: string;
  metrics: {
    totalTests: number;
    avgScore: number;
    avgAccuracy: number;
    bestRank: number | string;
    progressData: any[];
  } | null;
  subjectData: { subject: string; score: number }[];
  topRecommendation?: string;
  keyInsight?: string;
  actionPlan?: string[];
  strongAreas?: { name: string; accuracy: number }[];
  needsAttention?: { name: string; accuracy: number }[];
}

export function StudentCumulativeReportView({
  role,
  loading,
  isGenerating,
  hasData,
  studentName,
  metrics,
  subjectData,
  topRecommendation,
  keyInsight,
  actionPlan = [],
  strongAreas = [],
  needsAttention = [],
}: StudentCumulativeReportViewProps) {
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-[var(--eg-text-secondary)]">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-medium">Preparing performance view...</span>
      </div>
    );
  }

  if (!hasData || !metrics) {
    return (
      <div className="mx-auto max-w-[900px] space-y-6 pt-10">
        <section className="rounded-[32px] bg-white px-6 py-10 text-center" style={{ border: "1px solid rgba(232,234,243,0.9)", boxShadow: "var(--eg-shadow-rest)" }}>
          <BrainCircuit className="mx-auto mb-4 h-11 w-11 text-[var(--eg-accent)]" />
          <h1 className="text-3xl font-bold tracking-tight text-[var(--eg-text-primary)]">
            {role === "institute" ? "No tests completed yet." : "Your performance story starts after test one."}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--eg-text-secondary)]">
            {role === "institute"
              ? "This student has not submitted any tests yet."
              : "Complete a test to unlock trends, strengths, weak areas, and the next best revision action."}
          </p>
          {role === "student" && (
            <div className="mt-6">
              <CTAButton href="/student/tests" variant="primary">View Tests</CTAButton>
            </div>
          )}
        </section>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="mx-auto max-w-[900px] space-y-6 pt-10">
        <section className="rounded-[32px] bg-white px-6 py-10 text-center" style={{ border: "1px dashed var(--eg-border)" }}>
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[var(--eg-accent)]" />
          <h1 className="text-2xl font-bold text-[var(--eg-text-primary)]">Analysis is being generated.</h1>
          <p className="mt-2 text-sm text-[var(--eg-text-secondary)]">The latest attempt is being folded into the report.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1020px] pb-16">
      {/* Hero */}
      <section className="mb-8 mt-6 px-2 text-center sm:text-left">
        <h1 className="text-[32px] sm:text-[40px] font-bold leading-tight tracking-tight text-[var(--eg-text-primary)]">
          {role === "institute" ? (
            <>Performance History: <span className="text-[var(--eg-accent)]">{studentName}</span></>
          ) : (
            "Here's what your recent tests are telling us."
          )}
        </h1>
        <p className="mt-3 text-base text-[var(--eg-text-secondary)] max-w-2xl">
          {role === "institute" ? "Cumulative academic profile based on recent tests." : topRecommendation}
        </p>
      </section>

      {/* Top Metrics */}
      <div className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-4 px-2">
        <div className="flex flex-col gap-1 rounded-xl bg-transparent py-2">
          <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)] flex items-center gap-1.5"><BrainCircuit size={14}/> Tests</span>
          <span className="text-[28px] font-bold text-[var(--eg-text-primary)] leading-none">{metrics.totalTests}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-transparent py-2">
          <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)] flex items-center gap-1.5"><Target size={14}/> Avg Score</span>
          <span className="text-[28px] font-bold text-[var(--eg-text-primary)] leading-none">{metrics.avgScore}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-transparent py-2">
          <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)] flex items-center gap-1.5"><CheckCircle2 size={14}/> Accuracy</span>
          <span className="text-[28px] font-bold text-[var(--eg-text-primary)] leading-none">{metrics.avgAccuracy}%</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-transparent py-2">
          <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)] flex items-center gap-1.5"><Award size={14}/> Best Rank</span>
          <span className="text-[28px] font-bold text-[var(--eg-text-primary)] leading-none">{metrics.bestRank !== "-" ? `#${metrics.bestRank}` : "-"}</span>
        </div>
      </div>

      {/* Key Insight (Student only) */}
      {role === "student" && keyInsight && (
        <section className="mb-16 px-2">
          <div 
            className="rounded-[32px] bg-[#fcfdfc] p-8 sm:p-10 transition-all duration-300" 
            style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 30px rgba(0,0,0,0.02)" }}
          >
            <h2 className="mb-4 text-[12px] font-bold uppercase tracking-widest text-[var(--eg-accent)]">
              Key Insight
            </h2>
            <p className="text-[24px] sm:text-[32px] font-bold leading-snug tracking-tight text-[var(--eg-text-primary)]">
              {keyInsight}
            </p>
          </div>
        </section>
      )}

      {/* Area Chart: Score History (renamed from 'Why your score is moving') */}
      <section>
        <SectionHeader eyebrow="History" title={role === "institute" ? "Score Progression" : "Why your score is moving"} />
        <div className="rounded-[28px] bg-white p-4 sm:p-6" style={{ border: "1px solid rgba(232,234,243,0.9)", boxShadow: "var(--eg-shadow-rest)" }}>
          <div className="h-[260px] sm:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.progressData} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--eg-accent)" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="var(--eg-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--eg-border)" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="var(--eg-text-tertiary)" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--eg-text-tertiary)" />
                <RechartsTooltip contentStyle={{ borderRadius: 18, border: "1px solid var(--eg-border)", boxShadow: "var(--eg-shadow-rest)" }} />
                <Area type="monotone" dataKey="score" stroke="var(--eg-accent)" strokeWidth={3} fill="url(#scoreFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[1fr_0.9fr]">
        {/* Subject Accuracy */}
        <section>
          <SectionHeader eyebrow="Subjects" title={role === "institute" ? "Subject Accuracy Breakdowns" : "Where your accuracy comes from"} />
          <div className="grid grid-cols-2 gap-4 rounded-[28px] bg-white p-5 sm:grid-cols-4" style={{ border: "1px solid rgba(232,234,243,0.9)", boxShadow: "var(--eg-shadow-rest)" }}>
            {subjectData.map((s, i) => (
              <DoughnutChart
                key={s.subject}
                percentage={s.score}
                label={s.subject}
                color={i === 0 ? "var(--eg-accent)" : i === 1 ? "var(--eg-coach)" : i === 2 ? "var(--eg-warm)" : "var(--eg-danger)"}
              />
            ))}
          </div>
        </section>

        {/* Score vs Accuracy */}
        <section>
          <SectionHeader eyebrow="Accuracy" title="Score vs accuracy" />
          <div className="rounded-[28px] bg-white p-5" style={{ border: "1px solid rgba(232,234,243,0.9)", boxShadow: "var(--eg-shadow-rest)" }}>
            <div className="h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.progressData} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="var(--eg-border)" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="var(--eg-text-tertiary)" />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--eg-text-tertiary)" />
                  <RechartsTooltip contentStyle={{ borderRadius: 18, border: "1px solid var(--eg-border)" }} />
                  <Line type="monotone" dataKey="accuracy" stroke="var(--eg-coach)" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>

      {/* Academic Performance */}
      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 px-2">
        <section>
          <SectionHeader eyebrow="Performance" title="Strong Areas" />
          <div className="rounded-[28px] bg-white p-5 sm:p-6" style={{ border: "1px solid rgba(232,234,243,0.9)", boxShadow: "var(--eg-shadow-rest)" }}>
            {strongAreas.length === 0 ? (
              <p className="text-sm text-[var(--eg-text-secondary)]">No strong areas identified yet. Keep practicing.</p>
            ) : (
              <ul className="space-y-4">
                {strongAreas.map((area, idx) => (
                  <li key={idx} className="flex items-center justify-between border-b border-[var(--eg-border)] pb-3 last:border-0 last:pb-0">
                    <span className="text-[15px] font-semibold text-[var(--eg-text-primary)]">{area.name}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      {area.accuracy}% Acc
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <SectionHeader eyebrow="Focus" title="Needs Attention" />
          <div className="rounded-[28px] bg-white p-5 sm:p-6" style={{ border: "1px solid rgba(232,234,243,0.9)", boxShadow: "var(--eg-shadow-rest)" }}>
            {needsAttention.length === 0 ? (
              <p className="text-sm text-[var(--eg-text-secondary)]">No weak areas identified. Great job.</p>
            ) : (
              <ul className="space-y-4">
                {needsAttention.map((area, idx) => (
                  <li key={idx} className="flex items-center justify-between border-b border-[var(--eg-border)] pb-3 last:border-0 last:pb-0">
                    <span className="text-[15px] font-semibold text-[var(--eg-text-primary)]">{area.name}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                      {area.accuracy}% Acc
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Action Plan (Student only) */}
      {role === "student" && actionPlan.length > 0 && (
        <section className="mt-16 px-2">
          <h2 className="mb-6 text-[18px] font-bold text-[var(--eg-text-primary)]">Action Plan</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {actionPlan.map((action, idx) => (
              <div key={idx} className="flex items-start gap-4 rounded-[20px] bg-[var(--eg-surface-soft)] p-5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--eg-accent)] text-[14px] font-bold text-white">
                  {idx + 1}
                </div>
                <p className="mt-1 text-[15px] font-semibold leading-snug text-[var(--eg-text-primary)]">
                  {action}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Consistency block (Student only) */}
      {role === "student" && (
        <section className="mt-20 text-center px-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--eg-surface-soft)] text-[var(--eg-text-tertiary)] mb-4">
            <CheckCircle2 size={24} />
          </div>
          <h2 className="text-[20px] sm:text-[24px] font-bold text-[var(--eg-text-primary)]">
            Consistency is your strongest tool.
          </h2>
          <p className="mt-2 text-[14px] sm:text-[15px] text-[var(--eg-text-secondary)]">
            Show up for your next paper. The trends will take care of themselves.
          </p>
        </section>
      )}
    </div>
  );
}
