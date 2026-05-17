"use client";

import type { Candidate } from "@/types/exam";
import { Timer } from "./Timer";

interface ExamHeaderProps {
  examTitle: string;
  candidate: Candidate;
  violationCount?: number;
  onTimeUp?: () => void;
}

export function ExamHeader({
  examTitle,
  candidate,
  violationCount = 0,
  onTimeUp,
}: ExamHeaderProps) {
  return (
    <header className="flex items-stretch border-b-[3px] border-[var(--eg-cbt)] bg-white shadow-sm">
      <div className="flex w-32 shrink-0 flex-col items-center justify-center bg-[var(--eg-cbt)] px-2 py-3 text-center text-[11px] font-bold leading-tight text-white">
        <span className="text-sm tracking-wide">NTA</span>
        <span className="mt-0.5 text-[10px] font-semibold opacity-90">
          ExamGrid CBT
        </span>
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-4 px-5 py-2.5">
        <div>
          <h1 className="truncate text-base font-bold tracking-tight text-[var(--eg-cbt)] sm:text-lg">
            {examTitle}
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-800">{candidate.name}</span>
            {" · "}Roll: {candidate.rollNumber}
            {" · "}App: {candidate.applicationNumber}
          </p>
          {violationCount > 0 && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              Integrity violations recorded: {violationCount}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Time left
            </p>
            <Timer onTimeUp={onTimeUp} />
          </div>
          <div
            className="flex h-14 w-12 flex-col items-center justify-center rounded border-2 border-slate-300 bg-slate-50 text-[9px] text-slate-500"
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
