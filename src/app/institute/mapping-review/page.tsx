"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

import { fetchInstituteUnmappedQuestions } from "@/app/institute/actions/analytics-fetch";

export default function MappingReviewPage() {
  const session = useWorkspaceAuthStore((s) => s.session);
  const [unmapped, setUnmapped] = useState<any[]>([]);
  const [syllabusNodes, setSyllabusNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [selections, setSelections] = useState<
    Record<string, { subjectId: string; chapterId: string; topicId: string }>
  >({});

  useEffect(() => {
    if (!session?.instituteId) return;
    loadData();
  }, [session?.instituteId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchInstituteUnmappedQuestions();
      setUnmapped(data.combined);
      setSyllabusNodes(data.nodes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (item: any) => {
    const sel = selections[item.id];
    if (!sel?.subjectId || !sel?.chapterId) {
      alert("Subject and Chapter are required");
      return;
    }

    setSaving((p) => ({ ...p, [item.id]: true }));
    try {
      const res = await fetch("/api/institute/mapping-review/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappingId: item.id,
          batchId: item.batch_id,
          questionId: item.question_id,
          aiSubject: item.ai_metadata?.subject || "",
          aiChapter: item.ai_metadata?.chapter || "",
          aiTopic: item.ai_metadata?.topic || item.ai_metadata?.subtopic || "",
          subjectId: sel.subjectId,
          chapterId: sel.chapterId,
          topicId: sel.topicId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      setUnmapped((prev) => prev.filter((p) => p.id !== item.id));
    } catch (err: any) {
      alert("Save failed: " + err.message);
    } finally {
      setSaving((p) => ({ ...p, [item.id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Syllabus Mapping Review
        </h1>
        <p className="text-muted-foreground">
          Review and correct questions that AI could not confidently map to your
          syllabus.
        </p>
      </div>

      {unmapped.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center shadow-sm">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">All clear!</h2>
          <p className="text-muted-foreground">
            There are no unmapped questions requiring your review.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {unmapped.map((item) => {
            const batchNodes = syllabusNodes.filter(
              (n) => n.batch_id === item.batch_id,
            );
            const subjects = batchNodes.filter(
              (n) => n.node_type === "SUBJECT",
            );
            const sel = selections[item.id] || {};
            const chapters = sel.subjectId
              ? batchNodes.filter(
                  (n) =>
                    n.node_type === "CHAPTER" && n.parent_id === sel.subjectId,
                )
              : [];
            const topics = sel.chapterId
              ? batchNodes.filter(
                  (n) =>
                    n.node_type === "TOPIC" && n.parent_id === sel.chapterId,
                )
              : [];

            return (
              <div
                key={item.id}
                className="bg-card border rounded-xl p-6 shadow-sm flex flex-col md:flex-row gap-8"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded font-medium">
                      Batch: {(item.batches as any)?.name}
                    </span>
                    <span className="bg-orange-500/10 text-orange-600 text-xs px-2 py-1 rounded font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Unmapped
                    </span>
                  </div>

                  <div className="border p-4 rounded-md bg-muted/20 mb-4 max-h-48 overflow-y-auto">
                    {item.question?.published_image_url && (
                      <img
                        src={item.question.published_image_url}
                        alt="Question"
                        className="max-w-full mb-2 h-24 object-contain"
                      />
                    )}
                    <p className="text-sm font-medium">
                      {item.question?.published_question_text ||
                        "No text available"}
                    </p>
                  </div>

                  <div className="text-sm border-l-2 border-primary/40 pl-3">
                    <p className="font-semibold text-muted-foreground mb-1">
                      AI Extracted Metadata:
                    </p>
                    <p>
                      Subject:{" "}
                      <span className="font-medium text-foreground">
                        {item.ai_metadata?.subject || "N/A"}
                      </span>
                    </p>
                    <p>
                      Chapter:{" "}
                      <span className="font-medium text-foreground">
                        {item.ai_metadata?.chapter || "N/A"}
                      </span>
                    </p>
                    <p>
                      Topic:{" "}
                      <span className="font-medium text-foreground">
                        {item.ai_metadata?.topic ||
                          item.ai_metadata?.subtopic ||
                          "N/A"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="w-full md:w-[400px] flex flex-col gap-4 bg-muted/10 p-5 rounded-lg border">
                  <h3 className="font-semibold border-b pb-2">
                    Manual Correction
                  </h3>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Subject *
                    </label>
                    <select
                      className="w-full border rounded-md p-2 text-sm bg-background"
                      value={sel.subjectId || ""}
                      onChange={(e) =>
                        setSelections((p) => ({
                          ...p,
                          [item.id]: {
                            ...sel,
                            subjectId: e.target.value,
                            chapterId: "",
                            topicId: "",
                          },
                        }))
                      }
                    >
                      <option value="">Select Subject...</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Chapter *
                    </label>
                    <select
                      className="w-full border rounded-md p-2 text-sm bg-background disabled:opacity-50"
                      value={sel.chapterId || ""}
                      disabled={!sel.subjectId}
                      onChange={(e) =>
                        setSelections((p) => ({
                          ...p,
                          [item.id]: {
                            ...sel,
                            chapterId: e.target.value,
                            topicId: "",
                          },
                        }))
                      }
                    >
                      <option value="">Select Chapter...</option>
                      {chapters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Topic
                    </label>
                    <select
                      className="w-full border rounded-md p-2 text-sm bg-background disabled:opacity-50"
                      value={sel.topicId || ""}
                      disabled={!sel.chapterId}
                      onChange={(e) =>
                        setSelections((p) => ({
                          ...p,
                          [item.id]: { ...sel, topicId: e.target.value },
                        }))
                      }
                    >
                      <option value="">Select Topic...</option>
                      {topics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    className="mt-2 w-full"
                    onClick={() => handleSave(item)}
                    disabled={
                      !sel.subjectId || !sel.chapterId || saving[item.id]
                    }
                  >
                    {saving[item.id] ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Save & Apply Rule
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
