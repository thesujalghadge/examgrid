import { create } from "zustand";
import {
  EMPTY_PALETTE_COUNTS,
  mergeDerivedState,
  type PaletteCounts,
} from "@/lib/question-derived";
import type { ExamDefinition, QuestionPaletteStatus } from "@/types/exam";

interface QuestionState {
  exam: ExamDefinition | null;
  answers: Record<string, string | null>;
  visited: Record<string, boolean>;
  markedForReview: Record<string, boolean>;
  currentQuestionId: string | null;
  currentSectionId: string | null;
  paletteCounts: PaletteCounts;
  questionStatuses: Record<string, QuestionPaletteStatus>;

  loadExam: (exam: ExamDefinition, startQuestionId: string) => void;
  restoreState: (payload: {
    exam: ExamDefinition;
    answers: Record<string, string | null>;
    visited: Record<string, boolean>;
    markedForReview: Record<string, boolean>;
    currentQuestionId: string;
    currentSectionId: string;
  }) => void;
  reset: () => void;

  selectOption: (questionId: string, optionId: string) => void;
  setNumericalAnswer: (questionId: string, value: string) => void;
  clearResponse: (questionId: string) => void;
  toggleMarkForReview: (questionId: string, marked: boolean) => void;
  goToQuestion: (questionId: string) => void;
  switchSection: (sectionId: string) => void;
  goNext: () => void;
  goPrevious: () => void;
  saveAndNext: () => void;
  markForReviewAndNext: () => void;
}

const initialState = {
  exam: null as ExamDefinition | null,
  answers: {} as Record<string, string | null>,
  visited: {} as Record<string, boolean>,
  markedForReview: {} as Record<string, boolean>,
  currentQuestionId: null as string | null,
  currentSectionId: null as string | null,
  paletteCounts: EMPTY_PALETTE_COUNTS,
  questionStatuses: {} as Record<string, QuestionPaletteStatus>,
};

function withDerived(
  patch: Partial<typeof initialState>,
  current: typeof initialState,
): typeof initialState {
  const merged = { ...current, ...patch };
  return { ...merged, ...mergeDerivedState(merged) };
}

export const useQuestionStore = create<QuestionState>((set, get) => ({
  ...initialState,

  loadExam: (exam, startQuestionId) => {
    const sectionId =
      exam.sections.find((s) => s.questionIds.includes(startQuestionId))?.id ??
      exam.sections[0].id;

    set(
      withDerived(
        {
          exam,
          answers: {},
          visited: { [startQuestionId]: true },
          markedForReview: {},
          currentQuestionId: startQuestionId,
          currentSectionId: sectionId,
        },
        get(),
      ),
    );
  },

  restoreState: (payload) => {
    set(
      withDerived(
        {
          exam: payload.exam,
          answers: payload.answers,
          visited: payload.visited,
          markedForReview: payload.markedForReview,
          currentQuestionId: payload.currentQuestionId,
          currentSectionId: payload.currentSectionId,
        },
        get(),
      ),
    );
  },

  reset: () => set(initialState),

  selectOption: (questionId, optionId) => {
    set((state) =>
      withDerived(
        {
          answers: { ...state.answers, [questionId]: optionId },
          visited: { ...state.visited, [questionId]: true },
        },
        state,
      ),
    );
  },

  setNumericalAnswer: (questionId, value) => {
    set((state) =>
      withDerived(
        {
          answers: { ...state.answers, [questionId]: value },
          visited: { ...state.visited, [questionId]: true },
        },
        state,
      ),
    );
  },

  clearResponse: (questionId) => {
    set((state) =>
      withDerived(
        {
          answers: { ...state.answers, [questionId]: null },
          visited: { ...state.visited, [questionId]: true },
        },
        state,
      ),
    );
  },

  toggleMarkForReview: (questionId, marked) => {
    set((state) =>
      withDerived(
        {
          markedForReview: { ...state.markedForReview, [questionId]: marked },
          visited: { ...state.visited, [questionId]: true },
        },
        state,
      ),
    );
  },

  goToQuestion: (questionId) => {
    const { exam } = get();
    if (!exam) return;
    const section = exam.sections.find((s) =>
      s.questionIds.includes(questionId),
    );
    set((state) =>
      withDerived(
        {
          currentQuestionId: questionId,
          currentSectionId: section?.id ?? state.currentSectionId,
          visited: { ...state.visited, [questionId]: true },
        },
        state,
      ),
    );
  },

  switchSection: (sectionId) => {
    const { exam } = get();
    if (!exam) return;
    const section = exam.sections.find((s) => s.id === sectionId);
    if (!section || section.questionIds.length === 0) return;
    const firstQ = section.questionIds[0];
    set((state) =>
      withDerived(
        {
          currentSectionId: sectionId,
          currentQuestionId: firstQ,
          visited: { ...state.visited, [firstQ]: true },
        },
        state,
      ),
    );
  },

  goNext: () => {
    const { exam, currentQuestionId } = get();
    if (!exam || !currentQuestionId) return;
    const allIds = exam.sections.flatMap((s) => s.questionIds);
    const idx = allIds.indexOf(currentQuestionId);
    if (idx < allIds.length - 1) {
      get().goToQuestion(allIds[idx + 1]);
    }
  },

  goPrevious: () => {
    const { exam, currentQuestionId } = get();
    if (!exam || !currentQuestionId) return;
    const allIds = exam.sections.flatMap((s) => s.questionIds);
    const idx = allIds.indexOf(currentQuestionId);
    if (idx > 0) {
      get().goToQuestion(allIds[idx - 1]);
    }
  },

  saveAndNext: () => {
    const { currentQuestionId, visited } = get();
    if (currentQuestionId) {
      set((state) =>
        withDerived(
          { visited: { ...visited, [currentQuestionId]: true } },
          state,
        ),
      );
    }
    get().goNext();
  },

  markForReviewAndNext: () => {
    const { currentQuestionId } = get();
    if (currentQuestionId) {
      get().toggleMarkForReview(currentQuestionId, true);
    }
    get().goNext();
  },
}));

/** Stable selector — returns store-owned object, not a per-render allocation. */
export const selectPaletteCounts = (s: QuestionState) => s.paletteCounts;
