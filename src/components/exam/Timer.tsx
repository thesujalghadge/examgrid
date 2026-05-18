"use client";

import { useEffect, useRef, useState } from "react";
import { useTimerStore } from "@/stores/timer-store";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

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
  const [remaining, setRemaining] = useState(() =>
    useTimerStore.getState().getRemainingSeconds(),
  );
  const timeUpFiredRef = useRef(false);

  useEffect(() => {
    timeUpFiredRef.current = false;
  }, [examEndsAt]);

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

  const isLow = remaining > 0 && remaining <= 300; // 5 mins
  const isCritical = remaining > 0 && remaining <= 60; // 1 min

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-1 font-mono text-sm md:text-base font-medium tabular-nums tracking-tight transition-colors duration-500",
        isCritical
          ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
          : isLow
            ? "border-border bg-muted/50 text-foreground"
            : "border-border bg-card text-foreground",
      )}
    >
      <Clock className={cn("h-3.5 w-3.5", isCritical ? "text-amber-500" : "text-muted-foreground")} />
      <span className="sr-only">Time remaining: </span>
      {formatTime(remaining)}
    </div>
  );
}
