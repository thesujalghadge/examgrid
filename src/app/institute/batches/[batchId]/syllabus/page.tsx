"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface Subtopic {
  name: string;
}
interface Topic {
  name: string;
  subtopics?: Subtopic[];
}
interface Chapter {
  name: string;
  topics?: Topic[];
}
interface Subject {
  name: string;
  chapters?: Chapter[];
}

export default function BatchSyllabusPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const router = useRouter();
  const { batchId } = use(params);
  const session = useWorkspaceAuthStore((s) => s.session);

  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedSyllabus, setExtractedSyllabus] = useState<{
    subjects: Subject[];
  } | null>(null);
  const [success, setSuccess] = useState(false);

  const handleExtract = async () => {
    if (!file || !session?.instituteId) return;
    setIsExtracting(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("instituteId", session.instituteId);

      const res = await fetch(
        `/api/institute/batches/${batchId}/syllabus/extract`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to extract syllabus");

      setExtractedSyllabus(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!extractedSyllabus || !session?.instituteId) return;
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/institute/batches/${batchId}/syllabus/save`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instituteId: session.instituteId,
            subjects: extractedSyllabus.subjects,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save syllabus");

      setSuccess(true);
      setTimeout(() => {
        router.push("/institute/batches");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/institute/batches"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Batch Syllabus Management
          </h1>
          <p className="text-muted-foreground">
            Upload and verify the syllabus hierarchy for this batch.
          </p>
        </div>
      </div>

      {!extractedSyllabus ? (
        <div className="bg-card border rounded-xl p-8 shadow-sm">
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg bg-muted/50">
            <div className="bg-primary/10 p-4 rounded-full mb-4">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Upload Syllabus Document
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
              Upload a PDF, DOCX, XLSX, or CSV file containing your syllabus.
              Our AI will automatically extract the Subject, Chapter, and Topic
              hierarchy.
            </p>
            <div className="flex items-center gap-4 w-full max-w-sm">
              <Input
                type="file"
                accept=".pdf,.docx,.xlsx,.csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="flex-1 cursor-pointer"
              />
              <Button onClick={handleExtract} disabled={!file || isExtracting}>
                {isExtracting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-2" />
                )}
                Extract
              </Button>
            </div>
          </div>
          {error && (
            <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">
                Extracted Hierarchy Preview
              </h2>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setExtractedSyllabus(null)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving || success}>
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  {success ? "Saved!" : "Save Syllabus"}
                </Button>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-500/10 text-green-600 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">
                  Syllabus saved successfully. Mapping layer triggered.
                  Redirecting...
                </p>
              </div>
            )}

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4">
              {extractedSyllabus.subjects.map((subject, sIdx) => (
                <div key={sIdx} className="border rounded-lg p-4 bg-muted/20">
                  <h3 className="font-semibold text-lg text-primary">
                    {subject.name}
                  </h3>
                  <div className="mt-3 space-y-3 pl-4 border-l-2 border-primary/20">
                    {subject.chapters?.map((chapter, cIdx) => (
                      <div key={cIdx}>
                        <h4 className="font-medium text-foreground">
                          {chapter.name}
                        </h4>
                        {chapter.topics && chapter.topics.length > 0 && (
                          <div className="mt-2 pl-4 border-l-2 border-muted-foreground/20 space-y-1">
                            {chapter.topics.map((topic, tIdx) => (
                              <div key={tIdx}>
                                <p className="text-sm text-muted-foreground">
                                  • {topic.name}
                                </p>
                                {topic.subtopics &&
                                  topic.subtopics.length > 0 && (
                                    <div className="pl-4 mt-1">
                                      {topic.subtopics.map((sub, subIdx) => (
                                        <p
                                          key={subIdx}
                                          className="text-xs text-muted-foreground/70"
                                        >
                                          - {sub.name}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
