"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExamInterface } from "@/components/exam/ExamInterface";
import { buildCbtTestFromProcessedPaper } from "@/lib/cbt/build-test-from-processing";
import { applySubjectMapping, defaultSubjectMapping } from "@/lib/cbt/subject-mapping";
import { cbtTestToExamDefinition } from "@/lib/cbt/cbt-to-exam";
import { cn } from "@/lib/utils";
import {
  detectFileType,
  inferQuestionTypeFromMeta,
  MAX_ANSWER_KEY_UPLOAD_BYTES,
  MAX_PAPER_UPLOAD_BYTES,
  normalizeProcessedPaper,
  validateProcessedPaper,
  validateUploadFile,
} from "@/lib/cbt/paper-processing";
import { logSecurityEvent, logUploadEvent } from "@/lib/logging/runtime-logger";
import { awaitRepositoryPersist } from "@/lib/repositories/await-persist";
import { getRepositories } from "@/lib/repositories/provider";
import { makeCbtId } from "@/lib/cbt/cbt-ids";
import { createScheduleInput } from "@/services/institute-ops-service";
import { getQuestionBank, saveQuestionBank } from "@/services/question-bank-service";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import type { ExamDefinition } from "@/types/exam";
import type { Batch } from "@/types/institute-ops";
import type {
  PaperSubjectMapping,
  PreparedQuestionMeta,
  ProcessedPaperPackage,
  SubjectRangeMapping,
  SupportedPaperFileType,
} from "@/types/cbt-paper-processing";

type FlowStep = "setup" | "processing" | "review" | "done";

interface ParsedGeminiOption {
  id: string;
  text: string;
  latex?: string | null;
  image?: string;
}

interface ParsedGeminiQuestion {
  id: string | number;
  type: "mcq" | "numerical" | "multi_correct";
  subject?: string | null;
  stem: string;
  stemLatex?: string | null;
  stem_image?: string;
  options?: ParsedGeminiOption[] | null;
  answer?: string | null;
  explanation?: string | null;
  images?: string[];
  hasImage?: boolean;
  confidence?: number | null;
}

interface ParsedGeminiPaper {
  questions: ParsedGeminiQuestion[];
}

const ACCEPT_PAPER = ".pdf,.doc,.docx,.txt,.csv,.xlsx";
const ACCEPT_KEY = ".pdf,.doc,.docx,.txt,.csv,.xlsx";
const PAPER_FILE_TYPES = ["pdf", "doc", "docx", "txt", "csv", "xlsx"] as const;
const ANSWER_KEY_FILE_TYPES = ["pdf", "doc", "docx", "txt", "csv", "xlsx"] as const;
const PLANNED_JEE_QUESTIONS = 75;
const SUBJECT_OPTIONS = ["Physics", "Chemistry", "Mathematics", "Biology", "Custom"] as const;

