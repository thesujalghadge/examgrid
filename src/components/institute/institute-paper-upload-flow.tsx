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
import {
  getStageLabel,
  runPaperProcessing,
} from "@/lib/cbt/paper-processing";
import { awaitRepositoryPersist } from "@/lib/repositories/await-persist";
import { getRepositories } from "@/lib/repositories/provider";
import { makeCbtId } from "@/lib/cbt/cbt-ids";
import { createScheduleInput, getScheduleStatus } from "@/services/institute-ops-service";
import { saveQuestionBank, getQuestionBank } from "@/services/question-bank-service";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import type { Batch } from "@/types/institute-ops";
import type { CBTTest } from "@/types/cbt";
import type {
  PaperProcessingStage,
  ProcessedPaperPackage,
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
  const [pkg, setPkg] = useState<ProcessedPaperPackage | null>(null);
  const [processLog, setProcessLog] = useState<string[]>([]);
  const [duration, setDuration] = useState("10");
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [publishError, setPublishError] = useState("");

  const refresh = useCallback(() => {
    hydrate();
    setTests(
      getRepositories()
        .cbtTests.list()
        .filter((t) => !instituteId || t.instituteId === instituteId),
    );
    setBatches(
      getRepositories()
        .batches.list()
        .filter((b) => !instituteId || b.instituteId === instituteId),
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
      setSelectedBatchIds(batches.map((b) => b.id));
    }
  }, [batches, selectedBatchIds.length]);

  const previewTest = useMemo(() => {
    if (!pkg) return null;
    const testId = `${pkg.id}-preview`;
    return buildCbtTestFromProcessedPaper(
      { ...pkg, durationMinutes: Math.max(1, parseInt(duration, 10) || 10) },
      testId,
      selectedBatchIds.length ? selectedBatchIds : batches.map((b) => b.id),
      createdBy,
    ).test;
  }, [pkg, duration, selectedBatchIds, batches, createdBy]);

  const startProcessing = async () => {
    if (!paperFile || !instituteId) return;
    setStep("processing");
    setProcessLog([]);
    const ext = paperFile.name.toLowerCase();
    const paperType = ext.endsWith(".doc")
      ? "doc"
      : ext.endsWith(".docx")
        ? "docx"
        : "pdf";
    const keyExt = keyFile?.name.toLowerCase() ?? "";
    const keyType = keyExt.endsWith(".csv")
      ? "csv"
      : keyExt.endsWith(".doc")
        ? "doc"
        : keyExt.endsWith(".docx")
          ? "docx"
          : undefined;

    const result = await runPaperProcessing({
      instituteId,
      paperFileName: paperFile.name,
      paperFileType: paperType,
      answerKeyFileName: keyFile?.name,
      answerKeyFileType: keyType,
      onStage: (_stage: PaperProcessingStage, log) => setProcessLog(log),
    });
    setPkg(result);
    setDuration(String(result.durationMinutes));
    setStep("preview");
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

    const testId = makeCbtId("cbt");
    const finalPkg = {
      ...pkg,
      title: pkg.title,
      durationMinutes: Math.max(1, parseInt(duration, 10) || 10),
    };
    const { test, bankQuestions } = buildCbtTestFromProcessedPaper(
      finalPkg,
      testId,
      selectedBatchIds,
      createdBy,
    );

    const existingBank = getQuestionBank();
    const merged = [...existingBank];
    for (const q of bankQuestions) {
      if (!merged.some((m) => m.id === q.id)) merged.push(q);
    }
    saveQuestionBank(merged);

    const repos = getRepositories();
    repos.cbtTests.save(test);
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
                  .find((s) => s.examId === test.id);
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
          (label, i) => (
            <span
              key={label}
              className={
                i + 1 === stepIndex
                  ? "rounded-full bg-[#14213d] px-3 py-1 font-medium text-white"
                  : i + 1 < stepIndex
                    ? "rounded-full bg-[#e9f3ea] px-3 py-1 text-[#2f6a37]"
                    : "rounded-full border border-[#ece6da] px-3 py-1"
              }
            >
              {i + 1}. {label}
            </span>
          ),
        )}
      </div>

      {step === "paper" && (
        <Card className="border-[#8a6f3e]/40">
          <CardHeader>
            <CardTitle className="text-lg text-[#14213d]">Step 1 — Upload question paper</CardTitle>
            <CardDescription>PDF, DOC, or DOCX</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept={ACCEPT_PAPER}
              onChange={(e) => setPaperFile(e.target.files?.[0] ?? null)}
            />
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
            <CardTitle className="text-lg text-[#14213d]">Step 2 — Upload answer key</CardTitle>
            <CardDescription>CSV, DOC, or DOCX</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept={ACCEPT_KEY}
              onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-[#5e5a52]">
              Answer key optional for dry runs; recommended for scored CBTs.
            </p>
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
            <p className="text-center font-medium text-[#14213d]">Processing paper…</p>
            <ul className="mx-auto max-w-md space-y-1 text-sm text-[#5e5a52]">
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
            <CardTitle className="text-lg text-[#14213d]">Step 4 — CBT preview</CardTitle>
            <CardDescription>
              {pkg.paperFileName}
              {pkg.answerKeyFileName ? ` + ${pkg.answerKeyFileName}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {previewTest.sections.map((sec) => (
                <div key={sec.id} className="rounded-xl border border-[#ece6da] p-4">
                  <p className="font-medium text-[#14213d]">{sec.name}</p>
                  <p className="text-sm text-[#5e5a52]">
                    {previewTest.questions.filter((q) => q.sectionId === sec.id).length}{" "}
                    questions
                  </p>
                </div>
              ))}
            </div>
            <p className="text-sm text-[#5e5a52]">
              {pkg.totalQuestions} questions · {pkg.totalMarks} marks · default {pkg.durationMinutes}{" "}
              min
            </p>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-[#8a6f3e]">
                Prepared analytics metadata ({pkg.sections.reduce((n, s) => n + s.questions.length, 0)}{" "}
                items)
              </summary>
              <ul className="mt-2 max-h-40 overflow-y-auto text-[#5e5a52]">
                {pkg.sections.flatMap((s) =>
                  s.questions.map((q) => (
                    <li key={q.questionId}>
                      {q.subject} / {q.chapter} — {q.difficulty} — solution ready
                    </li>
                  )),
                )}
              </ul>
            </details>
            <Button className="bg-[#14213d]" onClick={() => setStep("configure")}>
              Configure test
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "configure" && pkg && (
        <Card className="border-[#d8d2c7]">
          <CardHeader>
            <CardTitle className="text-lg text-[#14213d]">Step 5 — Configure & publish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Test title</Label>
              <Input
                value={pkg.title}
                onChange={(e) => setPkg({ ...pkg, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Instructions (one per line)</Label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-[#ece6da] p-2 text-sm"
                value={pkg.instructions.join("\n")}
                onChange={(e) =>
                  setPkg({
                    ...pkg,
                    instructions: e.target.value.split("\n").filter(Boolean),
                  })
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
                        setSelectedBatchIds((cur) =>
                          cur.includes(batch.id)
                            ? cur.filter((id) => id !== batch.id)
                            : [...cur, batch.id],
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
                  onChange={(e) => setScheduleStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Closes</Label>
                <Input
                  type="datetime-local"
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(e.target.value)}
                />
              </div>
            </div>
            {publishError ? <p className="text-sm text-red-700">{publishError}</p> : null}
            <Button className="bg-[#8a6f3e]" onClick={() => void publishTest()}>
              Step 6 — Publish CBT
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
                setPkg(null);
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

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
