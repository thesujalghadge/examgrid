"use client";

import { useEffect, useState } from "react";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { fetchQueueItems, regenerateJob, regenerateFailed, regenerateNeedsReview } from "@/app/institute/actions/queue-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SolutionQueuePage() {
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId);
  const [filter, setFilter] = useState("failed");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    if (!instituteId) return;
    setLoading(true);
    const data = await fetchQueueItems(instituteId, filter);
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
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

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Solution Pipeline Queue</h2>
        <p className="text-sm text-[#5e5a52]">Monitor and manage asynchronous solution generation jobs.</p>
      </div>

      <div className="flex gap-4">
        <Button variant={filter === "failed" ? "default" : "outline"} onClick={() => setFilter("failed")}>Failed</Button>
        <Button variant={filter === "needs_review" ? "default" : "outline"} onClick={() => setFilter("needs_review")}>Needs Review (Confidence &lt;= 0.1)</Button>
        <Button variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>Pending</Button>
        <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All Active Jobs</Button>
      </div>

      <div className="flex gap-4 p-4 border border-[#ece6da] rounded-xl bg-slate-50">
        <Button variant="outline" size="sm" onClick={handleRegenFailed}>Regenerate All Failed</Button>
        <Button variant="outline" size="sm" onClick={handleRegenReview}>Regenerate All Needs Review</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b text-[#5e5a52]">
                <tr>
                  <th className="py-2 pr-4 w-1/3">Question Snippet</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Attempts</th>
                  <th className="py-2 pr-4 w-1/3">Last Error</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && <tr><td colSpan={5} className="py-4 text-center">No jobs found in this category.</td></tr>}
                {items.map(job => (
                  <tr key={job.id} className="border-b border-[#ece6da]">
                    <td className="py-2 pr-4 truncate max-w-[200px]">{job.questions?.question_text || job.question_id}</td>
                    <td className="py-2 pr-4 font-medium text-amber-700">{job.status}</td>
                    <td className="py-2 pr-4">{job.attempts}</td>
                    <td className="py-2 pr-4 text-red-600 truncate max-w-[200px]">{job.last_error || "None"}</td>
                    <td className="py-2">
                      <Button variant="ghost" size="sm" onClick={() => handleRegenerateJob(job.question_id)}>
                        Regenerate
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
