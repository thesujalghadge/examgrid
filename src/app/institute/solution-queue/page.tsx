"use client";

import { useEffect, useState, useCallback } from "react";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import {
  fetchQueueItems,
  fetchExamStatusList,
  regenerateJob,
  regenerateFailed,
  regenerateNeedsReview,
} from "@/app/institute/actions/queue-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ExamStatus {
  exam_id: string;
  total_questions: number;
  completed: number;
  failed: number;
  pending: number;
  processing: number;
  timed_out: number;
  progress_pct: number;
  is_ready: boolean;
  solutions_visible_at: string | null;
  status_exists: boolean;
  // ETA metrics (from migration 20260623020000)
  started_at: string | null;
  last_completed_at: string | null;
  average_question_seconds: number | null;
  estimated_remaining_seconds: number | null;
}

// ─────────────────────────────────────────────────────────
// Exam Status Card — per-exam live progress panel
// ─────────────────────────────────────────────────────────

function ExamStatusCard({
  examId,
  instituteId,
}: {
  examId: string;
  instituteId: string;
}) {
  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const res = await window.fetch(
        `/api/institute/${instituteId}/solution-status?examId=${encodeURIComponent(examId)}`,
      );
      if (!res.ok) return;
      setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, [examId, instituteId]);

  useEffect(() => {
    fetch();
    // Auto-refresh every 15s while solutions are still pending
    const interval = setInterval(fetch, 15_000);
    return () => clearInterval(interval);
  }, [fetch]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Loading solution status…
      </div>
    );
  }
  if (!status) return null;

  const pct = Number(status.progress_pct ?? 0);
  const barColor =
    status.is_ready
      ? "bg-emerald-500"
      : status.failed > 0
        ? "bg-amber-500"
        : "bg-blue-500";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Solution Generation
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-700 font-mono">
            {examId.length > 40 ? `…${examId.slice(-28)}` : examId}
          </p>
        </div>
        {status.is_ready ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
            ✓ Ready
          </span>
        ) : status.failed > 0 && status.pending === 0 ? (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
            ✗ Issues
          </span>
        ) : (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 animate-pulse">
            ⟳ In progress
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-2.5 w-full rounded-full bg-slate-100">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.max(pct, status.completed > 0 ? 2 : 0)}%` }}
        />
      </div>

      {/* Counts */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <StatCell
          label="Completed"
          value={status.completed}
          total={status.total_questions}
          color="text-emerald-600"
        />
        <StatCell label="Pending" value={status.pending} color="text-blue-600" />
        <StatCell label="Processing" value={status.processing} color="text-indigo-600" />
        <StatCell
          label="Failed"
          value={(status.failed ?? 0) + (status.timed_out ?? 0)}
          color={(status.failed ?? 0) + (status.timed_out ?? 0) > 0 ? "text-red-600" : "text-slate-400"}
        />
      </div>

      {/* ETA row */}
      {!status.is_ready && status.estimated_remaining_seconds != null && status.estimated_remaining_seconds > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
          <span className="text-xs text-blue-700 font-medium">
            ⏱ ETA: {formatSeconds(status.estimated_remaining_seconds)}
          </span>
          {status.average_question_seconds != null && (
            <span className="text-xs text-slate-500">
              ~{Number(status.average_question_seconds).toFixed(1)}s / question
            </span>
          )}
        </div>
      )}

      {status.solutions_visible_at && (
        <p className="mt-3 text-xs text-emerald-600">
          Solutions visible since{" "}
          {new Date(status.solutions_visible_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function formatSeconds(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function StatCell({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total?: number;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <p className={`text-lg font-extrabold ${color}`}>
        {value}
        {total !== undefined && (
          <span className="text-xs font-normal text-slate-400">/{total}</span>
        )}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────

export default function SolutionQueuePage() {
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId);
  const [filter, setFilter] = useState("failed");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [examStatuses, setExamStatuses] = useState<any[]>([]);

  const loadData = async () => {
    if (!instituteId) return;
    setLoading(true);
    const [data, statuses] = await Promise.all([
      fetchQueueItems(instituteId, filter),
      fetchExamStatusList(instituteId),
    ]);
    setItems(data);
    setExamStatuses(statuses);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteId, filter]);

  const handleRegenerateJob = async (questionId: string) => {
    if (!instituteId) return;
    await regenerateJob(instituteId, questionId);
    loadData();
  };

  const handleRegenFailed = async () => {
    if (!instituteId) return;
    await regenerateFailed(instituteId);
    loadData();
  };

  const handleRegenReview = async () => {
    if (!instituteId) return;
    await regenerateNeedsReview(instituteId);
    loadData();
  };

  const filterBtns = [
    { key: "failed", label: "Failed" },
    { key: "needs_review", label: "Needs Review" },
    { key: "pending", label: "Pending" },
    { key: "all", label: "All Active Jobs" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Solution Pipeline</h2>
        <p className="text-sm text-[#5e5a52]">
          Monitor real-time solution generation status per exam. Auto-refreshes every 15s.
        </p>
      </div>

      {/* Per-exam status panels from exam_solution_status table */}
      {instituteId && examStatuses.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Exam Status (live · auto-refresh every 15s)
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {examStatuses.map((s) => (
              <ExamStatusCard key={s.exam_id} examId={s.exam_id} instituteId={instituteId} />
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filterBtns.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="flex gap-3 rounded-xl border border-[#ece6da] bg-slate-50 p-4">
        <Button variant="outline" size="sm" onClick={handleRegenFailed}>
          Regenerate All Failed
        </Button>
        <Button variant="outline" size="sm" onClick={handleRegenReview}>
          Regenerate All Needs Review
        </Button>
        <Button variant="outline" size="sm" onClick={loadData}>
          ↻ Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b text-[#5e5a52]">
                <tr>
                  <th className="py-2 pr-4 w-1/3">Question</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Attempts</th>
                  <th className="py-2 pr-4 w-1/3">Last Error</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No jobs in this category. ✓
                    </td>
                  </tr>
                )}
                {items.map((job) => (
                  <tr key={job.id} className="border-b border-[#ece6da] hover:bg-slate-50">
                    <td className="py-2 pr-4 truncate max-w-[180px] font-mono text-xs text-slate-600">
                      {job.questions?.question_text?.substring(0, 50) || job.question_id}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{job.attempts}</td>
                    <td className="py-2 pr-4 text-red-600 truncate max-w-[200px] text-xs">
                      {job.last_error || "—"}
                    </td>
                    <td className="py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerateJob(job.question_id)}
                      >
                        Retry
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: "bg-emerald-100 text-emerald-700",
    FAILED: "bg-red-100 text-red-700",
    PENDING: "bg-blue-100 text-blue-700",
    PROCESSING: "bg-indigo-100 text-indigo-700",
    WAITING_RETRY: "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}
    >
      {status}
    </span>
  );
}
