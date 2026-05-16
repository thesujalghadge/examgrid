import { create } from "zustand";

interface TimerState {
  examEndsAt: number | null;
  isRunning: boolean;
  start: (durationMinutes: number) => void;
  restore: (examEndsAt: number) => void;
  stop: () => void;
  getRemainingSeconds: () => number;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  examEndsAt: null,
  isRunning: false,

  start: (durationMinutes) => {
    const examEndsAt = Date.now() + durationMinutes * 60 * 1000;
    set({ examEndsAt, isRunning: true });
  },

  restore: (examEndsAt) => {
    const remaining = examEndsAt - Date.now();
    set({
      examEndsAt,
      isRunning: remaining > 0,
    });
  },

  stop: () => set({ isRunning: false }),

  getRemainingSeconds: () => {
    const { examEndsAt } = get();
    if (!examEndsAt) return 0;
    return Math.max(0, Math.floor((examEndsAt - Date.now()) / 1000));
  },
}));
