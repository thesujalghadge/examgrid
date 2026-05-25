"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ConductCbtSubjectPanel } from "@/components/institute/paper-subject-mapping";
import { buildCbtTestFromProcessedPaper } from "@/lib/cbt/build-test-from-processing";
import { applySubjectMapping, defaultSubjectMapping } from "@/lib/cbt/subject-mapping";
import { cbtTestToExamDefinition } from "@/lib/cbt/cbt-to-exam";
import {
  detectFileType,
  inferQuestionTypeFromMeta,
  MAX_ANSWER_KEY_UPLOAD_BYTES,
  MAX_PAPER_UPLOAD_BYTES,
  normalizeProcessedPaper,
  runPaperProcessing,
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
  SupportedPaperFileType,
} from "@/types/cbt-paper-processing";

type FlowStep = "configure" | "review" | "done";

const ACCEPT_PAPER = ".pdf,.doc,.docx,.csv,.xlsx,.txt";
const ACCEPT_KEY = ".csv,.xlsx,.txt,.doc,.docx";
const PAPER_FILE_TYPES = ["pdf", "doc", "docx", "csv", "xlsx", "txt"] as const;
const ANSWER_KEY_FILE_TYPES = ["csv", "xlsx", "txt", "doc", "docx"] as const;
const PLANNED_JEE_QUESTIONS = 90;

