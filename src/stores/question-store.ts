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
  draftAnswers: Record<string, string | null>;
  visited: Record<string, boolean>;
  markedForReview: Record<string, boolean>;
  currentQuestionId: string | null;
  currentSectionId: string | null;
  paletteCounts: PaletteCounts;
  questionStatuses: Record<string, QuestionPaletteStatus>;

  timeSpentSeconds: Record<string, number>;
  answerChangedCount: Record<string, number>;
  visitedCount: Record<string, number>;
  firstAnswer: Record<string, string | null>;

  loadExam: (exam: ExamDefinition, startQuestionId: string) => void;
  restoreState: (payload: {
    exam: ExamDefinition;
    answers: Record<string, string | null>;
    visited: Record<string, boolean>;
    markedForReview: Record<string, boolean>;
    currentQuestionId: string;
    currentSectionId: string;
    timeSpentSeconds?: Record<string, number>;
    answerChangedCount?: Record<string, number>;
    visitedCount?: Record<string, number>;
    firstAnswer?: Record<string, string | null>;
  }) => void;
  reset: () => void;

  selectOption: (questionId: string, optionId: string, isMultiple?: boolean) => void;
  setNumericalAnswer: (questionId: string, value: string) => void;
  clearResponse: (questionId: string) => void;
  toggleMarkForReview: (questionId: string, marked: boolean) => void;
  goToQuestion: (questionId: string) => void;
  switchSection: (sectionId: string) => void;
  goNext: () => void;
  goPrevious: () => void;
  saveAndNext: () => void;
  markForReviewAndNext: () => void;
  incrementTimeSpent: (questionId: string, seconds: number) => void;
}

