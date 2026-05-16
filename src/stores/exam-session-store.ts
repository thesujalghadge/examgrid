import { create } from "zustand";
import type { ExamViolation, ExamViolationType } from "@/types/exam";

interface ExamSessionState {
  violations: ExamViolation[];
  lastViolationMessage: string | null;
  restoreViolations: (violations: ExamViolation[]) => void;
  recordViolation: (type: ExamViolationType) => ExamViolation;
  clearLastMessage: () => void;
  reset: () => void;
}

const VIOLATION_MESSAGES: Record<ExamViolationType, string> = {
  tab_switch: "Exam tab switching detected.",
  window_blur: "Exam window focus lost. Stay on the exam screen.",
  fullscreen_exit: "You exited fullscreen mode. Please return to fullscreen.",
  browser_back: "Browser back navigation detected during the exam.",
};

export const useExamSessionStore = create<ExamSessionState>((set, get) => ({
  violations: [],
  lastViolationMessage: null,

  restoreViolations: (violations) => set({ violations }),

  recordViolation: (type) => {
    const violation: ExamViolation = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      timestamp: Date.now(),
    };
    set({
      violations: [...get().violations, violation],
      lastViolationMessage: VIOLATION_MESSAGES[type],
    });
    return violation;
  },

  clearLastMessage: () => set({ lastViolationMessage: null }),

  reset: () => set({ violations: [], lastViolationMessage: null }),
}));

export const selectViolationCount = (s: ExamSessionState) => s.violations.length;
