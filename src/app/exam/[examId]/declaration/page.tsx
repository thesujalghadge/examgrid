"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { getExamById } from "@/data/mock-exams";
import {
  isFullscreenActive,
  requestExamFullscreen,
} from "@/lib/fullscreen";
import {
  canCandidateAccessExam,
  isOperationalSchedulingActive,
} from "@/services/institute-ops-service";
import { useAuthStore } from "@/stores/auth-store";
import { useExamLifecycleStore } from "@/stores/exam-lifecycle-store";

export default function DeclarationPage() {
  const params = useParams();
  const examId = params.examId as string;
  const router = useRouter();
  const candidate = useAuthStore((s) => s.candidate);
  const setPhase = useExamLifecycleStore((s) => s.setPhase);
  const [accepted, setAccepted] = useState(false);
  const [fullscreenReady, setFullscreenReady] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);

  const exam = getExamById(examId);

  useEffect(() => {
    if (!candidate) router.replace("/login");
    if (!exam) router.replace("/exams");
    if (
      candidate &&
      exam &&
      isOperationalSchedulingActive() &&
      !canCandidateAccessExam(candidate, examId)
    ) {
      router.replace("/exams");
    }
  }, [candidate, exam, examId, router]);

  useEffect(() => {
    setFullscreenReady(isFullscreenActive());
  }, []);

  const handleEnterFullscreen = async () => {
    setFullscreenError(null);
    const ok = await requestExamFullscreen();
    setFullscreenReady(ok || isFullscreenActive());
    if (!ok && !isFullscreenActive()) {
      setFullscreenError(
        "Fullscreen could not be enabled. Click below to try again, or continue — you may be prompted again when the exam starts.",
      );
    }
  };

  const handleBegin = async () => {
    if (!isFullscreenActive()) {
      await requestExamFullscreen();
    }
    setPhase("declaration_signed");
    router.push(`/exam/${examId}/take`);
  };

  if (
    !candidate ||
    !exam ||
    (isOperationalSchedulingActive() && !canCandidateAccessExam(candidate, examId))
  ) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-[#1a3c6e] px-6 py-3 text-white">
        <h1 className="text-center text-lg font-bold">Candidate Declaration</h1>
      </header>

      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded border border-gray-300 bg-gray-50 p-6 text-sm leading-relaxed text-gray-800">
          <p className="mb-4">
            I, <strong>{candidate.name}</strong> (Roll No.{" "}
            <strong>{candidate.rollNumber}</strong>), hereby declare that:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              I will not use any unfair means during this examination and will
              follow all instructions issued by the invigilator / NTA.
            </li>
            <li>
              I understand that the timer continues even if I close the browser,
              and my responses are auto-saved locally.
            </li>
            <li>
              I will remain in fullscreen mode and will not switch tabs during
              the examination. Violations are recorded.
            </li>
            <li>
              I am ready to begin the Computer Based Test for{" "}
              <strong>{exam.title}</strong>.
            </li>
          </ul>
        </div>

        <div className="mt-6 rounded border border-[#1a3c6e]/30 bg-[#eef3fa] p-4">
          <p className="mb-3 text-sm font-semibold text-[#1a3c6e]">
            Step 1 — Enter Fullscreen Mode
          </p>
          <p className="mb-3 text-xs text-gray-600">
            JEE/NEET CBT examinations run in fullscreen. Enter fullscreen before
            starting the exam.
          </p>
          <Button
            type="button"
            className="bg-[#1a3c6e] hover:bg-[#152d52]"
            onClick={() => void handleEnterFullscreen()}
          >
            Enter Fullscreen
          </Button>
          {fullscreenReady && (
            <p className="mt-2 text-xs font-medium text-green-700">
              Fullscreen is active.
            </p>
          )}
          {fullscreenError && (
            <p className="mt-2 text-xs text-amber-700">{fullscreenError}</p>
          )}
        </div>

        <div className="mt-4 flex items-start gap-3 rounded border border-amber-200 bg-amber-50 p-4">
          <Checkbox
            id="declare"
            checked={accepted}
            onCheckedChange={(v) => setAccepted(v === true)}
          />
          <Label
            htmlFor="declare"
            className="cursor-pointer text-sm leading-snug"
          >
            I have read and understood the declaration. I agree to abide by the
            rules of the examination.
          </Label>
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <Link
            href={`/exam/${examId}/instructions`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Back
          </Link>
          <Button
            disabled={!accepted}
            className="bg-green-700 hover:bg-green-800"
            onClick={() => void handleBegin()}
          >
            {fullscreenReady
              ? "Begin Examination"
              : "Begin Examination (Fullscreen)"}
          </Button>
        </div>
      </main>
    </div>
  );
}
