import { create } from "zustand";
import type { ExamLifecyclePhase } from "@/types/exam";

interface ExamLifecycleState {
  examId: string | null;
  phase: ExamLifecyclePhase;
  setExamId: (examId: string | null) => void;
  setPhase: (phase: ExamLifecyclePhase) => void;
  reset: () => void;
}

export const useExamLifecycleStore = create<ExamLifecycleState>((set) => ({
  examId: null,
  phase: "idle",
  setExamId: (examId) => set({ examId }),
  setPhase: (phase) => set({ phase }),
  reset: () => set({ examId: null, phase: "idle" }),
}));
