"use client";

import type { Candidate } from "@/types/exam";
import { Timer } from "./Timer";

interface ExamHeaderProps {
  examTitle: string;
  candidate: Candidate;
  violationCount?: number;
  onTimeUp?: () => void;
  fixedSeconds?: number;
  modeLabel?: string;
}

export function ExamHeader({
  examTitle,
  candidate,
  violationCount = 0,
  onTimeUp,
  fixedSeconds,
  modeLabel,
}: ExamHeaderProps) {
  return (
    <header className="flex items-stretch border-b-[3px] border-primary bg-white">
      <div className="flex w-32 shrink-0 flex-col items-center justify-center bg-primary px-2 py-3 text-center text-[11px] font-bold leading-tight text-primary-foreground">
        <span className="text-sm">NTA</span>
        <span className="mt-0.5 opacity-90">ExamGrid CBT</span>
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-4 px-5 py-2">
        <div>
          <h1 className="truncate text-base font-bold text-primary">{examTitle}</h1>
          <p className="mt-0.5 text-xs text-gray-600">
            <span className="font-medium text-gray-800">{candidate.name}</span>
            {" | "}Roll No: {candidate.rollNumber}
            {" | "}App No: {candidate.applicationNumber}
          </p>
          {modeLabel ? <p className="mt-0.5 text-xs font-medium text-[#8a6f3e]">{modeLabel}</p> : null}
          {violationCount > 0 ? (
            <p className="mt-0.5 text-xs font-medium text-amber-700">
              Integrity violations recorded: {violationCount}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {fixedSeconds !== undefined ? "Exam Duration" : "Time Left"}
            </p>
            <Timer onTimeUp={onTimeUp} fixedSeconds={fixedSeconds} />
          </div>
          <div
            className="flex h-14 w-12 flex-col items-center justify-center border-2 border-gray-400 bg-gray-50 text-[9px] text-gray-500"
            aria-hidden
          >
            <span>Candidate</span>
            <span>Photo</span>
          </div>
        </div>
      </div>
    </header>
  );
}