const initialState = {
  exam: null as ExamDefinition | null,
  answers: {} as Record<string, string | null>,
  draftAnswers: {} as Record<string, string | null>,
  visited: {} as Record<string, boolean>,
  markedForReview: {} as Record<string, boolean>,
  currentQuestionId: null as string | null,
  currentSectionId: null as string | null,
  paletteCounts: EMPTY_PALETTE_COUNTS,
  questionStatuses: {} as Record<string, QuestionPaletteStatus>,
  timeSpentSeconds: {} as Record<string, number>,
  answerChangedCount: {} as Record<string, number>,
  visitedCount: {} as Record<string, number>,
  firstAnswer: {} as Record<string, string | null>,
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
          draftAnswers: {},
          visited: { [startQuestionId]: true },
          markedForReview: {},
          currentQuestionId: startQuestionId,
          currentSectionId: sectionId,
          timeSpentSeconds: {},
          answerChangedCount: {},
          visitedCount: { [startQuestionId]: 1 },
          firstAnswer: {},
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
          draftAnswers: { ...payload.answers },
          visited: payload.visited,
          markedForReview: payload.markedForReview,
          currentQuestionId: payload.currentQuestionId,
          currentSectionId: payload.currentSectionId,
          timeSpentSeconds: payload.timeSpentSeconds ?? {},
          answerChangedCount: payload.answerChangedCount ?? {},
          visitedCount: payload.visitedCount ?? {},
          firstAnswer: payload.firstAnswer ?? {},
        },
        get(),
      ),
    );
  },

  reset: () => set(initialState),

  selectOption: (questionId, optionId, isMultiple) => {
    set((state) => {
      let newValue: string | null = optionId;
      if (isMultiple) {
        const current = state.draftAnswers[questionId] || "";
        const arr = current ? current.split(",") : [];
        if (arr.includes(optionId)) {
          const filtered = arr.filter((id) => id !== optionId);
          newValue = filtered.length > 0 ? filtered.join(",") : null;
        } else {
          newValue = [...arr, optionId].sort().join(",");
        }
      }
      const changed = state.draftAnswers[questionId] !== newValue;
      const first = state.firstAnswer[questionId] === undefined ? newValue : state.firstAnswer[questionId];
      return withDerived(
        {
          draftAnswers: { ...state.draftAnswers, [questionId]: newValue },
          visited: { ...state.visited, [questionId]: true },
          answerChangedCount: changed ? { ...state.answerChangedCount, [questionId]: (state.answerChangedCount[questionId] || 0) + 1 } : state.answerChangedCount,
          firstAnswer: { ...state.firstAnswer, [questionId]: first },
        },
        state,
      );
    });
  },

  setNumericalAnswer: (questionId, value) => {
    set((state) => {
      const changed = state.draftAnswers[questionId] !== value;
      const first = state.firstAnswer[questionId] === undefined ? value : state.firstAnswer[questionId];
      return withDerived(
        {
          draftAnswers: { ...state.draftAnswers, [questionId]: value },
          visited: { ...state.visited, [questionId]: true },
          answerChangedCount: changed ? { ...state.answerChangedCount, [questionId]: (state.answerChangedCount[questionId] || 0) + 1 } : state.answerChangedCount,
          firstAnswer: { ...state.firstAnswer, [questionId]: first },
        },
        state,
      );
    });
  },

  clearResponse: (questionId) => {
    set((state) => {
      const changed = state.draftAnswers[questionId] !== null;
      return withDerived(
        {
          answers: { ...state.answers, [questionId]: null },
          draftAnswers: { ...state.draftAnswers, [questionId]: null },
          visited: { ...state.visited, [questionId]: true },
          answerChangedCount: changed ? { ...state.answerChangedCount, [questionId]: (state.answerChangedCount[questionId] || 0) + 1 } : state.answerChangedCount,
        },
        state,
      );
    });
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
    const { exam, currentQuestionId } = get();
    if (!exam) return;
    const section = exam.sections.find((s) =>
      s.questionIds.includes(questionId),
    );
    set((state) => {
      // Rollback draft of the question we're leaving
      const rollbackDrafts = currentQuestionId 
        ? { ...state.draftAnswers, [currentQuestionId]: state.answers[currentQuestionId] ?? null }
        : state.draftAnswers;

      return withDerived(
        {
          currentQuestionId: questionId,
          currentSectionId: section?.id ?? state.currentSectionId,
          visited: { ...state.visited, [questionId]: true },
          visitedCount: { ...state.visitedCount, [questionId]: (state.visitedCount[questionId] || 0) + 1 },
          draftAnswers: rollbackDrafts,
        },
        state,
      );
    });
  },

  switchSection: (sectionId) => {
    const { exam, currentQuestionId } = get();
    if (!exam) return;
    const section = exam.sections.find((s) => s.id === sectionId);
    if (!section || section.questionIds.length === 0) return;
    const firstQ = section.questionIds[0];
    set((state) => {
      const rollbackDrafts = currentQuestionId 
        ? { ...state.draftAnswers, [currentQuestionId]: state.answers[currentQuestionId] ?? null }
        : state.draftAnswers;

      return withDerived(
        {
          currentSectionId: sectionId,
          currentQuestionId: firstQ,
          visited: { ...state.visited, [firstQ]: true },
          visitedCount: { ...state.visitedCount, [firstQ]: (state.visitedCount[firstQ] || 0) + 1 },
          draftAnswers: rollbackDrafts,
        },
        state,
      );
    });
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
    const { currentQuestionId } = get();
    if (currentQuestionId) {
      set((state) => {
        const drafted = state.draftAnswers[currentQuestionId];
        return withDerived(
          {
            answers: { ...state.answers, [currentQuestionId]: drafted ?? null },
            markedForReview: { ...state.markedForReview, [currentQuestionId]: false },
            visited: { ...state.visited, [currentQuestionId]: true },
          },
          state,
        );
      });
    }
    // goNext internally calls goToQuestion which will handle rollback, but since we committed to answers, rollback does nothing.
    get().goNext();
  },

  markForReviewAndNext: () => {
    const { currentQuestionId } = get();
    if (currentQuestionId) {
      set((state) => {
        const drafted = state.draftAnswers[currentQuestionId];
        return withDerived(
          {
            answers: { ...state.answers, [currentQuestionId]: drafted ?? null },
            markedForReview: { ...state.markedForReview, [currentQuestionId]: true },
            visited: { ...state.visited, [currentQuestionId]: true },
          },
          state,
        );
      });
    }
    get().goNext();
  },

  incrementTimeSpent: (questionId, seconds) => {
    set((state) => ({
      timeSpentSeconds: { ...state.timeSpentSeconds, [questionId]: (state.timeSpentSeconds[questionId] || 0) + seconds }
    }));
  },
}));

/** Stable selector — returns store-owned object, not a per-render allocation. */
export const selectPaletteCounts = (s: QuestionState) => s.paletteCounts;
