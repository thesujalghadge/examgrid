"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Gauge,
  ListFilter,
  RefreshCw,
  SendToBack,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DashboardPanel,
  EmptyState,
  MetricCard,
  PageHeader,
  SectionHeader,
  StatusBadge,
} from "@/components/shared/product-ui";
import { cn } from "@/lib/utils";
import type { ReviewQuestionView } from "@/intelligence/services/review/review-service";
import type {
  IntelligenceMetrics,
} from "@/intelligence/services/metrics/metrics-service";
import type {
  QuestionMetadata,
  ReviewStatus,
  SegmentedQuestion,
  StructuredSolution,
} from "@/intelligence/types/pipeline";

const REVIEW_STATUSES: Array<ReviewStatus | ""> = [
  "",
  "pending",
  "needs_edit",
  "approved",
  "rejected",
  "reprocess",
];

type ReviewQuestion = ReviewQuestionView;

interface ReviewFilters {
  reviewStatus: ReviewStatus | "";
  lowConfidenceOnly: boolean;
  exam: string;
  subject: string;
  difficulty: string;
  extractionIssues: boolean;
}

const INITIAL_FILTERS: ReviewFilters = {
  reviewStatus: "",
  lowConfidenceOnly: false,
  exam: "",
  subject: "",
  difficulty: "",
  extractionIssues: false,
};

function percent(value?: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function scoreTone(score?: number): "green" | "amber" | "red" | "neutral" {
  if (score == null) return "neutral";
  if (score >= 80) return "green";
  if (score >= 60) return "amber";
  return "red";
}

function statusTone(status?: string): "green" | "amber" | "red" | "blue" | "neutral" {
  if (status === "approved" || status === "agreed") return "green";
  if (status === "needs_edit" || status === "pending" || status === "low_confidence") return "amber";
  if (status === "rejected" || status === "disputed" || status === "failed") return "red";
  if (status === "reprocess") return "blue";
  return "neutral";
}

function compact(text?: string, length = 120): string {
  const value = (text ?? "").replace(/\s+/g, " ").trim();
  if (value.length <= length) return value || "No text";
  return `${value.slice(0, length).trim()}...`;
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeSolution(solution?: StructuredSolution): string {
  return JSON.stringify(
    solution ?? { summary: "", steps: [], finalAnswer: "", keyConcepts: [] },
    null,
    2,
  );
}

export default function IntelligenceReviewPage() {
  const [filters, setFilters] = useState<ReviewFilters>(INITIAL_FILTERS);
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [metrics, setMetrics] = useState<IntelligenceMetrics | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => questions.find((question) => question.id === selectedId) ?? questions[0],
    [questions, selectedId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.reviewStatus) params.set("reviewStatus", filters.reviewStatus);
      if (filters.lowConfidenceOnly) params.set("lowConfidenceOnly", "true");
      if (filters.exam) params.set("exam", filters.exam);
      if (filters.subject) params.set("subject", filters.subject);
      if (filters.difficulty) params.set("difficulty", filters.difficulty);
      if (filters.extractionIssues) params.set("extractionIssues", "true");

      const [questionRes, metricRes] = await Promise.all([
        fetch(`/api/admin/intelligence/review/questions?${params.toString()}`, {
          cache: "no-store",
        }),
        fetch("/api/admin/intelligence/metrics", { cache: "no-store" }),
      ]);
      if (!questionRes.ok) throw new Error("Failed to load review queue.");
      if (!metricRes.ok) throw new Error("Failed to load intelligence metrics.");
      const questionData = (await questionRes.json()) as {
        questions: ReviewQuestion[];
      };
      const metricData = (await metricRes.json()) as {
        metrics: IntelligenceMetrics;
      };
      setQuestions(questionData.questions);
      setMetrics(metricData.metrics);
      setSelectedId((current) => {
        if (current && questionData.questions.some((item) => item.id === current)) {
          return current;
        }
        return questionData.questions[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load review data.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const updateQuestion = async (
    question: ReviewQuestion,
    patch: {
      reviewStatus: ReviewStatus;
      reviewNotes?: string;
      segment?: SegmentedQuestion;
      publishToBank?: boolean;
    },
  ) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/intelligence/review/questions/${question.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      if (!response.ok) throw new Error("Question update failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Question update failed.");
    } finally {
      setSaving(false);
    }
  };

  const updateSolution = async (
    solutionId: string,
    reviewStatus: ReviewStatus,
    structured: StructuredSolution,
  ) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/intelligence/review/solutions/${solutionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewStatus, structured }),
        },
      );
      if (!response.ok) throw new Error("Solution update failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Solution update failed.");
    } finally {
      setSaving(false);
    }
  };

  const updateMetadata = async (
    questionId: string,
    metadata: QuestionMetadata,
  ) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/intelligence/review/metadata/${questionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(metadata),
        },
      );
      if (!response.ok) throw new Error("Metadata update failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Metadata update failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic Intelligence"
        title="PYQ Review"
        description="Moderate extracted questions, inspect confidence signals, and publish only verified academic data."
        action={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <MetricsDashboard metrics={metrics} />

      <DashboardPanel>
        <SectionHeader
          title="Review Queue"
          description="Filter for risky questions first, then use the split panel to correct or route each item."
        />
        <ReviewFiltersBar filters={filters} onChange={setFilters} />
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(30rem,0.9fr)]">
          <ReviewTable
            questions={questions}
            selectedId={selected?.id ?? null}
            loading={loading}
            onSelect={setSelectedId}
          />
          {selected ? (
            <QuestionReviewPanel
              key={selected.id}
              question={selected}
              saving={saving}
              onQuestionUpdate={updateQuestion}
              onSolutionUpdate={updateSolution}
              onMetadataUpdate={updateMetadata}
            />
          ) : (
            <EmptyState
              title="No questions ready for review"
              description="Imported PYQs will appear here after extraction, segmentation, and quality scoring."
            />
          )}
        </div>
      </DashboardPanel>
    </div>
  );
}