export function InstitutePaperUploadFlow() {
  const session = useWorkspaceAuthStore((state) => state.session);
  const hydrateSession = useWorkspaceAuthStore((state) => state.hydrateSession);
  const instituteId = session?.instituteId ?? "";
  const createdBy = session?.userId ?? "institute-admin";

  const [step, setStep] = useState<FlowStep>("configure");
  const [processing, setProcessing] = useState(false);
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [pkg, setPkg] = useState<ProcessedPaperPackage | null>(null);
  const [publishError, setPublishError] = useState("");

  const [title, setTitle] = useState("Weekly CBT");
  const [duration, setDuration] = useState("180");
  const [marksPerQuestion, setMarksPerQuestion] = useState("4");
  const [negativeMarks, setNegativeMarks] = useState("1");
  const [examType] = useState<ExamDefinition["examType"]>("JEE_MAIN");
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
    if (!scheduleStart || !scheduleEnd) {
      setPublishError("Set 'Available from' and 'Available until' dates.");
      return;
    }
    setPublishError("");
    setProcessing(true);

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

      const paperSource = await extractUploadText(paperFile, "paper", false);
      if (!paperSource) {
        throw new Error("Could not read the question paper.");
      }
      const keySource = keyFile ? await extractUploadText(keyFile, "answer_key", true) : null;
      const paperType = detectFileType(paperFile.name, PAPER_FILE_TYPES) as SupportedPaperFileType;
      const keyType = keyFile
        ? (detectFileType(keyFile.name, ANSWER_KEY_FILE_TYPES) as SupportedPaperFileType)
        : undefined;

      const result = await runPaperProcessing({
        instituteId,
        paperFileName: paperFile.name,
        paperFileType: paperType,
        paperText: paperSource.text,
        answerKeyFileName: keyFile?.name,
        answerKeyFileType: keyType,
        answerKeyText: keySource?.text,
        extractionMode: keySource ? "file" : "file",
        extractionSummary: paperSource.summary,
      });

      const perQMarks = safeNumber(marksPerQuestion, 4);
      const perQNeg = safeNumber(negativeMarks, 1);
      const totalQ = result.sections.reduce((n, s) => n + s.questions.length, 0);
      const mapping =
        subjectMapping.layout === "single"
          ? defaultSubjectMapping(totalQ, "single", subjectMapping.singleSubject ?? "Physics")
          : {
              ...subjectMapping,
              mode: "multi" as const,
              ranges: (subjectMapping.ranges ?? defaultSubjectMapping(totalQ, subjectMapping.layout).ranges ?? []).map(
                (range) => ({
                  ...range,
                  end: Math.min(range.end, totalQ),
                }),
              ),
            };

      const configured = normalizeProcessedPaper(
        applySubjectMapping({
          ...result,
          title: title.trim(),
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

      setPkg(configured);
      setStep("review");
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Could not read the paper. Try again or paste text.");
      logSecurityEvent("paper_processing_blocked", { instituteId, message: String(error) });
    } finally {
      setProcessing(false);
    }
  };

  const publishTest = async () => {
    if (!pkg || !instituteId) return;
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
      return;
    }

    const testId = makeCbtId("cbt");
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
    repos.cbtTests.save(test);
    const examDef = cbtTestToExamDefinition(test);
    if (examDef) repos.exams.save(examDef);

    if (selectedBatchIds.length > 0 && scheduleStart && scheduleEnd) {
      repos.schedules.save({
        ...createScheduleInput({
          examId: test.id,
          batchIds: selectedBatchIds,
          startAt: new Date(scheduleStart).toISOString(),
          endAt: new Date(scheduleEnd).toISOString(),
          durationMinutes: test.durationMinutes,
          visibilityRule: "assigned_batches",
        }),
        instituteId,
      });
    }

    await awaitRepositoryPersist();
    logUploadEvent("paper_processing_published", { instituteId, testId, totalQuestions: finalPkg.totalQuestions });
    setPublishedTestId(testId);
    setPublishedTitle(finalPkg.title);
    setStep("done");
    setPublishError("");
  };

  const resetFlow = () => {
    setStep("configure");
    setPkg(null);
    setPaperFile(null);
    setKeyFile(null);
    setPublishError("");
    setPublishedTestId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 text-sm">
        {(["configure", "review", "done"] as FlowStep[]).map((id, index) => (
          <button
            key={id}
            type="button"
            disabled={id === "review" && !pkg}
            onClick={() => {
              if (id === "configure") setStep("configure");
              if (id === "review" && pkg) setStep("review");
            }}
            className={
              step === id
                ? "rounded-lg bg-[#14213d] px-4 py-2 font-medium text-white"
                : "rounded-lg border border-[#ece6da] bg-white px-4 py-2 text-[#5e5a52] enabled:hover:border-[#8a6f3e] disabled:opacity-40"
            }
          >
            {index + 1}. {id === "configure" ? "Configure" : id === "review" ? "Preview & Edit" : "Done"}
          </button>
        ))}
      </div>

      {step === "configure" && (
        <Card className="border-[#d8d2c7]">
          <CardHeader>
            <CardTitle className="text-xl text-[#14213d]">Conduct CBT</CardTitle>
            <CardDescription>
              Set up the test, upload your paper and answer key, then continue to preview.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1.5 md:col-span-2">
                <Label>Test name</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="JEE Main Mock 1" />
              </label>
              <label className="space-y-1.5">
                <Label>Duration (minutes)</Label>
                <Input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
              </label>
              <label className="space-y-1.5">
                <Label>Marks per question</Label>
                <Input type="number" min={0} value={marksPerQuestion} onChange={(e) => setMarksPerQuestion(e.target.value)} />
              </label>
              <label className="space-y-1.5">
                <Label>Negative marks</Label>
                <Input type="number" min={0} step={0.25} value={negativeMarks} onChange={(e) => setNegativeMarks(e.target.value)} />
              </label>
              <label className="space-y-1.5">
                <Label>Available from</Label>
                <Input type="datetime-local" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} />
              </label>
              <label className="space-y-1.5">
                <Label>Available until</Label>
                <Input type="datetime-local" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} />
              </label>
            </div>

            <div className="space-y-2">
              <Label>Batches</Label>
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
                  <p className="text-sm text-[#5e5a52]">No batches yet — you can assign later.</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 rounded-lg border border-[#ece6da] bg-[#fbf9f4] p-4">
                <Label>Question paper</Label>
                <Input type="file" accept={ACCEPT_PAPER} onChange={(e) => setPaperFile(e.target.files?.[0] ?? null)} />
                <p className="text-xs text-[#5e5a52]">{paperFile?.name ?? "PDF, DOC, DOCX, CSV, XLSX, TXT"}</p>
              </label>
              <label className="space-y-1.5 rounded-lg border border-[#ece6da] bg-[#fbf9f4] p-4">
                <Label>Answer key</Label>
                <Input type="file" accept={ACCEPT_KEY} onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)} />
                <p className="text-xs text-[#5e5a52]">{keyFile?.name ?? "Optional — 1-A, 1. B, 1 A, tables"}</p>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
              <label className="space-y-1.5">
                <Label>Expected questions</Label>
                <Input
                  type="number"
                  min={1}
                  value={plannedQuestions}
                  onChange={(e) => setPlannedQuestions(e.target.value)}
                />
                <p className="text-xs text-[#5e5a52]">Used for subject ranges before parsing.</p>
              </label>
              <ConductCbtSubjectPanel
                questionCount={questionCountForSubjects}
                mapping={subjectMapping}
                onChange={setSubjectMapping}
              />
            </div>

            {publishError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{publishError}</p>
            ) : null}

            <Button
              className="bg-[#14213d] px-6"
              disabled={processing || !paperFile}
              onClick={() => void buildAndOpenReview()}
            >
              {processing ? "Preparing preview…" : "Continue to preview"}
            </Button>
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
            <Button variant="outline" size="sm" onClick={() => setStep("configure")}>
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
                  updateReviewQuestion(id, (q) => {
                    const next = { ...q, correctAnswer: value.trim().toUpperCase() };
                    const questionType = inferQuestionTypeFromMeta(next);
                    return {
                      ...next,
                      questionType,
                      optionLabels: questionType === "NUMERICAL" ? [] : (next.optionLabels.length < 4 ? ["", "", "", ""] : next.optionLabels),
                      negativeMarks: questionType === "NUMERICAL" ? 0 : next.negativeMarks,
                    };
                  }),
                onMarksChange: (id, value) =>
                  updateReviewQuestion(id, (q) => ({ ...q, marks: safeNumber(value, q.marks) })),
                onNegativeMarksChange: (id, value) =>
                  updateReviewQuestion(id, (q) => ({ ...q, negativeMarks: safeNumber(value, q.negativeMarks) })),
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
              }}
            />
          </div>

          {publishError ? (
            <p className="text-sm text-red-700">{publishError}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep("configure")}>
              Back
            </Button>
            <Button className="bg-[#8a6f3e] px-6" onClick={() => void publishTest()}>
              Publish CBT
            </Button>
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

async function extractUploadText(
  file: File,
  kind: "paper" | "answer_key",
  optional = false,
): Promise<{ text: string; summary: Omit<import("@/types/cbt-paper-processing").PaperExtractionSummary, "questionsDetected"> } | null> {
  const fileType = detectFileType(
    file.name,
    kind === "paper" ? PAPER_FILE_TYPES : ANSWER_KEY_FILE_TYPES,
  ) as SupportedPaperFileType;
  const formData = new FormData();
  formData.set("kind", kind);
  formData.set("fileType", fileType);
  formData.set("file", file);

  const response = await fetch("/api/institute/paper-extract", { method: "POST", body: formData, credentials: "include" });
  if (!response.ok) {
    if (optional) return { text: "", summary: { pages: 1, extractedChars: 0, usedOCR: false, warnings: [] } };
    const plain = (await file.text()).trim();
    return {
      text: plain,
      summary: { pages: 1, extractedChars: plain.length, usedOCR: false, warnings: [] },
    };
  }
  return response.json();
}

function safeNumber(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
