"use client";

import { useEffect, useRef, useState } from "react";
import { useTimerStore } from "@/stores/timer-store";
import { cn } from "@/lib/utils";

interface TimerProps {
  onTimeUp?: () => void;
  fixedSeconds?: number;
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

export function Timer({ onTimeUp, fixedSeconds }: TimerProps) {
  const isRunning = useTimerStore((s) => s.isRunning);
  const examEndsAt = useTimerStore((s) => s.examEndsAt);
  const getRemainingSeconds = useTimerStore((s) => s.getRemainingSeconds);
  const [remaining, setRemaining] = useState(fixedSeconds ?? 0);
  const timeUpFiredRef = useRef(false);

  useEffect(() => {
    if (typeof fixedSeconds === "number") {
      timeUpFiredRef.current = false;
      setRemaining(fixedSeconds);
      return;
    }
    timeUpFiredRef.current = false;
    setRemaining(getRemainingSeconds());
  }, [examEndsAt, fixedSeconds, getRemainingSeconds]);

  useEffect(() => {
    if (typeof fixedSeconds === "number") return;
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
  }, [examEndsAt, fixedSeconds, getRemainingSeconds, isRunning, onTimeUp]);

  const isLow = remaining > 0 && remaining <= 300;
  const isCritical = remaining > 0 && remaining <= 60;

  return (
    <div
      className={cn(
        "mt-0.5 inline-block min-w-[5.5rem] rounded border-2 px-3 py-1 text-center font-mono text-xl font-bold tabular-nums tracking-tight",
        isCritical
          ? "animate-pulse border-red-900 bg-red-600 text-white"
          : isLow
            ? "border-red-700 bg-red-600 text-white"
            : "border-[#1a3c6e] bg-[#1a3c6e] text-white",
      )}
    >
      <span className="sr-only">Time remaining: </span>
      {formatTime(remaining)}
    </div>
  );
}
