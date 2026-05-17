"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getExamById } from "@/data/mock-exams";
import { canCandidateAccessExam, isOperationalSchedulingActive } from "@/services/institute-ops-service";
import { useAuthStore } from "@/stores/auth-store";
import { useExamLifecycleStore } from "@/stores/exam-lifecycle-store";

export default function InstructionsPage() {
  const params = useParams();
  const examId = params.examId as string;
  const router = useRouter();
  const candidate = useAuthStore((s) => s.candidate);
  const setExamId = useExamLifecycleStore((s) => s.setExamId);
  const setPhase = useExamLifecycleStore((s) => s.setPhase);

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
    if (exam) setExamId(examId);
  }, [candidate, exam, examId, router, setExamId]);

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
        <h1 className="text-center text-lg font-bold">Instructions</h1>
        <p className="text-center text-sm text-blue-100">{exam.title}</p>
      </header>

      <main className="mx-auto max-w-3xl p-6">
        <ol className="list-decimal space-y-3 pl-6 text-sm leading-relaxed text-gray-800">
          {exam.instructions.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>

        <div className="mt-8 rounded border border-gray-300 bg-gray-50 p-4 text-sm">
          <p className="font-semibold text-[#1a3c6e]">Palette symbols</p>
          <ul className="mt-2 space-y-1 text-gray-700">
            <li>
              <span className="inline-block h-4 w-4 border border-gray-500 bg-white align-middle" />{" "}
              Not Visited
            </li>
            <li>
              <span className="inline-block h-4 w-4 bg-red-600 align-middle" /> Not
              Answered
            </li>
            <li>
              <span className="inline-block h-4 w-4 bg-green-600 align-middle" />{" "}
              Answered
            </li>
            <li>
              <span className="inline-block h-4 w-4 bg-violet-600 align-middle" />{" "}
              Marked for Review
            </li>
          </ul>
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/exams"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Back
          </Link>
          <Button
            className="bg-[#1a3c6e] hover:bg-[#152d52]"
            onClick={() => {
              setPhase("instructions_viewed");
              router.push(`/exam/${examId}/declaration`);
            }}
          >
            Next
          </Button>
        </div>
      </main>
    </div>
  );
}