function MetricsDashboard({ metrics }: { metrics: IntelligenceMetrics | null }) {
  const trendMax = Math.max(
    1,
    ...(metrics?.trend ?? []).flatMap((item) => [
      item.ingested,
      item.lowConfidence,
      item.approved,
    ]),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Ingestion success"
          value={metrics ? `${metrics.ingestionSuccessRate}%` : "—"}
          hint={`${metrics?.extractionFailures ?? 0} extraction failure(s)`}
          tone={(metrics?.ingestionSuccessRate ?? 0) >= 90 ? "good" : "warn"}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <MetricCard
          label="Segmentation accuracy"
          value={metrics ? `${metrics.segmentationAccuracy}%` : "—"}
          hint={`${metrics?.totalQuestions ?? 0} structured question(s)`}
          tone={(metrics?.segmentationAccuracy ?? 0) >= 85 ? "good" : "warn"}
          icon={<FileSearch className="h-4 w-4" />}
        />
        <MetricCard
          label="Low confidence"
          value={metrics ? `${metrics.lowConfidencePercentage}%` : "—"}
          hint="Routed into manual review"
          tone={(metrics?.lowConfidencePercentage ?? 100) <= 20 ? "good" : "warn"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <MetricCard
          label="Approval rate"
          value={metrics ? `${metrics.publishApprovalRate}%` : "—"}
          hint={`${metrics?.byReviewStatus.approved ?? 0} approved item(s)`}
          tone="default"
          icon={<Gauge className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <DashboardPanel>
          <SectionHeader title="Confidence Signals" />
          <div className="space-y-3">
            <SignalBar label="AI disagreement" value={metrics?.aiDisagreementFrequency ?? 0} />
            <SignalBar label="Manual correction" value={metrics?.manualCorrectionFrequency ?? 0} />
            <SignalBar label="Low confidence" value={metrics?.lowConfidencePercentage ?? 0} />
            <SignalBar label="Publish approval" value={metrics?.publishApprovalRate ?? 0} positive />
          </div>
        </DashboardPanel>
        <DashboardPanel>
          <SectionHeader title="Operational Trend" />
          <div className="space-y-4">
            {(metrics?.trend ?? [{ label: "Current", ingested: 0, lowConfidence: 0, approved: 0 }]).map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>{item.label}</span>
                  <span>{item.ingested} ingested</span>
                </div>
                <div className="grid h-9 grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <TrendBar label="Ingested" value={item.ingested} max={trendMax} className="bg-blue-500" />
                  <TrendBar label="Low" value={item.lowConfidence} max={trendMax} className="bg-amber-500" />
                  <TrendBar label="Approved" value={item.approved} max={trendMax} className="bg-emerald-600" />
                </div>
              </div>
            ))}
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}

function SignalBar({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: number;
  positive?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-mono text-slate-500">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div
          className={cn(
            "h-2 rounded-full",
            positive ? "bg-emerald-600" : value > 30 ? "bg-amber-500" : "bg-blue-500",
          )}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function TrendBar({
  label,
  value,
  max,
  className,
}: {
  label: string;
  value: number;
  max: number;
  className: string;
}) {
  return (
    <div className="relative flex items-end bg-white">
      <div
        className={cn("w-full opacity-85", className)}
        style={{ height: `${Math.max(8, (value / max) * 100)}%` }}
      />
      <span className="absolute inset-x-0 top-1 text-center text-[10px] font-medium text-slate-700">
        {label}: {value}
      </span>
    </div>
  );
}

function ReviewFiltersBar({
  filters,
  onChange,
}: {
  filters: ReviewFilters;
  onChange: (filters: ReviewFilters) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-6">
      <FilterField label="Status">
        <select
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
          value={filters.reviewStatus}
          onChange={(event) =>
            onChange({ ...filters, reviewStatus: event.target.value as ReviewStatus | "" })
          }
        >
          {REVIEW_STATUSES.map((status) => (
            <option key={status || "all"} value={status}>
              {status || "All"}
            </option>
          ))}
        </select>
      </FilterField>
      <FilterField label="Exam">
        <Input
          value={filters.exam}
          onChange={(event) => onChange({ ...filters, exam: event.target.value })}
          placeholder="jee_main"
        />
      </FilterField>
      <FilterField label="Subject">
        <Input
          value={filters.subject}
          onChange={(event) => onChange({ ...filters, subject: event.target.value })}
          placeholder="Physics"
        />
      </FilterField>
      <FilterField label="Difficulty">
        <select
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
          value={filters.difficulty}
          onChange={(event) => onChange({ ...filters, difficulty: event.target.value })}
        >
          <option value="">All</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </FilterField>
      <label className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={filters.lowConfidenceOnly}
          onChange={(event) =>
            onChange({ ...filters, lowConfidenceOnly: event.target.checked })
          }
        />
        Low confidence
      </label>
      <label className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={filters.extractionIssues}
          onChange={(event) =>
            onChange({ ...filters, extractionIssues: event.target.checked })
          }
        />
        Extraction issues
      </label>
      <Button
        variant="outline"
        className="md:col-span-6"
        onClick={() => onChange(INITIAL_FILTERS)}
      >
        <ListFilter className="mr-2 h-4 w-4" />
        Reset filters
      </Button>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

function ReviewTable({
  questions,
  selectedId,
  loading,
  onSelect,
}: {
  questions: ReviewQuestion[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Loading review queue...
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <EmptyState
        title="No matching questions"
        description="Try clearing filters or ingest another PYQ source."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="max-h-[46rem] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">Question Preview</th>
              <th className="px-3 py-3">Exam</th>
              <th className="px-3 py-3">Year</th>
              <th className="px-3 py-3">Subject</th>
              <th className="px-3 py-3">Extract</th>
              <th className="px-3 py-3">Verify</th>
              <th className="px-3 py-3">Metadata</th>
              <th className="px-3 py-3">Quality</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {questions.map((question) => {
              const quality = question.quality?.score.overallQualityScore;
              return (
                <tr
                  key={question.id}
                  className={cn(
                    "cursor-pointer align-top transition hover:bg-slate-50",
                    selectedId === question.id && "bg-blue-50/70",
                  )}
                  onClick={() => onSelect(question.id)}
                >
                  <td className="max-w-sm px-3 py-3">
                    <p className="font-medium text-slate-900">
                      {compact(question.segment.questionText, 110)}
                    </p>
                    {question.reviewQueueItem && (
                      <p className="mt-1 text-xs text-amber-700">
                        {question.reviewQueueItem.priority} ·{" "}
                        {question.reviewQueueItem.reasons.slice(0, 2).join(", ")}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs">{question.examProfileId}</td>
                  <td className="px-3 py-3 text-xs">{question.segment.year ?? "—"}</td>
                  <td className="px-3 py-3 text-xs">
                    {question.metadata?.subject ?? question.segment.subject ?? "—"}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {percent(question.segment.confidence)}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={statusTone(question.verificationStatus)}>
                      {question.verification
                        ? percent(question.verification.result.confidenceScore)
                        : "—"}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {percent(question.metadataConfidence)}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={scoreTone(quality)}>
                      {quality ?? "—"}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={statusTone(question.reviewStatus)}>
                      {question.reviewStatus}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuestionReviewPanel({
  question,
  saving,
  onQuestionUpdate,
  onSolutionUpdate,
  onMetadataUpdate,
}: {
  question: ReviewQuestion;
  saving: boolean;
  onQuestionUpdate: (
    question: ReviewQuestion,
    patch: {
      reviewStatus: ReviewStatus;
      reviewNotes?: string;
      segment?: SegmentedQuestion;
      publishToBank?: boolean;
    },
  ) => Promise<void>;
  onSolutionUpdate: (
    solutionId: string,
    reviewStatus: ReviewStatus,
    structured: StructuredSolution,
  ) => Promise<void>;
  onMetadataUpdate: (
    questionId: string,
    metadata: QuestionMetadata,
  ) => Promise<void>;
}) {
  const [questionText, setQuestionText] = useState(question.segment.questionText);
  const [optionsText, setOptionsText] = useState(
    question.segment.options.map((option) => `${option.label}. ${option.text}`).join("\n"),
  );
  const [answer, setAnswer] = useState(question.segment.correctAnswer ?? "");
  const [notes, setNotes] = useState(question.reviewNotes ?? "");
  const [solutionJson, setSolutionJson] = useState(serializeSolution(question.solution?.structured));
  const [metadataDraft, setMetadataDraft] = useState({
    subject: question.metadata?.subject ?? question.segment.subject ?? "",
    chapter: question.metadata?.chapter ?? "",
    topic: question.metadata?.topic ?? "",
    subtopic: question.metadata?.subtopic ?? "",
    difficulty: question.metadata?.difficulty ?? "medium",
    conceptTags: (question.metadata?.conceptTags ?? []).join(", "),
    formulaTags: (question.metadata?.formulaTags ?? []).join(", "),
    cognitiveStyle: question.metadata?.cognitiveStyle ?? "unknown",
  });
  const [localError, setLocalError] = useState<string | null>(null);

  const editedSegment = (): SegmentedQuestion => ({
    ...question.segment,
    questionText,
    correctAnswer: answer || undefined,
    options: optionsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const match = line.match(/^([A-Da-d0-9]+)[).:-]\s*(.*)$/);
        return {
          label: match?.[1]?.toUpperCase() ?? String.fromCharCode(65 + index),
          text: match?.[2]?.trim() ?? line,
        };
      }),
  });

  const saveSolution = async () => {
    if (!question.solution) return;
    setLocalError(null);
    try {
      const parsed = JSON.parse(solutionJson) as StructuredSolution;
      await onSolutionUpdate(question.solution.id, question.solution.reviewStatus, parsed);
    } catch {
      setLocalError("Solution JSON is not valid.");
    }
  };

  const saveMetadata = async () => {
    const metadata: QuestionMetadata = {
      subject: metadataDraft.subject || undefined,
      chapter: metadataDraft.chapter || undefined,
      topic: metadataDraft.topic || undefined,
      subtopic: metadataDraft.subtopic || undefined,
      difficulty: metadataDraft.difficulty as QuestionMetadata["difficulty"],
      conceptTags: parseList(metadataDraft.conceptTags),
      formulaTags: parseList(metadataDraft.formulaTags),
      cognitiveStyle: metadataDraft.cognitiveStyle as QuestionMetadata["cognitiveStyle"],
      taxonomyConfidence: question.metadata?.taxonomyConfidence ?? 0.65,
    };
    await onMetadataUpdate(question.id, metadata);
  };

  const quality = question.quality?.score;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Review Item
          </h2>
          <p className="mt-1 text-xs text-slate-500">{question.id}</p>
        </div>
        <StatusBadge tone={scoreTone(quality?.overallQualityScore)}>
          Quality {quality?.overallQualityScore ?? "—"}
        </StatusBadge>
      </div>

      {(localError || question.reviewQueueItem) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {localError ?? question.reviewQueueItem?.reasons.join(", ")}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <PanelSection title="Original Extraction">
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-700">
              {question.segment.rawBlock ?? question.segment.questionText}
            </pre>
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <Info label="Source" value={question.sourceId} />
              <Info label="Format" value={question.segment.questionFormat} />
              <Info label="Parser" value={percent(question.segment.parserConfidence)} />
              <Info label="Extraction" value={percent(question.segment.confidence)} />
            </div>
          </PanelSection>

          <PanelSection title="Parsed Question">
            <Label className="text-xs text-slate-500">Question</Label>
            <textarea
              className="min-h-28 w-full rounded-md border border-slate-200 p-3 text-sm"
              value={questionText}
              onChange={(event) => setQuestionText(event.target.value)}
            />
            <Label className="text-xs text-slate-500">Options</Label>
            <textarea
              className="min-h-28 w-full rounded-md border border-slate-200 p-3 font-mono text-xs"
              value={optionsText}
              onChange={(event) => setOptionsText(event.target.value)}
            />
            <Label className="text-xs text-slate-500">Answer Key</Label>
            <Input value={answer} onChange={(event) => setAnswer(event.target.value)} />
          </PanelSection>
        </div>

        <div className="space-y-4">
          <PanelSection title="AI Solution & Verification">
            <div className="grid gap-2 text-xs sm:grid-cols-3">
              <Info label="Solution" value={percent(question.solution?.confidence)} />
              <Info label="Verifier" value={question.verificationStatus ?? "pending"} />
              <Info label="Agreement" value={percent(question.verification?.result.agreementScore)} />
            </div>
            <textarea
              className="min-h-48 w-full rounded-md border border-slate-200 p-3 font-mono text-xs"
              value={solutionJson}
              onChange={(event) => setSolutionJson(event.target.value)}
            />
            <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-xs font-medium text-slate-700">
                Raw AI responses
              </summary>
              <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap text-xs text-slate-600">
                {question.solution?.rawResponse ?? "No solution response"}
                {"\n\n--- verifier ---\n"}
                {question.verification?.rawVerifierResponse ?? "No verifier response"}
              </pre>
            </details>
          </PanelSection>

          <PanelSection title="Metadata & Difficulty">
            <div className="grid gap-3 sm:grid-cols-2">
              <FilterField label="Subject">
                <Input
                  value={metadataDraft.subject}
                  onChange={(event) =>
                    setMetadataDraft({ ...metadataDraft, subject: event.target.value })
                  }
                />
              </FilterField>
              <FilterField label="Difficulty">
                <select
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                  value={metadataDraft.difficulty}
                  onChange={(event) =>
                    setMetadataDraft({
                      ...metadataDraft,
                      difficulty: event.target.value as NonNullable<QuestionMetadata["difficulty"]>,
                    })
                  }
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </FilterField>
              <FilterField label="Chapter">
                <Input
                  value={metadataDraft.chapter}
                  onChange={(event) =>
                    setMetadataDraft({ ...metadataDraft, chapter: event.target.value })
                  }
                />
              </FilterField>
              <FilterField label="Topic">
                <Input
                  value={metadataDraft.topic}
                  onChange={(event) =>
                    setMetadataDraft({ ...metadataDraft, topic: event.target.value })
                  }
                />
              </FilterField>
              <FilterField label="Subtopic">
                <Input
                  value={metadataDraft.subtopic}
                  onChange={(event) =>
                    setMetadataDraft({ ...metadataDraft, subtopic: event.target.value })
                  }
                />
              </FilterField>
              <FilterField label="Cognitive style">
                <select
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                  value={metadataDraft.cognitiveStyle}
                  onChange={(event) =>
                    setMetadataDraft({
                      ...metadataDraft,
                      cognitiveStyle: event.target.value as QuestionMetadata["cognitiveStyle"],
                    })
                  }
                >
                  <option value="conceptual">Conceptual</option>
                  <option value="formula_heavy">Formula heavy</option>
                  <option value="mixed">Mixed</option>
                  <option value="unknown">Unknown</option>
                </select>
              </FilterField>
            </div>
            <FilterField label="Concept tags">
              <Input
                value={metadataDraft.conceptTags}
                onChange={(event) =>
                  setMetadataDraft({ ...metadataDraft, conceptTags: event.target.value })
                }
              />
            </FilterField>
            <FilterField label="Formula tags">
              <Input
                value={metadataDraft.formulaTags}
                onChange={(event) =>
                  setMetadataDraft({ ...metadataDraft, formulaTags: event.target.value })
                }
              />
            </FilterField>
            <div className="grid gap-2 text-xs sm:grid-cols-3">
              <Info label="Metadata confidence" value={percent(question.metadataConfidence)} />
              <Info label="Difficulty score" value={percent(question.difficultyScore)} />
              <Info label="Bank question" value={question.bankQuestionId ?? "not published"} />
            </div>
          </PanelSection>
        </div>
      </div>

      {quality && (
        <PanelSection title="Quality Breakdown">
          <div className="grid gap-2 sm:grid-cols-3">
            {Object.entries(quality.signals).map(([key, value]) => (
              <Info key={key} label={key.replace(/([A-Z])/g, " $1")} value={percent(value)} />
            ))}
          </div>
          {quality.issues.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quality.issues.map((issue) => (
                <StatusBadge key={issue} tone="amber">
                  {issue}
                </StatusBadge>
              ))}
            </div>
          )}
        </PanelSection>
      )}

      <div className="space-y-2">
        <Label className="text-xs text-slate-500">Review notes</Label>
        <textarea
          className="min-h-20 w-full rounded-md border border-slate-200 p-3 text-sm"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <Button
          variant="outline"
          disabled={saving}
          onClick={() =>
            void onQuestionUpdate(question, {
              reviewStatus: "needs_edit",
              reviewNotes: notes,
              segment: editedSegment(),
            })
          }
        >
          <FileSearch className="mr-2 h-4 w-4" />
          Save edits
        </Button>
        <Button
          variant="outline"
          disabled={saving || !question.solution}
          onClick={() => void saveSolution()}
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          Save solution
        </Button>
        <Button variant="outline" disabled={saving} onClick={() => void saveMetadata()}>
          <Gauge className="mr-2 h-4 w-4" />
          Save metadata
        </Button>
        <Button
          className="bg-emerald-700 hover:bg-emerald-800"
          disabled={saving}
          onClick={() =>
            void onQuestionUpdate(question, {
              reviewStatus: "approved",
              reviewNotes: notes,
              segment: editedSegment(),
            })
          }
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Approve
        </Button>
        <Button
          className="bg-[var(--eg-brand)] hover:bg-[var(--eg-brand)]/90"
          disabled={saving}
          onClick={() =>
            void onQuestionUpdate(question, {
              reviewStatus: "approved",
              reviewNotes: notes,
              segment: editedSegment(),
              publishToBank: true,
            })
          }
        >
          <SendToBack className="mr-2 h-4 w-4" />
          Publish
        </Button>
        <Button
          variant="outline"
          disabled={saving}
          onClick={() =>
            void onQuestionUpdate(question, {
              reviewStatus: "reprocess",
              reviewNotes: notes,
              segment: editedSegment(),
            })
          }
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Reprocess
        </Button>
        <Button
          variant="outline"
          disabled={saving}
          className="border-red-200 text-red-700 hover:bg-red-50"
          onClick={() =>
            void onQuestionUpdate(question, {
              reviewStatus: "rejected",
              reviewNotes: notes,
              segment: editedSegment(),
            })
          }
        >
          <XCircle className="mr-2 h-4 w-4" />
          Reject
        </Button>
      </div>
    </div>
  );
}

function PanelSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-3">
      <h3 className="eg-section-title">{title}</h3>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-slate-900" title={String(value)}>
        {value}
      </p>
    </div>
  );
}
