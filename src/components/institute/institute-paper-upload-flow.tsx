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
import { PaperSubjectMappingPanel } from "@/components/institute/paper-subject-mapping";
import { buildCbtTestFromProcessedPaper } from "@/lib/cbt/build-test-from-processing";
import { applySubjectMapping, defaultSubjectMapping } from "@/lib/cbt/subject-mapping";
import type { PaperSubjectMapping } from "@/types/cbt-paper-processing";
import { cbtTestToExamDefinition } from "@/lib/cbt/cbt-to-exam";
import {
  createBlankPreparedQuestion,
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
import { useQuestionStore } from "@/stores/question-store";
import type { CBTTest } from "@/types/cbt";
import type { ExamDefinition } from "@/types/exam";
import type { Batch } from "@/types/institute-ops";
import type {
  PaperExtractionSummary,
  PaperProcessingStage,
  PreparedQuestionMeta,
  ProcessedPaperPackage,
  ProcessedPaperValidationIssue,
  SupportedPaperFileType,
  UploadExtractionMode,
} from "@/types/cbt-paper-processing";

type WizardStep = "configure" | "upload" | "processing" | "preview" | "edit" | "publish" | "done";
type WizardNavStep = "configure" | "upload" | "preview" | "publish";
type ValidationBucket = "missingAnswers" | "malformedOptions" | "duplicateIds";

const ACCEPT_PAPER = ".pdf,.doc,.docx,.csv,.xlsx,.txt";
const ACCEPT_KEY = ".csv,.xlsx,.txt,.doc,.docx";
const PAPER_FILE_TYPES = ["pdf", "doc", "docx", "csv", "xlsx", "txt"] as const;
const ANSWER_KEY_FILE_TYPES = ["csv", "xlsx", "txt", "doc", "docx"] as const;
const WIZARD_NAV: Array<{ id: WizardNavStep; label: string }> = [
  { id: "configure", label: "Configure" },
  { id: "upload", label: "Upload" },
  { id: "preview", label: "Preview" },
  { id: "publish", label: "Publish" },
];

export function InstitutePaperUploadFlow() {
  const session = useWorkspaceAuthStore((state) => state.session);
  const hydrateSession = useWorkspaceAuthStore((state) => state.hydrateSession);
  const instituteId = session?.instituteId ?? "";
  const createdBy = session?.userId ?? "institute-admin";

  const [tests, setTests] = useState<CBTTest[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [step, setStep] = useState<WizardStep>("configure");
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [paperTextOverride, setPaperTextOverride] = useState("");
  const [answerKeyTextOverride, setAnswerKeyTextOverride] = useState("");
  const [pkg, setPkg] = useState<ProcessedPaperPackage | null>(null);
  const [processLog, setProcessLog] = useState<string[]>([]);
  const [title, setTitle] = useState("Weekly CBT Assessment");
  const [examType, setExamType] = useState<ExamDefinition["examType"]>("JEE_MAIN");
  const [duration, setDuration] = useState("60");
  const [defaultMarks, setDefaultMarks] = useState("4");
  const [defaultNegativeMarks, setDefaultNegativeMarks] = useState("1");
  const [instructions, setInstructions] = useState(
    "Read each question carefully before answering.\nUse the palette to review marked and unanswered questions.\nSubmit before the timer ends.",
  );
  const [optionalSections, setOptionalSections] = useState("");
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [publishError, setPublishError] = useState("");
  const [processingError, setProcessingError] = useState("");
  const [configurationNotice, setConfigurationNotice] = useState("");
  const [publishedTestId, setPublishedTestId] = useState<string | null>(null);

  const refresh = useCallback(() => {
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
  }, [instituteId]);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const configuredSectionNames = useMemo(
    () => optionalSections.split(",").map((name) => name.trim()).filter(Boolean),
    [optionalSections],
  );

  const previewBundle = useMemo(() => {
    if (!pkg) return null;
    const testId = `${pkg.id}-preview`;
    const built = buildCbtTestFromProcessedPaper(
      { ...pkg, durationMinutes: Math.max(1, parseInt(duration, 10) || 60) },
      testId,
      selectedBatchIds,
      createdBy,
      examType,
    );
    const exam = cbtTestToExamDefinition(built.test, built.bankQuestions);
    if (!exam) return null;
    return { ...built, exam };
  }, [createdBy, duration, examType, pkg, selectedBatchIds]);

  const blockingIssues = useMemo(
    () => pkg?.validationIssues.filter((issue) => issue.level === "error") ?? [],
    [pkg],
  );
  const warningIssues = useMemo(
    () => pkg?.validationIssues.filter((issue) => issue.level === "warning") ?? [],
    [pkg],
  );

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
    let questionNumber = 0;
    pkg.sections.forEach((section, sectionIndex) => {
      section.questions.forEach((_, questionIndex) => {
        questionNumber += 1;
        locations.set(`${previewBundle.test.id}-question-${questionNumber}`, {
          sectionIndex,
          questionIndex,
        });
      });
    });
    return locations;
  }, [pkg, previewBundle]);

  const reviewQuestionIdBySource = useMemo(() => {
    const ids = new Map<string, string>();
    if (!pkg || !previewBundle) return ids;
    let questionNumber = 0;
    for (const section of pkg.sections) {
      for (const question of section.questions) {
        questionNumber += 1;
        ids.set(question.questionId, `${previewBundle.test.id}-question-${questionNumber}`);
      }
    }
    return ids;
  }, [pkg, previewBundle]);

  const validationBuckets = useMemo(
    () => bucketValidationIssues(blockingIssues, reviewQuestionIdBySource),
    [blockingIssues, reviewQuestionIdBySource],
  );

  const reviewSectionLocations = useMemo(() => {
    const locations = new Map<string, number>();
    previewBundle?.test.sections.forEach((section, sectionIndex) => {
      locations.set(section.id, sectionIndex);
    });
    return locations;
  }, [previewBundle]);

  const questionIssues = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    if (!previewBundle || !pkg) return grouped;

    for (const issue of pkg.validationIssues) {
      if (!issue.questionId) continue;
      const messages = grouped[issue.questionId] ?? [];
      messages.push(issue.message);
      grouped[issue.questionId] = messages;
    }

    let questionNumber = 0;
    for (const section of pkg.sections) {
      for (const question of section.questions) {
        questionNumber += 1;
        grouped[`${previewBundle.test.id}-question-${questionNumber}`] = grouped[question.questionId] ?? [];
      }
    }
    return grouped;
  }, [pkg, previewBundle]);

  const flaggedQuestionIds = useMemo(() => {
    const ids: string[] = [];
    if (!previewBundle || !pkg) return ids;
    let questionNumber = 0;
    for (const section of pkg.sections) {
      for (const question of section.questions) {
        questionNumber += 1;
        if (question.metadata.teacherFlagged === true) {
          ids.push(`${previewBundle.test.id}-question-${questionNumber}`);
        }
      }
    }
    return ids;
  }, [pkg, previewBundle]);

  const updateQuestion = useCallback(
    (
      sectionIndex: number,
      questionIndex: number,
      updater: (question: PreparedQuestionMeta) => PreparedQuestionMeta,
    ) => {
      applyPackageUpdate((current) => ({
        ...current,
        sections: current.sections.map((section, currentSectionIndex) =>
          currentSectionIndex !== sectionIndex
            ? section
            : {
                ...section,
                questions: section.questions.map((question, currentQuestionIndex) =>
                  currentQuestionIndex === questionIndex ? updater(question) : question,
                ),
              },
        ),
      }));
    },
    [applyPackageUpdate],
  );

  const updateReviewQuestion = useCallback(
    (
      reviewQuestionId: string,
      updater: (question: PreparedQuestionMeta) => PreparedQuestionMeta,
    ) => {
      const location = reviewQuestionLocations.get(reviewQuestionId);
      if (!location) return;
      updateQuestion(location.sectionIndex, location.questionIndex, updater);
    },
    [reviewQuestionLocations, updateQuestion],
  );

  const renameSection = useCallback(
    (sectionIndex: number, name: string) => {
      applyPackageUpdate((current) => ({
        ...current,
        sections: current.sections.map((section, currentSectionIndex) =>
          currentSectionIndex === sectionIndex
            ? {
                ...section,
                name,
                questions: section.questions.map((question) => ({
                  ...question,
                  section: name,
                  subject:
                    question.subject === section.name || question.subject === "Imported Questions"
                      ? name
                      : question.subject,
                })),
              }
            : section,
        ),
      }));
    },
    [applyPackageUpdate],
  );

  const addQuestion = useCallback(
    (sectionIndex: number) => {
      applyPackageUpdate((current) => ({
        ...current,
        sections: current.sections.map((section, currentSectionIndex) =>
          currentSectionIndex === sectionIndex
            ? {
                ...section,
                questions: [
                  ...section.questions,
                  createBlankPreparedQuestion(section.questions.length + 1, section.name),
                ],
              }
            : section,
        ),
      }));
    },
    [applyPackageUpdate],
  );

  const addSection = useCallback(() => {
    applyPackageUpdate((current) => {
      const nextIndex = current.sections.length + 1;
      const name = `Section ${nextIndex}`;
      return {
        ...current,
        sections: [
          ...current.sections,
          {
            id: `section-manual-${Date.now()}-${nextIndex}`,
            name,
            questions: [createBlankPreparedQuestion(1, name)],
          },
        ],
      };
    });
  }, [applyPackageUpdate]);

  const addQuestionBySectionId = useCallback(
    (sectionId: string) => {
      const sectionIndex = reviewSectionLocations.get(sectionId);
      if (sectionIndex === undefined) return;
      addQuestion(sectionIndex);
    },
    [addQuestion, reviewSectionLocations],
  );

  const deleteQuestion = useCallback(
    (sectionIndex: number, questionIndex: number) => {
      applyPackageUpdate((current) => ({
        ...current,
        sections: current.sections.map((section, currentSectionIndex) =>
          currentSectionIndex === sectionIndex
            ? {
                ...section,
                questions: section.questions.filter((_, currentQuestionIndex) => currentQuestionIndex !== questionIndex),
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
        sections: current.sections.map((section, currentSectionIndex) => {
          if (currentSectionIndex !== sectionIndex) return section;
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

  const moveReviewQuestion = useCallback(
    (reviewQuestionId: string, delta: -1 | 1) => {
      const location = reviewQuestionLocations.get(reviewQuestionId);
      if (!location) return;
      moveQuestion(location.sectionIndex, location.questionIndex, delta);
    },
    [moveQuestion, reviewQuestionLocations],
  );

  const deleteReviewQuestion = useCallback(
    (reviewQuestionId: string) => {
      const location = reviewQuestionLocations.get(reviewQuestionId);
      if (!location) return;
      deleteQuestion(location.sectionIndex, location.questionIndex);
    },
    [deleteQuestion, reviewQuestionLocations],
  );

  const toggleReviewFlag = useCallback(
    (reviewQuestionId: string) => {
      updateReviewQuestion(reviewQuestionId, (current) => ({
        ...current,
        metadata: {
          ...current.metadata,
          teacherFlagged: current.metadata.teacherFlagged === true ? false : true,
        },
      }));
    },
    [updateReviewQuestion],
  );

  const syncConfigureIntoPackage = useCallback(() => {
    if (!pkg) return;
    setPkg((current) => {
      if (!current) return current;
      return normalizeProcessedPaper(
        applySubjectMapping({
          ...current,
          title: title.trim() || current.title,
          durationMinutes: Math.max(1, parseInt(duration, 10) || 60),
          instructions: instructions
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        }),
      );
    });
  }, [duration, instructions, pkg, title]);

  const navigateWizard = useCallback(
    (target: WizardNavStep) => {
      setPublishError("");
      setConfigurationNotice("");
      if (pkg && (target === "configure" || target === "preview" || target === "publish")) {
        syncConfigureIntoPackage();
      }
      if (target === "preview") {
        setStep("preview");
        return;
      }
      if (target === "publish") {
        setStep("publish");
        return;
      }
      setStep(target);
    },
    [pkg, syncConfigureIntoPackage],
  );

  const openReviewQuestion = useCallback((questionId?: string) => {
    if (!questionId) {
      setStep("edit");
      return;
    }
    setStep("edit");
    window.setTimeout(() => {
      useQuestionStore.getState().goToQuestion(questionId);
    }, 0);
  }, []);

  const startProcessing = async () => {
    if (!paperFile || !instituteId) {
      setConfigurationNotice("Add a question paper to continue to the CBT preview.");
      return;
    }
    if (!title.trim()) {
      setConfigurationNotice("Give this test a title before continuing.");
      return;
    }
    setConfigurationNotice("");
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
        kind: "paper",
      });
      const answerKeySource = keyFile
        ? await resolveUploadText({
            file: keyFile,
            manualText: answerKeyTextOverride,
            label: "answer key",
            kind: "answer_key",
            optional: true,
          })
        : null;

      const paperType = detectFileType(paperFile.name, PAPER_FILE_TYPES) as SupportedPaperFileType;
      const keyType = keyFile
        ? (detectFileType(keyFile.name, ANSWER_KEY_FILE_TYPES) as SupportedPaperFileType)
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
        extractionSummary: paperSource.summary,
        onStage: (_stage: PaperProcessingStage, log) => setProcessLog(log),
      });

      const marks = safeNumber(defaultMarks, 4);
      const negativeMarks = safeNumber(defaultNegativeMarks, 1);
      const configuredSections = result.sections.map((section, sectionIndex) => {
        const sectionName = configuredSectionNames[sectionIndex] || section.name;
        return {
          ...section,
          name: sectionName,
          questions: section.questions.map((question) => ({
            ...question,
            section: sectionName,
            subject:
              question.subject === section.name || question.subject === "Imported Questions"
                ? sectionName
                : question.subject,
            marks,
            negativeMarks,
          })),
        };
      });
      const configured = normalizeProcessedPaper({
        ...result,
        title: title.trim(),
        durationMinutes: Math.max(1, parseInt(duration, 10) || 60),
        instructions: instructions
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        sections: configuredSections,
        subjectMapping: defaultSubjectMapping(
          configuredSections.reduce((count, section) => count + section.questions.length, 0),
        ),
      });
      setPkg(configured);
      setProcessLog(configured.processingLog);
      setStep("preview");
    } catch (error) {
      const message = getErrorMessage(error);
      setProcessingError(message);
      setStep("configure");
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
    if (blockingIssues.length > 0) {
      setPublishError("A few questions still need attention before this CBT is ready. Open each highlighted item in the preview to finish it.");
      return;
    }

    const finalPkg = normalizeProcessedPaper({
      ...pkg,
      durationMinutes: Math.max(1, parseInt(duration, 10) || 60),
    });
    const remainingIssues = validateProcessedPaper(finalPkg).filter((issue) => issue.level === "error");
    if (remainingIssues.length > 0) {
      setPkg(finalPkg);
      setPublishError("There are still a few answer or option details to review before publishing.");
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

    const existingBank = getQuestionBank();
    const mergedBank = [...existingBank];
    for (const question of bankQuestions) {
      if (!mergedBank.some((row) => row.id === question.id)) mergedBank.push(question);
    }
    saveQuestionBank(mergedBank);

    const repositories = getRepositories();
    repositories.cbtTests.save(test);
    const examDefinition = cbtTestToExamDefinition(test);
    if (examDefinition) {
      repositories.exams.save(examDefinition);
    }
    if (selectedBatchIds.length > 0 && scheduleStart && scheduleEnd) {
      repositories.schedules.save({
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
    logUploadEvent("paper_processing_published", {
      instituteId,
      testId,
      totalQuestions: finalPkg.totalQuestions,
      totalMarks: finalPkg.totalMarks,
      usedOCR: finalPkg.extractionSummary.usedOCR,
    });
    refresh();
    setPkg({ ...finalPkg, status: "PUBLISHED" });
    setPublishedTestId(testId);
    setStep("done");
  };

  const activeNavStep: WizardNavStep =
    step === "processing" || step === "upload"
      ? "upload"
      : step === "preview" || step === "edit"
        ? "preview"
        : step === "publish" || step === "done"
          ? "publish"
          : "configure";
  const reviewMode = step === "edit" ? "edit" : "preview";

  const resetWizard = () => {
    setStep("configure");
    setPaperFile(null);
    setKeyFile(null);
    setPaperTextOverride("");
    setAnswerKeyTextOverride("");
    setPkg(null);
    setSelectedBatchIds([]);
    setProcessingError("");
    setPublishError("");
    setPublishedTestId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#5e5a52]">
        {WIZARD_NAV.map((item, index) => (
          <button
            key={item.id}
            type="button"
            disabled={!canNavigateWizard(item.id, pkg, step)}
            onClick={() => navigateWizard(item.id)}
            className={
              item.id === activeNavStep
                ? "rounded-md bg-[#14213d] px-3 py-1.5 font-medium text-white"
                : "rounded-md border border-[#ece6da] bg-white px-3 py-1.5 enabled:hover:bg-[#fbf9f4] disabled:cursor-not-allowed disabled:opacity-50"
            }
          >
            {index + 1}. {item.label}
          </button>
        ))}
      </div>

      {step === "configure" && (
        <Card className="border-[#d8d2c7]">
          <CardHeader className="border-b">
            <CardTitle className="text-lg text-[#14213d]">Configure test</CardTitle>
            <CardDescription>Set the essentials and attach the paper in one pass.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <label className="space-y-1.5 md:col-span-2">
                <Label>Title</Label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label className="space-y-1.5">
                <Label>Exam type</Label>
                <select
                  value={examType}
                  onChange={(event) => setExamType(event.target.value as ExamDefinition["examType"])}
                  className="h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm"
                >
                  <option value="JEE_MAIN">JEE Main</option>
                  <option value="NEET">NEET</option>
                  <option value="CET">CET</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <Label>Duration (min)</Label>
                <Input type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)} />
              </label>
              <label className="space-y-1.5">
                <Label>Marks per question</Label>
                <Input type="number" min="0" value={defaultMarks} onChange={(event) => setDefaultMarks(event.target.value)} />
              </label>
              <label className="space-y-1.5">
                <Label>Negative marking</Label>
                <Input type="number" min="0" step="0.25" value={defaultNegativeMarks} onChange={(event) => setDefaultNegativeMarks(event.target.value)} />
              </label>
              <label className="space-y-1.5">
                <Label>Available From (optional)</Label>
                <Input type="datetime-local" value={scheduleStart} onChange={(event) => setScheduleStart(event.target.value)} />
              </label>
              <label className="space-y-1.5">
                <Label>Available Until (optional)</Label>
                <Input type="datetime-local" value={scheduleEnd} onChange={(event) => setScheduleEnd(event.target.value)} />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
              <label className="space-y-1.5">
                <Label>Instructions</Label>
                <textarea
                  className="min-h-20 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm"
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                />
              </label>
              <label className="space-y-1.5">
                <Label>Optional sections</Label>
                <Input
                  placeholder="Physics, Chemistry, Mathematics"
                  value={optionalSections}
                  onChange={(event) => setOptionalSections(event.target.value)}
                />
                <p className="text-xs text-[#5e5a52]">Optional comma-separated labels for detected sections.</p>
              </label>
            </div>
            <p className="border-t border-[#ece6da] pt-4 text-sm text-[#5e5a52]">
              Subject mapping is configured in Preview after questions are extracted (single subject or question ranges).
            </p>
            {(configurationNotice || processingError) && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {configurationNotice || processingError}
              </p>
            )}
            <Button className="bg-[#14213d] px-4" onClick={() => setStep("upload")}>
              Continue to upload
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "upload" && (
        <Card className="border-[#d8d2c7]">
          <CardHeader className="border-b">
            <CardTitle className="text-lg text-[#14213d]">Upload paper and answer key</CardTitle>
            <CardDescription>Upload now or paste fallback text for scanned or complex files.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 rounded-lg border border-[#ece6da] bg-[#fbf9f4] p-3">
                <Label>Upload question paper</Label>
                <Input type="file" accept={ACCEPT_PAPER} onChange={(event) => setPaperFile(event.target.files?.[0] ?? null)} />
                <p className="text-xs text-[#5e5a52]">{paperFile ? paperFile.name : "PDF, DOC, DOCX, CSV, XLSX, or TXT"}</p>
              </label>
              <label className="space-y-1.5 rounded-lg border border-[#ece6da] bg-[#fbf9f4] p-3">
                <Label>Upload answer key</Label>
                <Input type="file" accept={ACCEPT_KEY} onChange={(event) => setKeyFile(event.target.files?.[0] ?? null)} />
                <p className="text-xs text-[#5e5a52]">{keyFile ? keyFile.name : "Optional. Missing answers can be fixed during edit."}</p>
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <textarea
                className="min-h-32 rounded-lg border border-input p-2 text-sm"
                placeholder="Question paper extracted text"
                value={paperTextOverride}
                onChange={(event) => setPaperTextOverride(event.target.value)}
              />
              <textarea
                className="min-h-32 rounded-lg border border-input p-2 text-sm"
                placeholder="Answer key text, for example 1-A, 2-B"
                value={answerKeyTextOverride}
                onChange={(event) => setAnswerKeyTextOverride(event.target.value)}
              />
            </div>
            {(configurationNotice || processingError) && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {configurationNotice || processingError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep("configure")}>Back to configure</Button>
              <Button className="bg-[#14213d] px-4" onClick={() => void startProcessing()}>
                Build CBT preview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "processing" && (
        <Card className="border-[#d8d2c7]">
          <CardContent className="space-y-4 py-10">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[#8a6f3e] border-t-transparent" />
            <p className="text-center font-medium text-[#14213d]">Preparing your CBT preview</p>
            <p className="text-center text-sm text-[#5e5a52]">Uploading, reading questions, and pairing answers.</p>
            <ul className="mx-auto max-w-2xl space-y-1 text-xs text-[#5e5a52]">
              {processLog.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {(step === "preview" || step === "edit") && pkg && previewBundle && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[#14213d]">
                {step === "preview" ? "Student CBT preview" : "Edit inside CBT preview"}
              </h3>
              <p className="text-sm text-[#5e5a52]">
                {pkg.paperFileName} | {pkg.totalQuestions} questions | {pkg.totalMarks} marks
              </p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="rounded-md bg-[#f5f1e8] px-2.5 py-1 text-[#8a6f3e]">{pkg.sections.length} sections</span>
              <span className="rounded-md bg-[#f5f1e8] px-2.5 py-1 text-[#8a6f3e]">{blockingIssues.length} to review</span>
            </div>
          </div>
          <ValidationSummary
            buckets={validationBuckets}
            onOpenQuestion={openReviewQuestion}
          />

          {pkg.subjectMapping ? (
            <PaperSubjectMappingPanel
              totalQuestions={pkg.totalQuestions}
              mapping={pkg.subjectMapping}
              onChange={(nextMapping: PaperSubjectMapping) =>
                applyPackageUpdate((current) => ({ ...current, subjectMapping: nextMapping }))
              }
            />
          ) : null}

          {step === "edit" && (
            <Card className="border-[#d8d2c7]" size="sm">
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <IssuePanel
                    title="Details to check"
                    tone="warning"
                    issues={blockingIssues.map((issue) => ({
                      key: `${issue.questionId ?? issue.message}:${issue.message}`,
                      message: issue.message,
                      reviewQuestionId: issue.questionId ? reviewQuestionIdBySource.get(issue.questionId) : undefined,
                    }))}
                    emptyMessage="All required question and answer details are complete."
                    onOpenQuestion={openReviewQuestion}
                  />
                  <IssuePanel
                    title="Parser notes"
                    tone="warning"
                    issues={warningIssues.map((issue) => ({
                      key: `${issue.questionId ?? issue.message}:${issue.message}`,
                      message: issue.message,
                      reviewQuestionId: issue.questionId ? reviewQuestionIdBySource.get(issue.questionId) : undefined,
                    }))}
                    emptyMessage="No additional parser notes."
                    onOpenQuestion={openReviewQuestion}
                  />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  {pkg.sections.map((section, sectionIndex) => (
                    <label key={section.id} className="min-w-40 flex-1 space-y-1">
                      <Label>Section {sectionIndex + 1}</Label>
                      <Input value={section.name} onChange={(event) => renameSection(sectionIndex, event.target.value)} />
                    </label>
                  ))}
                  <Button type="button" variant="outline" onClick={addSection}>Add section</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="h-[min(780px,calc(100dvh-8rem))] min-h-[560px] overflow-hidden rounded-lg border border-[#d8d2c7]">
            <ExamInterface
              examId={previewBundle.exam.id}
              review={{
                exam: previewBundle.exam,
                status: pkg.status,
                mode: reviewMode,
                flaggedQuestionIds,
                questionIssues,
                onQuestionTextChange: (questionId, value) =>
                  updateReviewQuestion(questionId, (current) => ({ ...current, questionText: value })),
                onOptionTextChange: (questionId, label, value) =>
                  updateReviewQuestion(questionId, (current) => {
                    const optionIndex = Math.max(0, label.charCodeAt(0) - 65);
                    const nextOptions = [...current.optionLabels];
                    nextOptions[optionIndex] = value;
                    return { ...current, optionLabels: nextOptions };
                  }),
                onCorrectAnswerChange: (questionId, value) =>
                  updateReviewQuestion(questionId, (current) => ({ ...current, correctAnswer: value.trim().toUpperCase() })),
                onMarksChange: (questionId, value) =>
                  updateReviewQuestion(questionId, (current) => ({ ...current, marks: safeNumber(value, current.marks) })),
                onNegativeMarksChange: (questionId, value) =>
                  updateReviewQuestion(questionId, (current) => ({ ...current, negativeMarks: safeNumber(value, current.negativeMarks) })),
                onToggleFlag: toggleReviewFlag,
                onMoveQuestion: moveReviewQuestion,
                onDeleteQuestion: deleteReviewQuestion,
                onAddQuestion: addQuestionBySectionId,
                onContinue: () => {
                  if (step === "preview") setStep("edit");
                  else setStep("publish");
                },
              }}
            />
          </div>

          {step === "preview" && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>Back to upload</Button>
              <Button variant="outline" onClick={() => setStep("edit")}>Edit questions</Button>
              <Button className="bg-[#14213d]" onClick={() => setStep("publish")}>Continue to publish</Button>
            </div>
          )}
        </div>
      )}

      {step === "publish" && pkg && (
        <Card className="border-[#d8d2c7]" size="sm">
          <CardHeader>
            <CardTitle className="text-base text-[#14213d]">Publish options</CardTitle>
            <CardDescription>Assignments and availability are optional; unresolved counts link back to the affected question.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ValidationSummary
              buckets={validationBuckets}
              onOpenQuestion={openReviewQuestion}
            />
            <div className="flex flex-wrap gap-2">
              {batches.map((batch) => (
                <label key={batch.id} className="flex items-center gap-2 rounded-md border border-[#ece6da] px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedBatchIds.includes(batch.id)}
                    onChange={() =>
                      setSelectedBatchIds((current) =>
                        current.includes(batch.id) ? current.filter((id) => id !== batch.id) : [...current, batch.id],
                      )
                    }
                  />
                  {batch.name}
                </label>
              ))}
              {batches.length === 0 && (
                <p className="text-sm text-[#5e5a52]">No batches yet. You can publish now and assign later.</p>
              )}
            </div>
            {publishError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{publishError}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep("preview")}>Preview</Button>
              <Button variant="outline" onClick={() => setStep("edit")}>Edit questions</Button>
              <Button className="bg-[#8a6f3e] px-4" onClick={() => void publishTest()}>Publish CBT</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="space-y-4 py-8">
            <div>
              <p className="text-lg font-semibold text-emerald-950">CBT ready for students</p>
              <p className="mt-1 text-sm text-emerald-800">
                {pkg?.title} has been published successfully. Assign a batch or schedule its live window when ready.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/institute/batches" className="inline-flex h-9 items-center rounded-lg bg-[#14213d] px-4 text-sm font-medium text-white">Assign batch</Link>
              <Button variant="outline" className="bg-white" onClick={() => setStep("preview")}>Preview CBT</Button>
              {publishedTestId && (
                <Link href={`/institute/tests/${publishedTestId}`} className="inline-flex h-9 items-center rounded-lg border border-[#d8d2c7] bg-white px-4 text-sm font-medium text-[#14213d]">Schedule</Link>
              )}
              <Button variant="outline" className="bg-white" onClick={resetWizard}>Publish another</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tests.length > 0 && step !== "preview" && step !== "edit" && (
        <Card className="border-[#d8d2c7]" size="sm">
          <CardHeader><CardTitle className="text-base text-[#14213d]">Published tests</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y rounded-lg border border-[#ece6da] bg-white text-sm">
              {tests.slice(0, 4).map((test) => {
                const schedule = getRepositories().schedules.list().find((row) => row.examId === test.id);
                return (
                  <li key={test.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>{test.title} <span className="text-[#5e5a52]">| {schedule ? getScheduleStatus(schedule) : "unscheduled"}</span></span>
                    <Link href={`/institute/tests/${test.id}`} className="font-medium text-[#8a6f3e]">Open</Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );

}

function IssuePanel({
  title,
  tone,
  issues,
  emptyMessage,
  onOpenQuestion,
}: {
  title: string;
  tone: "error" | "warning";
  issues: Array<{ key: string; message: string; reviewQuestionId?: string }>;
  emptyMessage: string;
  onOpenQuestion: (questionId?: string) => void;
}) {
  const visibleItems = issues.slice(0, 4);
  const className =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className={`rounded-xl border p-4 ${className}`}>
      <p className="font-medium">{title}</p>
      {issues.length === 0 ? (
        <p className="mt-2 text-sm">{emptyMessage}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {visibleItems.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className="text-left underline-offset-2 hover:underline"
                onClick={() => onOpenQuestion(item.reviewQuestionId)}
              >
                {item.message}
              </button>
            </li>
          ))}
          {issues.length > visibleItems.length && (
            <li className="font-medium">+{issues.length - visibleItems.length} more in the question palette</li>
          )}
        </ul>
      )}
    </div>
  );
}

function ValidationSummary({
  buckets,
  onOpenQuestion,
}: {
  buckets: Record<ValidationBucket, Array<{ issue: ProcessedPaperValidationIssue; reviewQuestionId?: string }>>;
  onOpenQuestion: (questionId?: string) => void;
}) {
  const rows = [
    { key: "missingAnswers" as const, label: "Missing answers" },
    { key: "malformedOptions" as const, label: "Malformed options" },
    { key: "duplicateIds" as const, label: "Duplicate IDs" },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {rows.map((row) => {
        const items = buckets[row.key];
        const first = items[0];
        return (
          <button
            key={row.key}
            type="button"
            disabled={items.length === 0}
            onClick={() => onOpenQuestion(first?.reviewQuestionId)}
            className="rounded-lg border border-[#ece6da] bg-white px-3 py-2 text-left text-sm shadow-sm enabled:hover:border-[#8a6f3e] disabled:cursor-default disabled:opacity-70"
          >
            <span className="block text-xs uppercase tracking-wide text-[#8f8779]">{row.label}</span>
            <span className="text-xl font-semibold text-[#14213d]">{items.length}</span>
          </button>
        );
      })}
    </div>
  );
}

async function resolveUploadText(input: {
  file: File;
  manualText: string;
  label: string;
  kind: "paper" | "answer_key";
  optional?: boolean;
}): Promise<{
  text: string;
  mode: UploadExtractionMode;
  summary: Omit<PaperExtractionSummary, "questionsDetected">;
}> {
  const manual = input.manualText.trim();
  const extracted = await extractUploadTextFromServer(input.file, input.kind);
  const fileText = extracted.text.trim();
  const readable = isLikelyReadableText(fileText);

  if (readable && manual) {
    return {
      text: `${fileText}\n\n${manual}`,
      mode: "hybrid",
      summary: extracted.summary,
    };
  }
  if (readable) {
    return { text: fileText, mode: "file", summary: extracted.summary };
  }
  if (manual) {
    return {
      text: manual,
      mode: "manual",
      summary: {
        ...extracted.summary,
        usedOCR: true,
        warnings: [
          ...extracted.summary.warnings,
          "We detected a scanned or complex document. Please review extracted content before publishing.",
        ],
      },
    };
  }
  if (input.optional) {
    return { text: "", mode: "file", summary: extracted.summary };
  }
  return {
    text: fileText,
    mode: "file",
    summary: {
      ...extracted.summary,
      usedOCR: true,
      warnings: [
        ...extracted.summary.warnings,
        "We detected a scanned or complex document. Please review extracted content before publishing.",
      ],
    },
  };
}

async function extractUploadTextFromServer(
  file: File,
  kind: "paper" | "answer_key",
): Promise<{
  text: string;
  summary: Omit<PaperExtractionSummary, "questionsDetected">;
}> {
  const fileType = detectFileType(
    file.name,
    kind === "paper" ? PAPER_FILE_TYPES : ANSWER_KEY_FILE_TYPES,
  ) as SupportedPaperFileType;
  const formData = new FormData();
  formData.set("kind", kind);
  formData.set("fileType", fileType);
  formData.set("file", file);

  const response = await fetch("/api/institute/paper-extract", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const plainText = (await file.text()).trim();
    return {
      text: plainText,
      summary: {
        pages: 1,
        extractedChars: plainText.length,
        usedOCR: false,
        warnings: response.status >= 500 ? ["Server extraction fallback used. Review the draft carefully."] : [],
      },
    };
  }

  return (await response.json()) as {
    text: string;
    summary: Omit<PaperExtractionSummary, "questionsDetected">;
  };
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

function canNavigateWizard(
  target: WizardNavStep,
  pkg: ProcessedPaperPackage | null,
  step: WizardStep,
): boolean {
  if (step === "processing") return target === "upload";
  if (target === "configure" || target === "upload") return true;
  if (target === "preview" || target === "publish") return Boolean(pkg);
  return false;
}

function bucketValidationIssues(
  issues: ProcessedPaperValidationIssue[],
  reviewQuestionIdBySource: Map<string, string>,
): Record<ValidationBucket, Array<{ issue: ProcessedPaperValidationIssue; reviewQuestionId?: string }>> {
  const buckets: Record<ValidationBucket, Array<{ issue: ProcessedPaperValidationIssue; reviewQuestionId?: string }>> = {
    missingAnswers: [],
    malformedOptions: [],
    duplicateIds: [],
  };
  for (const issue of issues) {
    const item = {
      issue,
      reviewQuestionId: issue.questionId ? reviewQuestionIdBySource.get(issue.questionId) : undefined,
    };
    if (issue.code === "duplicate_id") {
      buckets.duplicateIds.push(item);
    } else if (issue.code === "malformed_options") {
      buckets.malformedOptions.push(item);
    } else if (issue.code === "missing_answer") {
      buckets.missingAnswers.push(item);
    } else {
      const lower = issue.message.toLowerCase();
      if (lower.includes("duplicate question id")) {
        buckets.duplicateIds.push(item);
      } else if (lower.includes("answer") || lower.includes("numerical")) {
        buckets.missingAnswers.push(item);
      } else if (lower.includes("option")) {
        buckets.malformedOptions.push(item);
      }
    }
  }
  return buckets;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Processing failed. Review the upload and try again.";
}

function safeNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
