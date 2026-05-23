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
import { buildCbtTestFromProcessedPaper } from "@/lib/cbt/build-test-from-processing";
import { cbtTestToExamDefinition } from "@/lib/cbt/cbt-to-exam";
import {
  detectFileType,
  isLikelyReadableText,
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
import {
  createScheduleInput,
  getScheduleStatus,
} from "@/services/institute-ops-service";
import { getQuestionBank, saveQuestionBank } from "@/services/question-bank-service";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import type { Batch } from "@/types/institute-ops";
import type { CBTTest } from "@/types/cbt";
import type {
  PaperProcessingStage,
  PreparedQuestionMeta,
  ProcessedPaperPackage,
  UploadExtractionMode,
} from "@/types/cbt-paper-processing";

type WizardStep =
  | "paper"
  | "answer_key"
  | "processing"
  | "preview"
  | "configure"
  | "done";

const ACCEPT_PAPER = ".pdf,.doc,.docx";
const ACCEPT_KEY = ".csv,.doc,.docx";
const PAPER_FILE_TYPES = ["pdf", "doc", "docx"] as const;
const ANSWER_KEY_FILE_TYPES = ["csv", "doc", "docx"] as const;

export function InstitutePaperUploadFlow() {
  const session = useWorkspaceAuthStore((s) => s.session);
  const hydrate = useWorkspaceAuthStore((s) => s.hydrate);
  const instituteId = session?.instituteId ?? "";
  const createdBy = session?.userId ?? "institute-admin";

  const [tests, setTests] = useState<CBTTest[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [step, setStep] = useState<WizardStep>("paper");
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [paperTextOverride, setPaperTextOverride] = useState("");
  const [answerKeyTextOverride, setAnswerKeyTextOverride] = useState("");
  const [pkg, setPkg] = useState<ProcessedPaperPackage | null>(null);
  const [processLog, setProcessLog] = useState<string[]>([]);
  const [duration, setDuration] = useState("60");
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [publishError, setPublishError] = useState("");
  const [processingError, setProcessingError] = useState("");

  const refresh = useCallback(() => {
    hydrate();
    setTests(
      getRepositories()
        .cbtTests.list()
        .filter((test) => !instituteId || test.instituteId === instituteId),
    );
    setBatches(
      getRepositories()
        .batches.list()
        .filter((batch) => !instituteId || batch.instituteId === instituteId),
    );
  }, [hydrate, instituteId]);

  useEffect(() => {
    refresh();
    const now = new Date();
    setScheduleStart(toLocalInput(new Date(now.getTime() - 15 * 60 * 1000)));
    setScheduleEnd(toLocalInput(new Date(now.getTime() + 3 * 60 * 60 * 1000)));
  }, [refresh]);

  useEffect(() => {
    if (batches.length > 0 && selectedBatchIds.length === 0) {
      setSelectedBatchIds(batches.map((batch) => batch.id));
    }
  }, [batches, selectedBatchIds.length]);

  const previewTest = useMemo(() => {
    if (!pkg) return null;
    const testId = `${pkg.id}-preview`;
    return buildCbtTestFromProcessedPaper(
      { ...pkg, durationMinutes: Math.max(1, parseInt(duration, 10) || 60) },
      testId,
      selectedBatchIds.length ? selectedBatchIds : batches.map((batch) => batch.id),
      createdBy,
    ).test;
  }, [pkg, duration, selectedBatchIds, batches, createdBy]);

  const blockingIssues = useMemo(
    () => pkg?.validationIssues.filter((issue) => issue.level === "error") ?? [],
    [pkg],
  );
  const warningIssues = useMemo(
    () => pkg?.validationIssues.filter((issue) => issue.level === "warning") ?? [],
    [pkg],
  );

  const applyPackageUpdate = useCallback((updater: (current: ProcessedPaperPackage) => ProcessedPaperPackage) => {
    setPkg((current) => {
      if (!current) return current;
      return normalizeProcessedPaper(updater(current));
    });
  }, []);

  const updateQuestion = useCallback(
    (
      sectionIndex: number,
      questionIndex: number,
      updater: (question: PreparedQuestionMeta) => PreparedQuestionMeta,
    ) => {
      applyPackageUpdate((current) => ({
        ...current,
        sections: current.sections.map((section, sIndex) =>
          sIndex !== sectionIndex
            ? section
            : {
                ...section,
                questions: section.questions.map((question, qIndex) =>
                  qIndex === questionIndex ? updater(question) : question,
                ),
              },
        ),
      }));
    },
    [applyPackageUpdate],
  );

  const renameSection = useCallback(
    (sectionIndex: number, name: string) => {
      applyPackageUpdate((current) => ({
        ...current,
        sections: current.sections.map((section, index) =>
          index === sectionIndex
            ? {
                ...section,
                name,
                questions: section.questions.map((question) => ({
                  ...question,
                  section: name,
                })),
              }
            : section,
        ),
      }));
    },
    [applyPackageUpdate],
  );

  const deleteQuestion = useCallback(
    (sectionIndex: number, questionIndex: number) => {
      applyPackageUpdate((current) => ({
        ...current,
        sections: current.sections.map((section, index) =>
          index === sectionIndex
            ? {
                ...section,
                questions: section.questions.filter((_, qIndex) => qIndex !== questionIndex),
              }
            : section,
        ),
      }));
    },
    [applyPackageUpdate],
  );

  const moveQuestion = useCallback(
    (sectionIndex: number, questionIndex: number, delta: -1 | 1) => {
      applyPackageUpdate((current) => ({
        ...current,
        sections: current.sections.map((section, index) => {
          if (index !== sectionIndex) return section;
          const nextQuestions = [...section.questions];
          const swapIndex = questionIndex + delta;
          if (swapIndex < 0 || swapIndex >= nextQuestions.length) return section;
          [nextQuestions[questionIndex], nextQuestions[swapIndex]] = [
            nextQuestions[swapIndex],
            nextQuestions[questionIndex],
          ];
          return { ...section, questions: nextQuestions };
        }),
      }));
    },
    [applyPackageUpdate],
  );

  const startProcessing = async () => {
    if (!paperFile || !instituteId) return;
    setPublishError("");
    setProcessingError("");
    setStep("processing");
    setProcessLog([]);

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

      const paperSource = await resolveUploadText({
        file: paperFile,
        manualText: paperTextOverride,
        label: "question paper",
      });
      const answerKeySource = keyFile
        ? await resolveUploadText({
            file: keyFile,
            manualText: answerKeyTextOverride,
            label: "answer key",
            optional: true,
          })
        : null;

      const paperType = detectFileType(paperFile.name, PAPER_FILE_TYPES) as "pdf" | "doc" | "docx";
      const keyType = keyFile
        ? (detectFileType(keyFile.name, ANSWER_KEY_FILE_TYPES) as "csv" | "doc" | "docx")
        : undefined;
      const extractionMode = mergeExtractionMode(
        paperSource.mode,
        answerKeySource?.mode ?? "file",
        Boolean(answerKeySource),
      );

      const result = await runPaperProcessing({
        instituteId,
        paperFileName: paperFile.name,
        paperFileType: paperType,
        paperText: paperSource.text,
        answerKeyFileName: keyFile?.name,
        answerKeyFileType: keyType,
        answerKeyText: answerKeySource?.text,
        extractionMode,
        onStage: (_stage: PaperProcessingStage, log) => setProcessLog(log),
      });

      setPkg(result);
      setDuration(String(result.durationMinutes));
      setStep("preview");
    } catch (error) {
      const message = getErrorMessage(error);
      setProcessingError(message);
      setStep("answer_key");
      logSecurityEvent("paper_processing_blocked", {
        instituteId,
        paperFileName: paperFile.name,
        message,
      });
    }
  };

  const publishTest = async () => {
    if (!pkg || !instituteId) {
      setPublishError("Complete upload and processing first.");
      return;
    }
    if (selectedBatchIds.length === 0) {
      setPublishError("Select at least one batch.");
      return;
    }
    if (blockingIssues.length > 0) {
      setPublishError("Resolve blocking parsing issues before publishing the CBT.");
      return;
    }

    const testId = makeCbtId("cbt");
    const finalPkg = normalizeProcessedPaper({
      ...pkg,
      durationMinutes: Math.max(1, parseInt(duration, 10) || 60),
    });
    const remainingIssues = validateProcessedPaper(finalPkg).filter((issue) => issue.level === "error");
    if (remainingIssues.length > 0) {
      setPkg(finalPkg);
      setPublishError("Review the preview again. The CBT still has unresolved answer or format errors.");
      return;
    }

    const { test, bankQuestions } = buildCbtTestFromProcessedPaper(
      finalPkg,
      testId,
      selectedBatchIds,
      createdBy,
    );

    const existingBank = getQuestionBank();
    const merged = [...existingBank];
    for (const question of bankQuestions) {
      if (!merged.some((row) => row.id === question.id)) merged.push(question);
    }
    saveQuestionBank(merged);

    const repos = getRepositories();
    repos.cbtTests.save(test);
    const examDefinition = cbtTestToExamDefinition(test);
    if (examDefinition) {
      repos.exams.save(examDefinition);
    }
    const schedule = {
      ...createScheduleInput({
        examId: test.id,
        batchIds: selectedBatchIds,
        startAt: new Date(scheduleStart).toISOString(),
        endAt: new Date(scheduleEnd).toISOString(),
        durationMinutes: test.durationMinutes,
        visibilityRule: "assigned_batches",
      }),
      instituteId,
    };
    repos.schedules.save(schedule);
    await awaitRepositoryPersist();
    logUploadEvent("paper_processing_published", {
      instituteId,
      testId,
      totalQuestions: finalPkg.totalQuestions,
      totalMarks: finalPkg.totalMarks,
    });
    refresh();
    setStep("done");
  };

  const stepIndex =
    step === "paper"
      ? 1
      : step === "answer_key"
        ? 2
        : step === "processing"
          ? 3
          : step === "preview"
            ? 4
            : step === "configure"
              ? 5
              : 6;

  return (
    <div className="space-y-6">
      <Card className="border-[#d8d2c7]">
        <CardHeader>
          <CardTitle className="text-base text-[#14213d]">Published tests</CardTitle>
          <CardDescription>Tests created from uploaded papers in this institute.</CardDescription>
        </CardHeader>
        <CardContent>
          {tests.length === 0 ? (
            <p className="text-sm text-[#5e5a52]">
              No tests yet. Upload a question paper below to conduct your first CBT.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border border-[#ece6da] bg-white text-sm">
              {tests.map((test) => {
                const schedule = getRepositories()
                  .schedules.list()
                  .find((row) => row.examId === test.id);
                const status = schedule ? getScheduleStatus(schedule) : "unscheduled";
                return (
                  <li
                    key={test.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-[#14213d]">{test.title}</p>
                      <p className="text-xs text-[#5e5a52]">
                        {test.durationMinutes} min · {test.questions.length} Q · {status}
                      </p>
                    </div>
                    <Link
                      href={`/institute/tests/${test.id}`}
                      className="text-sm font-medium text-[#8a6f3e] hover:underline"
                    >
                      Open
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 text-xs text-[#5e5a52]">
        {["Paper", "Answer key", "Processing", "Preview", "Configure", "Publish"].map(
          (label, index) => (
            <span
              key={label}
              className={
                index + 1 === stepIndex
                  ? "rounded-full bg-[#14213d] px-3 py-1 font-medium text-white"
                  : index + 1 < stepIndex
                    ? "rounded-full bg-[#e9f3ea] px-3 py-1 text-[#2f6a37]"
                    : "rounded-full border border-[#ece6da] px-3 py-1"
              }
            >
              {index + 1}. {label}
            </span>
          ),
        )}
      </div>

      {step === "paper" && (
        <Card className="border-[#8a6f3e]/40">
          <CardHeader>
            <CardTitle className="text-lg text-[#14213d]">Step 1 - Upload question paper</CardTitle>
            <CardDescription>
              PDF, DOC, or DOCX. For scanned or formatted documents, paste extracted text below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept={ACCEPT_PAPER}
              onChange={(event) => setPaperFile(event.target.files?.[0] ?? null)}
            />
            <div className="space-y-2">
              <Label>Extraction fallback text</Label>
              <textarea
                className="min-h-[160px] w-full rounded-md border border-[#ece6da] p-3 text-sm"
                placeholder="Paste numbered questions here when the uploaded file is scanned or heavily formatted. Example: 1. Question text..."
                value={paperTextOverride}
                onChange={(event) => setPaperTextOverride(event.target.value)}
              />
            </div>
            <Button
              className="bg-[#14213d]"
              disabled={!paperFile}
              onClick={() => setStep("answer_key")}
            >
              Continue to answer key
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "answer_key" && (
        <Card className="border-[#d8d2c7]">
          <CardHeader>
            <CardTitle className="text-lg text-[#14213d]">Step 2 - Upload answer key</CardTitle>
            <CardDescription>CSV, DOC, or DOCX. Optional, but required for scored publishing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept={ACCEPT_KEY}
              onChange={(event) => setKeyFile(event.target.files?.[0] ?? null)}
            />
            <div className="space-y-2">
              <Label>Answer key fallback text</Label>
              <textarea
                className="min-h-[120px] w-full rounded-md border border-[#ece6da] p-3 text-sm"
                placeholder="Example: 1 A, 2 C, 3 B"
                value={answerKeyTextOverride}
                onChange={(event) => setAnswerKeyTextOverride(event.target.value)}
              />
            </div>
            <p className="text-xs text-[#5e5a52]">
              Use one line per answer or a compact list. The preview will block publish until unresolved answers are fixed.
            </p>
            {processingError ? <p className="text-sm text-red-700">{processingError}</p> : null}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("paper")}>
                Back
              </Button>
              <Button className="bg-[#14213d]" onClick={() => void startProcessing()}>
                Start processing
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "processing" && (
        <Card className="border-[#d8d2c7]">
          <CardContent className="space-y-4 py-8">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#8a6f3e] border-t-transparent" />
            <p className="text-center font-medium text-[#14213d]">Processing paper...</p>
            <ul className="mx-auto max-w-2xl space-y-1 text-sm text-[#5e5a52]">
              {processLog.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {step === "preview" && pkg && previewTest && (
        <Card className="border-[#d8d2c7]">
          <CardHeader>
            <CardTitle className="text-lg text-[#14213d]">Step 4 - CBT preview and correction</CardTitle>
            <CardDescription>
              {pkg.paperFileName}
              {pkg.answerKeyFileName ? ` + ${pkg.answerKeyFileName}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <SummaryStat label="Sections" value={String(pkg.sections.length)} />
              <SummaryStat label="Questions" value={String(pkg.totalQuestions)} />
              <SummaryStat label="Marks" value={String(pkg.totalMarks)} />
              <SummaryStat label="Extraction" value={pkg.extractionMode} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <IssuePanel
                title="Blocking issues"
                tone="error"
                items={blockingIssues.map((issue) => issue.message)}
                emptyMessage="No blocking issues. The CBT is structurally publishable."
              />
              <IssuePanel
                title="Review warnings"
                tone="warning"
                items={warningIssues.map((issue) => issue.message)}
                emptyMessage="No subject or review warnings."
              />
            </div>

            <div className="space-y-4">
              {pkg.sections.map((section, sectionIndex) => (
                <Card key={section.id} className="border-[#ece6da]">
                  <CardHeader className="space-y-3">
                    <div className="space-y-2">
                      <Label>Section name</Label>
                      <Input
                        value={section.name}
                        onChange={(event) => renameSection(sectionIndex, event.target.value)}
                      />
                    </div>
                    <CardDescription>
                      {section.questions.length} question(s) in this section.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {section.questions.map((question, questionIndex) => (
                      <div key={question.questionId} className="rounded-xl border border-[#ece6da] p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-[#14213d]">Question {questionIndex + 1}</p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => moveQuestion(sectionIndex, questionIndex, -1)}
                              disabled={questionIndex === 0}
                            >
                              Move up
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => moveQuestion(sectionIndex, questionIndex, 1)}
                              disabled={questionIndex === section.questions.length - 1}
                            >
                              Move down
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => deleteQuestion(sectionIndex, questionIndex)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input
                              value={question.subject}
                              onChange={(event) =>
                                updateQuestion(sectionIndex, questionIndex, (current) => ({
                                  ...current,
                                  subject: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Correct answer</Label>
                            <Input
                              value={question.correctAnswer}
                              onChange={(event) =>
                                updateQuestion(sectionIndex, questionIndex, (current) => ({
                                  ...current,
                                  correctAnswer: event.target.value.toUpperCase(),
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="mt-3 space-y-2">
                          <Label>Question text</Label>
                          <textarea
                            className="min-h-[96px] w-full rounded-md border border-[#ece6da] p-3 text-sm"
                            value={question.questionText}
                            onChange={(event) =>
                              updateQuestion(sectionIndex, questionIndex, (current) => ({
                                ...current,
                                questionText: event.target.value,
                              }))
                            }
                          />
                        </div>

                        {question.questionType === "MCQ_SINGLE" ? (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {["A", "B", "C", "D"].map((label, optionIndex) => (
                              <div key={label} className="space-y-2">
                                <Label>Option {label}</Label>
                                <Input
                                  value={question.optionLabels[optionIndex] ?? ""}
                                  onChange={(event) =>
                                    updateQuestion(sectionIndex, questionIndex, (current) => {
                                      const nextOptions = [...current.optionLabels];
                                      nextOptions[optionIndex] = event.target.value;
                                      return { ...current, optionLabels: nextOptions };
                                    })
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-[#5e5a52]">
                            Numerical question detected. Correct answer should contain the exact numeric value.
                          </p>
                        )}

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Marks</Label>
                            <Input
                              value={String(question.marks)}
                              onChange={(event) =>
                                updateQuestion(sectionIndex, questionIndex, (current) => ({
                                  ...current,
                                  marks: safeNumber(event.target.value, current.marks),
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Negative marks</Label>
                            <Input
                              value={String(question.negativeMarks)}
                              onChange={(event) =>
                                updateQuestion(sectionIndex, questionIndex, (current) => ({
                                  ...current,
                                  negativeMarks: safeNumber(event.target.value, current.negativeMarks),
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-[#8a6f3e]">Processing log</summary>
              <ul className="mt-2 space-y-1 text-[#5e5a52]">
                {pkg.processingLog.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </details>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep("answer_key")}>
                Back
              </Button>
              <Button
                className="bg-[#14213d]"
                onClick={() => setStep("configure")}
                disabled={blockingIssues.length > 0}
              >
                Continue to configure
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "configure" && pkg && (
        <Card className="border-[#d8d2c7]">
          <CardHeader>
            <CardTitle className="text-lg text-[#14213d]">Step 5 - Configure and publish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Test title</Label>
              <Input
                value={pkg.title}
                onChange={(event) =>
                  applyPackageUpdate((current) => ({ ...current, title: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input value={duration} onChange={(event) => setDuration(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Instructions (one per line)</Label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-[#ece6da] p-2 text-sm"
                value={pkg.instructions.join("\n")}
                onChange={(event) =>
                  applyPackageUpdate((current) => ({
                    ...current,
                    instructions: event.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                  }))
                }
              />
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
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Opens</Label>
                <Input
                  type="datetime-local"
                  value={scheduleStart}
                  onChange={(event) => setScheduleStart(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Closes</Label>
                <Input
                  type="datetime-local"
                  value={scheduleEnd}
                  onChange={(event) => setScheduleEnd(event.target.value)}
                />
              </div>
            </div>
            {publishError ? <p className="text-sm text-red-700">{publishError}</p> : null}
            <Button className="bg-[#8a6f3e]" onClick={() => void publishTest()}>
              Step 6 - Publish CBT
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="space-y-3 py-6">
            <p className="font-medium text-green-900">CBT published.</p>
            <Button
              variant="outline"
              onClick={() => {
                setStep("paper");
                setPaperFile(null);
                setKeyFile(null);
                setPaperTextOverride("");
                setAnswerKeyTextOverride("");
                setPkg(null);
                setProcessingError("");
                setPublishError("");
              }}
            >
              Upload another paper
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#ece6da] p-4">
      <p className="text-xs uppercase tracking-wide text-[#8f8779]">{label}</p>
      <p className="text-lg font-semibold text-[#14213d]">{value}</p>
    </div>
  );
}

function IssuePanel({
  title,
  tone,
  items,
  emptyMessage,
}: {
  title: string;
  tone: "error" | "warning";
  items: string[];
  emptyMessage: string;
}) {
  const className =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className={`rounded-xl border p-4 ${className}`}>
      <p className="font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm">{emptyMessage}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function resolveUploadText(input: {
  file: File;
  manualText: string;
  label: string;
  optional?: boolean;
}): Promise<{ text: string; mode: UploadExtractionMode }> {
  const manual = input.manualText.trim();
  const fileText = (await input.file.text()).trim();
  const readable = isLikelyReadableText(fileText);

  if (readable && manual) {
    return { text: `${fileText}\n\n${manual}`, mode: "hybrid" };
  }
  if (readable) {
    return { text: fileText, mode: "file" };
  }
  if (manual) {
    return { text: manual, mode: "manual" };
  }
  if (input.optional) {
    return { text: "", mode: "file" };
  }
  throw new Error(
    `Readable ${input.label} text was not detected in ${input.file.name}. Paste extracted text to continue.`,
  );
}

function mergeExtractionMode(
  paperMode: UploadExtractionMode,
  keyMode: UploadExtractionMode,
  hasKey: boolean,
): UploadExtractionMode {
  if (!hasKey) return paperMode;
  if (paperMode === "hybrid" || keyMode === "hybrid") return "hybrid";
  if (paperMode === "manual" || keyMode === "manual") return "manual";
  return "file";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Processing failed. Review the upload and try again.";
}

function safeNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