export function InstitutePaperUploadFlow() {
  const session = useWorkspaceAuthStore((state) => state.session);
  const hydrateSession = useWorkspaceAuthStore((state) => state.hydrateSession);
  const instituteId = session?.instituteId ?? "";
  const createdBy = session?.userId ?? "institute-admin";

  const [step, setStep] = useState<FlowStep>("setup");
  const [processing, setProcessing] = useState(false);
  const [progressText, setProgressText] = useState("Initializing pipeline...");
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [pkg, setPkg] = useState<ProcessedPaperPackage | null>(null);
  const [publishError, setPublishError] = useState("");

  const [title, setTitle] = useState("Weekly CBT");
  const [duration, setDuration] = useState("180");
  const [marksPerQuestion, setMarksPerQuestion] = useState("4");
  const [negativeMarks, setNegativeMarks] = useState("1");
  const [examType, setExamType] = useState<ExamDefinition["examType"]>("JEE_MAIN");
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [subjectMapping, setSubjectMapping] = useState<PaperSubjectMapping>(() =>
    defaultSubjectMapping(PLANNED_JEE_QUESTIONS, "full"),
  );
  const [plannedQuestions, setPlannedQuestions] = useState(String(PLANNED_JEE_QUESTIONS));
  const [batches, setBatches] = useState<Batch[]>([]);
  const [publishedTestId, setPublishedTestId] = useState<string | null>(null);
  const [publishedTitle, setPublishedTitle] = useState("");
  const [publishing, setPublishing] = useState(false);
  const publishInFlightRef = useRef(false);
  const publishTestIdRef = useRef<string | null>(null);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    const list = getRepositories()
      .batches.list()
      .filter((batch) => !instituteId || batch.instituteId === instituteId);
    setBatches(list);
    if (list.length > 0 && selectedBatchIds.length === 0) {
      setSelectedBatchIds(list.map((batch) => batch.id));
    }
  }, [instituteId, selectedBatchIds.length]);

  const questionCountForSubjects = pkg?.totalQuestions ?? Math.max(1, parseInt(plannedQuestions, 10) || PLANNED_JEE_QUESTIONS);
  const subjectRanges = useMemo(
    () => subjectMapping.ranges ?? defaultSubjectMapping(questionCountForSubjects, "full").ranges ?? [],
    [questionCountForSubjects, subjectMapping.ranges],
  );
  const rangeValidation = useMemo(
    () => validateSubjectRanges(subjectRanges, questionCountForSubjects),
    [questionCountForSubjects, subjectRanges],
  );

  const previewBundle = useMemo(() => {
    if (!pkg) return null;
    const testId = `${pkg.id}-preview`;
    const built = buildCbtTestFromProcessedPaper(
      {
        ...pkg,
        title: title.trim() || pkg.title,
        durationMinutes: Math.max(1, parseInt(duration, 10) || 60),
        totalMarks: pkg.totalMarks,
      },
      testId,
      selectedBatchIds,
      createdBy,
      examType,
    );
    const exam = cbtTestToExamDefinition(built.test, built.bankQuestions);
    if (!exam) return null;
    return { ...built, exam };
  }, [createdBy, duration, examType, pkg, selectedBatchIds, title]);

  const applyPackageUpdate = useCallback(
    (updater: (current: ProcessedPaperPackage) => ProcessedPaperPackage) => {
      setPkg((current) => {
        if (!current) return current;
        return normalizeProcessedPaper(applySubjectMapping(updater(current)));
      });
    },
    [],
  );

  const updateSubjectRange = useCallback(
    (index: number, updater: (range: SubjectRangeMapping) => SubjectRangeMapping) => {
      setSubjectMapping((current) => {
        const ranges = current.ranges ?? defaultSubjectMapping(questionCountForSubjects, "full").ranges ?? [];
        return {
          ...current,
          layout: "full",
          mode: "multi",
          ranges: ranges.map((range, i) => (i === index ? updater(range) : range)),
        };
      });
    },
    [questionCountForSubjects],
  );

  const addSubjectRange = useCallback(() => {
    setSubjectMapping((current) => {
      const ranges = current.ranges ?? defaultSubjectMapping(questionCountForSubjects, "full").ranges ?? [];
      const lastEnd = ranges.reduce((max, range) => Math.max(max, range.end), 0);
      const start = Math.min(questionCountForSubjects, lastEnd + 1);
      return {
        ...current,
        layout: "full",
        mode: "multi",
        ranges: [
          ...ranges,
          {
            subject: "Physics",
            start,
            end: start,
          },
        ],
      };
    });
  }, [questionCountForSubjects]);

  const removeSubjectRange = useCallback((index: number) => {
    setSubjectMapping((current) => {
      const ranges = current.ranges ?? [];
      return {
        ...current,
        layout: "full",
        mode: "multi",
        ranges: ranges.filter((_, i) => i !== index),
      };
    });
  }, []);

  const reviewQuestionLocations = useMemo(() => {
    const locations = new Map<string, { sectionIndex: number; questionIndex: number }>();
    if (!pkg || !previewBundle) return locations;
    let n = 0;
    pkg.sections.forEach((section, sectionIndex) => {
      section.questions.forEach((_, questionIndex) => {
        n += 1;
        locations.set(`${previewBundle.test.id}-question-${n}`, { sectionIndex, questionIndex });
      });
    });
    return locations;
  }, [pkg, previewBundle]);

  const questionIssues = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    if (!previewBundle || !pkg) return grouped;
    for (const issue of pkg.validationIssues) {
      if (!issue.questionId) continue;
      const list = grouped[issue.questionId] ?? [];
      list.push(issue.message);
      grouped[issue.questionId] = list;
    }
    let n = 0;
    for (const section of pkg.sections) {
      for (const question of section.questions) {
        n += 1;
        const reviewId = `${previewBundle.test.id}-question-${n}`;
        grouped[reviewId] = grouped[question.questionId] ?? [];
      }
    }
    return grouped;
  }, [pkg, previewBundle]);

  const errorCount = useMemo(
    () => pkg?.validationIssues.filter((issue) => issue.level === "error").length ?? 0,
    [pkg],
  );

  const answerKeyNotice = useMemo(() => {
    if (!pkg) return "";
    const unmatched = pkg.parsingDiagnostics.unmatchedAnswers;
    if (unmatched.length === 0) return "";
    const nums = unmatched.map((row) => row.questionNumber).join(", ");
    return `${unmatched.length} answer(s) could not be matched to a question (Q${nums}). Set the correct answer on those questions below.`;
  }, [pkg]);

  const updateQuestion = useCallback(
    (sectionIndex: number, questionIndex: number, updater: (q: PreparedQuestionMeta) => PreparedQuestionMeta) => {
      applyPackageUpdate((current) => ({
        ...current,
        sections: current.sections.map((section, si) =>
          si !== sectionIndex
            ? section
            : {
                ...section,
                questions: section.questions.map((q, qi) => (qi === questionIndex ? updater(q) : q)),
              },
        ),
      }));
    },
    [applyPackageUpdate],
  );

  const updateReviewQuestion = useCallback(
    (reviewQuestionId: string, updater: (q: PreparedQuestionMeta) => PreparedQuestionMeta) => {
      const loc = reviewQuestionLocations.get(reviewQuestionId);
      if (!loc) return;
      updateQuestion(loc.sectionIndex, loc.questionIndex, updater);
    },
    [reviewQuestionLocations, updateQuestion],
  );

  const moveReviewQuestion = useCallback(
    (reviewQuestionId: string, delta: -1 | 1) => {
      const loc = reviewQuestionLocations.get(reviewQuestionId);
      if (!loc) return;
      applyPackageUpdate((current) => ({
        ...current,
        sections: current.sections.map((section, si) => {
          if (si !== loc.sectionIndex) return section;
          const rows = [...section.questions];
          const swap = loc.questionIndex + delta;
          if (swap < 0 || swap >= rows.length) return section;
          [rows[loc.questionIndex], rows[swap]] = [rows[swap], rows[loc.questionIndex]];
          return { ...section, questions: rows };
        }),
      }));
    },
    [applyPackageUpdate, reviewQuestionLocations],
  );

  const deleteReviewQuestion = useCallback(
    (reviewQuestionId: string) => {
      const loc = reviewQuestionLocations.get(reviewQuestionId);
      if (!loc) return;
      applyPackageUpdate((current) => ({
        ...current,
        sections: current.sections.map((section, si) =>
          si !== loc.sectionIndex
            ? section
            : { ...section, questions: section.questions.filter((_, qi) => qi !== loc.questionIndex) },
        ),
      }));
    },
    [applyPackageUpdate, reviewQuestionLocations],
  );

  const buildAndOpenReview = async () => {
    if (!paperFile || !instituteId) {
      setPublishError("Upload a question paper to continue.");
      return;
    }
    if (!title.trim()) {
      setPublishError("Enter a test name.");
      return;
    }
    if (!scheduleStart) {
      setPublishError("Set the scheduled date and time.");
      return;
    }
    if (rangeValidation.message) {
      setPublishError(rangeValidation.message);
      return;
    }
    setPublishError("");
    setProcessing(true);
    setStep("processing");

    try {
      validateUploadFile({
        name: paperFile.name,
        size: paperFile.size,
        allowedTypes: PAPER_FILE_TYPES,
        maxBytes: MAX_PAPER_UPLOAD_BYTES,
      });
      if (keyFile) {
        validateUploadFile({
          name: keyFile.name,
          size: keyFile.size,
          allowedTypes: ANSWER_KEY_FILE_TYPES,
          maxBytes: MAX_ANSWER_KEY_UPLOAD_BYTES,
        });
      }

      const paperType = detectFileType(paperFile.name, PAPER_FILE_TYPES) as SupportedPaperFileType;
      const keyType = keyFile
        ? (detectFileType(keyFile.name, ANSWER_KEY_FILE_TYPES) as SupportedPaperFileType)
        : undefined;
      const tenantId = useWorkspaceAuthStore.getState().session?.instituteId;
      if (!tenantId) {
        setPublishError("Session not loaded. Refresh and try again.");
        return;
      }

      // ONE DETERMINISTIC INGESTION PATH
      // Do not run legacy regex processing.
      if (paperType !== "pdf") {
        throw new Error("Only PDF files are supported by the new deterministic pipeline.");
      }

      // We read the answer key just for the manual answers, but no legacy text parsing for PDF!
      const answerKeyText = keyFile ? await keyFile.text() : "";

      const { parsedPaper } = await parseWithGemini(paperFile, answerKeyText, tenantId);
      
      const rawPkg = cropsMetaToProcessedPackage(parsedPaper, paperFile.name, paperType, tenantId, answerKeyText);
      const configured = configureProcessedPackage(
        rawPkg,
        title.trim(),
        duration,
        marksPerQuestion,
        negativeMarks,
        subjectMapping,
      );

      setPkg(configured);
      setStep("review");
    } catch (error) {
      setStep("setup");
      setPublishError(error instanceof Error ? error.message : "Could not read the paper. Try again or paste text.");
      logSecurityEvent("paper_processing_blocked", { instituteId, message: String(error) });
    } finally {
      setProcessing(false);
    }
  };

  const publishTest = async () => {
    if (!pkg || !instituteId) return;
    if (publishInFlightRef.current) return;
    if (publishedTestId) {
      setStep("done");
      return;
    }

    publishInFlightRef.current = true;
    setPublishing(true);
    setPublishError("");

    try {
    const finalPkg = normalizeProcessedPaper({
      ...pkg,
      title: title.trim(),
      durationMinutes: Math.max(1, parseInt(duration, 10) || 60),
      totalMarks: pkg.totalMarks,
    });
    const errors = validateProcessedPaper(finalPkg).filter((issue) => issue.level === "error");
    if (errors.length > 0) {
      setPkg(finalPkg);
      setPublishError("Fix the highlighted items under each question, then publish again.");
      publishInFlightRef.current = false;
      setPublishing(false);
      return;
    }

    const testId = publishTestIdRef.current ?? `${makeCbtId("cbt")}-${pkg.id}`;
    publishTestIdRef.current = testId;
    const { test, bankQuestions } = buildCbtTestFromProcessedPaper(
      finalPkg,
      testId,
      selectedBatchIds,
      createdBy,
      examType,
    );

    const bank = getQuestionBank();
    const merged = [...bank];
    for (const row of bankQuestions) {
      if (!merged.some((q) => q.id === row.id)) merged.push(row);
    }
    saveQuestionBank(merged);

    const repos = getRepositories();
    const startMs = scheduleStart ? new Date(scheduleStart).getTime() : 0;
    const endAt = scheduleEnd ? new Date(scheduleEnd).toISOString() : (scheduleStart ? new Date(startMs + test.durationMinutes * 60 * 1000).toISOString() : undefined);
    const examDef = cbtTestToExamDefinition(test, undefined, endAt);
    if (examDef) repos.exams.save(examDef);

    if (selectedBatchIds.length > 0 && scheduleStart) {
      const startMs = new Date(scheduleStart).getTime();
      const endAt = scheduleEnd
        ? new Date(scheduleEnd).toISOString()
        : new Date(startMs + test.durationMinutes * 60 * 1000).toISOString();
      repos.schedules.save({
        ...createScheduleInput({
          examId: test.id,
          batchIds: selectedBatchIds,
          startAt: new Date(scheduleStart).toISOString(),
          endAt,
          durationMinutes: test.durationMinutes,
          visibilityRule: "assigned_batches",
        }),
        instituteId,
      });
    }

    await awaitRepositoryPersist();

    // Call the authoritative /publish API directly
    const res = await fetch(`/api/institute/${instituteId}/tests/${testId}/publish`, {
      method: "POST",
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`Publish failed: ${errorData.error || res.statusText}`);
    }

    logUploadEvent("paper_processing_published", { instituteId, testId, totalQuestions: finalPkg.totalQuestions });
    setPublishedTestId(testId);
    setPublishedTitle(finalPkg.title);
    setStep("done");
    setPublishError("");
    } catch (error) {
      publishTestIdRef.current = null;
      setPublishError(error instanceof Error ? error.message : "Publish failed. Please try again.");
    } finally {
      publishInFlightRef.current = false;
      setPublishing(false);
    }
  };

  const resetFlow = () => {
    setStep("setup");
    setPkg(null);
    setPaperFile(null);
    setKeyFile(null);
    setPublishError("");
    setPublishedTestId(null);
    publishTestIdRef.current = null;
  };

  return (
    <div className="space-y-5">
      <WizardStepper step={step} />
      <div className="hidden flex-wrap gap-2 text-sm">
        {(["setup", "review", "done"] as FlowStep[]).map((id, index) => (
          <button
            key={id}
            type="button"
            disabled={id === "review" && !pkg}
            onClick={() => {
              if (id === "setup") setStep("setup");
              if (id === "review" && pkg) setStep("review");
            }}
            className={
              step === id
                ? "rounded-lg bg-[#14213d] px-4 py-2 font-medium text-white"
                : "rounded-lg border border-[#ece6da] bg-white px-4 py-2 text-[#5e5a52] enabled:hover:border-[#8a6f3e] disabled:opacity-40"
            }
          >
            {index + 1}. {id === "setup" ? "Configure & Upload" : id === "review" ? "Preview & Edit" : "Done"}
          </button>
        ))}
      </div>

      {step === "setup" && (
        <Card className="border-[#d8d2c7]">
          <CardHeader>
            <CardTitle className="text-xl text-[#14213d]">Configure & Upload CBT</CardTitle>
            <CardDescription>Set the test details, configure subjects, and upload the files to process.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Metadata Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#14213d]">1. Test Details</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1.5 md:col-span-2">
                  <Label>Test Title *</Label>
                  <Input value={title} required onChange={(e) => setTitle(e.target.value)} placeholder="JEE Main Mock 1" />
                </label>
                <label className="space-y-1.5">
                  <Label>Exam Type</Label>
                  <select
                    className="h-10 w-full rounded-md border border-[#d7dde7] bg-white px-3 text-sm"
                    value={examType}
                    onChange={(e) => setExamType(e.target.value as ExamDefinition["examType"])}
                  >
                    <option value="JEE_MAIN">JEE_MAIN</option>
                    <option value="NEET">NEET</option>
                    <option value="CET">CET</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <Label>Duration (minutes)</Label>
                  <Input type="text" inputMode="numeric" pattern="[0-9]*" value={duration} onChange={(e) => setDuration(e.target.value)} />
                </label>
                <label className="space-y-1.5">
                  <Label>Marks per question</Label>
                  <Input type="text" inputMode="numeric" pattern="[0-9]*" value={marksPerQuestion} onChange={(e) => setMarksPerQuestion(e.target.value)} />
                </label>
                <label className="space-y-1.5">
                  <Label>Negative marks</Label>
                  <Input type="text" inputMode="decimal" value={negativeMarks} onChange={(e) => setNegativeMarks(e.target.value)} />
                </label>
                <label className="space-y-1.5 md:col-span-1">
                  <Label>Available from *</Label>
                  <Input type="datetime-local" required value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} />
                </label>
                <label className="space-y-1.5 md:col-span-1">
                  <Label>Available until</Label>
                  <Input type="datetime-local" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} />
                </label>
              </div>

              <div className="space-y-2">
                <Label>Assign to Batches</Label>
                <div className="flex flex-wrap gap-2">
                  {batches.map((batch) => (
                    <label
                      key={batch.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#ece6da] px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBatchIds.includes(batch.id)}
                        onChange={() =>
                          setSelectedBatchIds((current) =>
                            current.includes(batch.id)
                              ? current.filter((id) => id !== batch.id)
                              : [...current, batch.id],
                          )
                        }
                      />
                      {batch.name}
                    </label>
                  ))}
                  {batches.length === 0 && (
                    <p className="text-sm text-[#5e5a52]">No batches yet. You can assign later.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Subjects Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#14213d]">2. Subject Mapping</h3>
              <div className="space-y-4">
                <label className="space-y-1.5 block max-w-[200px]">
                  <Label>Expected questions</Label>
                  <Input
                    type="number"
                    min={1}
                    value={plannedQuestions}
                    onChange={(e) => setPlannedQuestions(e.target.value)}
                  />
                  <p className="text-xs text-[#5e5a52]">Used for subject ranges before parsing.</p>
                </label>
                <SubjectRangeTable
                  ranges={subjectRanges}
                  totalQuestions={questionCountForSubjects}
                  validationMessage={rangeValidation.message}
                  mappedCount={rangeValidation.mappedCount}
                  onAdd={addSubjectRange}
                  onRemove={removeSubjectRange}
                  onUpdate={updateSubjectRange}
                />
              </div>
            </div>

            {/* Upload Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#14213d]">3. Upload Files</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <UploadCard
                  title="Question Paper"
                  required
                  accept={ACCEPT_PAPER}
                  formats="PDF, DOC, DOCX, TXT, CSV, XLSX"
                  limit="Max 10 MB"
                  file={paperFile}
                  onChange={setPaperFile}
                />
                <UploadCard
                  title="Answer Key"
                  accept={ACCEPT_KEY}
                  formats="PDF, DOC, DOCX, TXT, CSV, XLSX"
                  limit="Max 2 MB"
                  file={keyFile}
                  onChange={setKeyFile}
                />
              </div>
            </div>

            {publishError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{publishError}</p>
            ) : null}

            <div className="flex justify-end pt-4 border-t border-[#ece6da]">
              <Button
                className="bg-[#14213d] px-8 py-6 text-lg"
                disabled={processing || !paperFile || Boolean(rangeValidation.message) || !title.trim() || !scheduleStart}
                onClick={() => void buildAndOpenReview()}
              >
                {processing ? "Processing Paper..." : "Process Paper & Continue"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "processing" && (
        <Card className="border-[#d8d2c7]">
          <CardContent className="py-10 text-center">
            <p className="text-lg font-semibold text-[#14213d]">Processing paper...</p>
            <p className="mt-1 text-sm text-[#5e5a52]">{progressText}</p>
          </CardContent>
        </Card>
      )}

      {step === "review" && pkg && previewBundle && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-[#14213d]">{title}</h2>
              <p className="text-sm text-[#5e5a52]">
                {pkg.totalQuestions} questions · {pkg.totalMarks} marks · {errorCount > 0 ? `${errorCount} need attention` : "Ready to publish"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setStep("setup")}>
              Back to setup
            </Button>
          </div>

          {answerKeyNotice ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {answerKeyNotice}
            </p>
          ) : null}

          <div className="h-[min(720px,calc(100dvh-10rem))] min-h-[520px] overflow-hidden rounded-lg border border-[#d8d2c7] shadow-sm">
            <ExamInterface
              examId={previewBundle.exam.id}
              review={{
                exam: previewBundle.exam,
                status: pkg.status,
                flaggedQuestionIds: [],
                questionIssues,
                onQuestionTextChange: (id, value) =>
                  updateReviewQuestion(id, (q) => ({ ...q, questionText: value })),
                onOptionTextChange: (id, label, value) =>
                  updateReviewQuestion(id, (q) => {
                    const i = Math.max(0, label.charCodeAt(0) - 65);
                    const next = [...q.optionLabels];
                    while (next.length < 4) next.push("");
                    next[i] = value;
                    return { ...q, optionLabels: next };
                  }),
                onCorrectAnswerChange: (id, value) =>
                  updateReviewQuestion(id, (q) => ({
                    ...q,
                    correctAnswer: value.trim().toUpperCase(),
                  })),
                onMarksChange: (id, value) =>
                  updateReviewQuestion(id, (q) => ({ ...q, marks: safeNumber(value, q.marks) })),
                onNegativeMarksChange: (id, value) =>
                  updateReviewQuestion(id, (q) => ({ ...q, negativeMarks: safeNumber(value, q.negativeMarks) })),
                onQuestionTypeChange: (id, value) => updateReviewQuestion(id, (q) => ({ ...q, questionType: value, optionLabels: value === 'NUMERICAL' ? [] : ['','','',''] })),
                onToggleFlag: () => undefined,
                onMoveQuestion: moveReviewQuestion,
                onDeleteQuestion: deleteReviewQuestion,
                onAddQuestion: (sectionId) => {
                  applyPackageUpdate((current) => {
                    const sectionIndex = current.sections.findIndex((s) => s.id === sectionId);
                    if (sectionIndex === -1) return current;
                    return {
                      ...current,
                      sections: current.sections.map((section, si) => {
                        if (si !== sectionIndex) return section;
                        const seq = section.questions.length + 1;
                        return {
                          ...section,
                          questions: [
                            ...section.questions,
                            {
                              questionId: `manual-q-${Date.now()}-${seq}`,
                              sequence: seq,
                              subject: section.name,
                              section: section.name,
                              confidence: 1,
                              questionType: "MCQ_SINGLE",
                              questionText: "New Question",
                              correctAnswer: "A",
                              marks: safeNumber(marksPerQuestion, 4),
                              negativeMarks: safeNumber(negativeMarks, 1),
                              optionLabels: ["", "", "", ""],
                              images: [],
                              metadata: {
                                parser: "manual",
                                sourceQuestionNumber: seq,
                                answerKeySource: "manual",
                              },
                            } as PreparedQuestionMeta,
                          ],
                        };
                      }),
                    };
                  });
                },
                onContinue: () => void publishTest(),
                continueDisabled: publishing,
                continueLabel: publishing ? "Publishing..." : "Publish CBT",
              }}
            />
          </div>

          {publishError ? (
            <p className="text-sm text-red-700">{publishError}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setStep("setup")}>
              Back
            </Button>
            <p className="text-sm text-[#5e5a52]">
              Use the Publish CBT button in the preview toolbar after final review.
            </p>
          </div>
        </div>
      )}

      {step === "done" && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="space-y-4 py-10 text-center">
            <p className="text-2xl font-semibold text-emerald-950">CBT published</p>
            <p className="text-emerald-800">
              <span className="font-medium">{publishedTitle}</span> is live for your institute.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {publishedTestId && (
                <Link
                  href={`/institute/tests/${publishedTestId}`}
                  className="inline-flex h-10 items-center rounded-lg bg-[#14213d] px-5 text-sm font-medium text-white"
                >
                  View test
                </Link>
              )}
              <Button variant="outline" className="bg-white" onClick={resetFlow}>
                Conduct another CBT
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WizardStepper({ step }: { step: FlowStep }) {
  const items: { id: FlowStep; label: string; rank: number }[] = [
    { id: "setup", label: "Configure & Upload", rank: 0 },
    { id: "processing", label: "Processing", rank: 1 },
    { id: "review", label: "Preview & Edit", rank: 2 },
    { id: "done", label: "Publish", rank: 3 },
  ];
  const currentRank = items.find((item) => item.id === step)?.rank ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#ece6da] bg-white px-4 py-3 text-sm">
      {items.map((item, index) => {
        const isComplete = item.rank < currentRank;
        const isCurrent = item.rank === currentRank;
        return (
          <div key={item.id} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold",
                isComplete
                  ? "border-green-500 bg-green-50 text-green-700"
                  : isCurrent
                    ? "border-[#1a3c6e] bg-blue-50 text-[#1a3c6e]"
                    : "border-gray-300 bg-gray-50 text-gray-500",
              )}
            >
              {isComplete ? "✓" : index + 1}
            </span>
            <span
              className={cn(
                isComplete && "font-medium text-green-700",
                isCurrent && "font-bold text-[#1a3c6e]",
                !isComplete && !isCurrent && "text-gray-500",
              )}
            >
              {item.label}
            </span>
            {index < items.length - 1 && <span className="text-gray-300">→</span>}
          </div>
        );
      })}
    </div>
  );
}

function UploadCard({
  title,
  required,
  accept,
  formats,
  limit,
  file,
  onChange,
}: {
  title: string;
  required?: boolean;
  accept: string;
  formats: string;
  limit: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block rounded-lg border border-[#ece6da] bg-[#fbf9f4] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-[#14213d]">
            {title} {required ? <span className="text-red-600">*</span> : null}
          </p>
          <p className="text-xs text-[#5e5a52]">{required ? "Required" : "Optional"}</p>
        </div>
        {file ? (
          <button
            type="button"
            className="rounded-full border border-[#d8d2c7] bg-white p-1 text-[#5e5a52]"
            onClick={(event) => {
              event.preventDefault();
              onChange(null);
            }}
            aria-label={`Remove ${title}`}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#c9bfae] bg-white px-4 py-6 text-center transition-colors hover:border-[#8a6f3e]">
        <Upload className="mb-3 h-8 w-8 text-[#8a6f3e]" />
        <p className="text-sm font-medium text-[#14213d]">{file?.name ?? "Choose a file"}</p>
        <p className="mt-1 text-xs text-[#5e5a52]">{formats}</p>
        <p className="text-xs text-[#5e5a52]">{limit}</p>
        <Input
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
      </div>
    </label>
  );
}

function SubjectRangeTable({
  ranges,
  totalQuestions,
  validationMessage,
  mappedCount,
  onAdd,
  onRemove,
  onUpdate,
}: {
  ranges: SubjectRangeMapping[];
  totalQuestions: number;
  validationMessage: string;
  mappedCount: number;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, updater: (range: SubjectRangeMapping) => SubjectRangeMapping) => void;
}) {
  const [draftRanges, setDraftRanges] = useState(() =>
    ranges.map((range) => ({
      subject: range.subject,
      start: String(range.start),
      end: String(range.end),
    })),
  );
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    setDraftRanges(
      ranges.map((range) => ({
        subject: range.subject,
        start: String(range.start),
        end: String(range.end),
      })),
    );
  }, [ranges]);

  const commitRange = (index: number, changedField: "start" | "end") => {
    const draft = draftRanges[index];
    if (!draft) return;

    const start = Math.max(1, parseInt(draft.start, 10) || 1);
    let end = Math.max(1, parseInt(draft.end, 10) || start);
    let error = "";

    if (changedField === "start" && start > end) {
      end = start;
    }
    if (end > totalQuestions) {
      end = totalQuestions;
      error = `Range exceeds total detected questions (max: ${totalQuestions}).`;
    }

    setDraftRanges((current) =>
      current.map((range, i) =>
        i === index ? { ...range, start: String(start), end: String(end) } : range,
      ),
    );
    setRowErrors((current) => ({ ...current, [index]: error }));
    onUpdate(index, (current) => ({ ...current, start, end }));
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-[#ece6da]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[#f8fafc] text-xs uppercase tracking-wide text-[#5e5a52]">
            <tr>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">From Q#</th>
              <th className="px-3 py-2">To Q#</th>
              <th className="px-3 py-2">Count</th>
              <th className="px-3 py-2">Remove</th>
            </tr>
          </thead>
          <tbody>
            {draftRanges.map((range, index) => {
              const start = parseInt(range.start, 10) || 0;
              const end = parseInt(range.end, 10) || 0;
              return (
              <Fragment key={`${range.subject}-${index}`}>
              <tr className="border-t border-[#ece6da]">
                <td className="px-3 py-2">
                  <select
                    className="h-9 w-full rounded-md border border-[#d7dde7] bg-white px-2 text-sm"
                    value={SUBJECT_OPTIONS.includes(range.subject as (typeof SUBJECT_OPTIONS)[number]) ? range.subject : "Custom"}
                    onChange={(event) => {
                      setDraftRanges((current) =>
                        current.map((row, i) => (i === index ? { ...row, subject: event.target.value } : row)),
                      );
                      onUpdate(index, (current) => ({
                        ...current,
                        subject: event.target.value,
                      }));
                    }}
                  >
                    {SUBJECT_OPTIONS.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={range.start}
                    onChange={(event) =>
                      setDraftRanges((current) =>
                        current.map((row, i) => (i === index ? { ...row, start: event.target.value } : row)),
                      )
                    }
                    onBlur={() => commitRange(index, "start")}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={range.end}
                    onChange={(event) =>
                      setDraftRanges((current) =>
                        current.map((row, i) => (i === index ? { ...row, end: event.target.value } : row)),
                      )
                    }
                    onBlur={() => commitRange(index, "end")}
                  />
                </td>
                <td className="px-3 py-2 text-gray-500">{Math.max(0, end - start + 1)}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700"
                    onClick={() => onRemove(index)}
                    aria-label={`Remove ${range.subject} range`}
                  >
                    ×
                  </button>
                </td>
              </tr>
              {rowErrors[index] ? (
                <tr className="border-t border-[#f3d4d4]">
                  <td colSpan={5} className="px-3 pb-2">
                    <p className="mt-1 text-xs text-red-600">{rowErrors[index]}</p>
                  </td>
                </tr>
              ) : null}
              </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" onClick={onAdd}>
        Add Row
      </Button>
      <p className="text-sm text-[#5e5a52]">
        Total questions mapped: {mappedCount} / {totalQuestions} detected
      </p>
      {validationMessage ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{validationMessage}</p>
      ) : null}
    </div>
  );
}

function validateSubjectRanges(ranges: SubjectRangeMapping[], totalQuestions: number) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const mappedCount = ranges.reduce((sum, range) => sum + Math.max(0, range.end - range.start + 1), 0);
  let previousEnd = 0;
  for (const range of sorted) {
    if (range.start < 1) {
      return { mappedCount, message: `${range.subject} must start from Q1 or later.` };
    }
    if (range.start > range.end) {
      return { mappedCount, message: `${range.subject} has an invalid range.` };
    }
    if (range.end > totalQuestions) {
      return { mappedCount, message: `Subject ranges cannot exceed Q${totalQuestions}.` };
    }
    if (range.start <= previousEnd) {
      return { mappedCount, message: "Subject ranges overlap. Adjust From Q# and To Q# values." };
    }
    previousEnd = range.end;
  }
  return { mappedCount, message: "" };
}

async function checkGeminiKeyConfigured(instituteId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/institute/${instituteId}/api-key/status`, {
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.hasKey);
  } catch {
    return false;
  }
}

async function parseWithGemini(
  file: File,
  answerKeyText: string,
  instituteId: string,
): Promise<{ parsedPaper: ParsedGeminiPaper; usedGemini: true }> {
  const formData = new FormData();
  formData.set("file", file);
  if (answerKeyText.trim()) {
    formData.set("answerKey", answerKeyText);
  }

  const res = await fetch(`/api/institute/${instituteId}/parse-paper-v2`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Parse failed" }));
    throw new Error(err.error ?? "Gemini parse failed");
  }

  const parsed = await res.json();
  return { parsedPaper: parsed, usedGemini: true };
}

function cropsMetaToProcessedPackage(
  parsed: any, // CropsMeta JSON
  paperFileName: string,
  paperFileType: string,
  instituteId: string,
  answerKeyText: string = "",
): ProcessedPaperPackage {
  const id = `paper-${Date.now()}`;
  const title = paperFileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Institute CBT Paper";
  const sectionMap = new Map<string, PreparedQuestionMeta[]>();

  // Parse answer key if provided
  let answerMap = new Map<number, string>();
  if (answerKeyText.trim()) {
    const { parseAnswerKeyForTest } = require("@/lib/cbt/paper-processing");
    const parsedAnswers = parseAnswerKeyForTest(answerKeyText);
    parsedAnswers.forEach((entry: any) => answerMap.set(entry.questionNumber, entry.answer));
  }

  let index = 0;
  for (const q of parsed.questions) {
    index++;
    const sectionName = "Imported Questions";
    if (!sectionMap.has(sectionName)) sectionMap.set(sectionName, []);

    const questionNumber = Number(q.q_num) || index;

      let rawAnswer = answerMap.get(questionNumber) || "";
      if (q.q_type !== "NAT" && /^[1-4]$/.test(rawAnswer)) {
        rawAnswer = String.fromCharCode(64 + parseInt(rawAnswer, 10)); // 1->A, 2->B, etc.
      }
      
      const isNat = q.q_type === "NAT";
      const finalAnswer = rawAnswer || (isNat ? "" : "A");

      sectionMap.get(sectionName)!.push({
        questionId: `${id}-q${questionNumber}`,
        sequence: questionNumber,
        section: sectionName,
        subject: sectionName,
        chapter: undefined,
        topic: undefined,
        difficulty: undefined,
        confidence: 1.0,
        questionType: isNat ? "NUMERICAL" : "MCQ_SINGLE",
        detectionSource: q.question_text ? "hybrid" : "vision_crop",
        questionText: q.question_text || "",
        stemImage: q.asset_path,
        hasEquation: false,
        hasImage: true,
        correctAnswer: finalAnswer,
      solution: undefined,
      marks: 4,
      negativeMarks: 1,
      optionLabels: q.options && q.options.length > 0 ? q.options : [],
      optionImages: [],
      images: [],
      explanation: undefined,
      metadata: {
        parser: "vision_crop",
        sourceQuestionNumber: questionNumber,
        answerKeySource: "manual",
      },
    } as any);
  }

  const sections = Array.from(sectionMap.entries()).map(([name, questions]) => ({
    id: `section-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    questions,
  }));
  const totalQuestions = parsed.questions.length;
  const totalMarks = totalQuestions * 4;
  const pkg: ProcessedPaperPackage = {
    id,
    status: "DRAFT_REVIEW",
    title,
    instituteId,
    paperFileName,
    paperFileType: paperFileType as SupportedPaperFileType,
    answerKeyFileName: undefined,
    answerKeyFileType: undefined,
    durationMinutes: 180,
    instructions: [
      "Read each question carefully before answering.",
      "Use the palette to review marked and unanswered questions.",
      "Submit before the timer ends.",
    ],
    sections,
    processingLog: [`Image crops generated: ${totalQuestions} questions extracted.`],
    validationIssues: [],
    extractionMode: "vision_crop",
    extractionSummary: {
      pages: 1,
      extractedChars: 0,
      usedOCR: false,
      questionsDetected: totalQuestions,
      warnings: [],
    },
    parsingDiagnostics: {
      rawTextPreview: "",
      parsedQuestionCount: totalQuestions,
      unmatchedAnswerCount: 0,
      unmatchedAnswers: [],
      duplicateAnswers: [],
    },
    preparedAt: Date.now(),
    totalMarks,
    totalQuestions,
    subjectMapping: defaultSubjectMapping(totalQuestions, "full"),
  };

  return {
    ...pkg,
    validationIssues: validateProcessedPaper(pkg),
  };
}



function safeNumber(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function configureProcessedPackage(
  result: ProcessedPaperPackage,
  title: string,
  duration: string,
  marksPerQuestion: string,
  negativeMarks: string,
  subjectMapping: PaperSubjectMapping,
): ProcessedPaperPackage {
  const perQMarks = safeNumber(marksPerQuestion, 4);
  const perQNeg = safeNumber(negativeMarks, 1);
  const totalQ = result.sections.reduce((n, s) => n + s.questions.length, 0);
  const mapping =
    subjectMapping.layout === "single"
      ? defaultSubjectMapping(totalQ, "single", subjectMapping.singleSubject ?? "Physics")
      : {
          ...subjectMapping,
          mode: "multi" as const,
          ranges: (subjectMapping.ranges ?? defaultSubjectMapping(totalQ, subjectMapping.layout).ranges ?? [])
                  .filter((range) => range.start <= totalQ)
                  .map(
            (range) => ({
              ...range,
              end: Math.min(range.end, totalQ),
            }),
          ),
        };

  return normalizeProcessedPaper(
    applySubjectMapping({
      ...result,
      title,
      durationMinutes: Math.max(1, parseInt(duration, 10) || 60),
      totalMarks: totalQ * perQMarks,
      sections: result.sections.map((section) => ({
        ...section,
        questions: section.questions.map((q) => ({
          ...q,
          marks: perQMarks,
          negativeMarks: q.questionType === "NUMERICAL" ? 0 : perQNeg,
        })),
      })),
      subjectMapping: mapping,
    }),
  );
}


