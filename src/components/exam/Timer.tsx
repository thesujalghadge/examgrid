"use client";

import { useEffect, useRef, useState } from "react";
import { useTimerStore } from "@/stores/timer-store";
import { cn } from "@/lib/utils";

interface TimerProps {
  onTimeUp?: () => void;
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Timer({ onTimeUp }: TimerProps) {
  const isRunning = useTimerStore((s) => s.isRunning);
  const examEndsAt = useTimerStore((s) => s.examEndsAt);
  const getRemainingSeconds = useTimerStore((s) => s.getRemainingSeconds);
  const [remaining, setRemaining] = useState(0);
  const timeUpFiredRef = useRef(false);

  useEffect(() => {
    timeUpFiredRef.current = false;
    setRemaining(getRemainingSeconds());
  }, [examEndsAt, getRemainingSeconds]);

  useEffect(() => {
    if (!isRunning || !examEndsAt) return;

    const tick = () => {
      const secs = getRemainingSeconds();
      setRemaining(secs);
      if (secs <= 0 && !timeUpFiredRef.current) {
        timeUpFiredRef.current = true;
        onTimeUp?.();
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning, examEndsAt, getRemainingSeconds, onTimeUp]);

  const isLow = remaining > 0 && remaining <= 300;
  const isCritical = remaining > 0 && remaining <= 60;

  return (
    <div
      className={cn(
        "mt-0.5 inline-block min-w-[6rem] rounded-md border-2 px-3 py-1.5 text-center font-mono text-xl font-bold tabular-nums tracking-tight shadow-sm",
        isCritical
          ? "animate-pulse border-red-900 bg-red-600 text-white"
          : isLow
            ? "border-red-700 bg-red-600 text-white"
            : "border-[var(--eg-cbt)] bg-[var(--eg-cbt)] text-white",
      )}
    >
      <span className="sr-only">Time remaining: </span>
      {formatTime(remaining)}
    </div>
  );
}
