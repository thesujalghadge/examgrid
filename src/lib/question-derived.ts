import { isNumericalAnswerAttempted } from "@/lib/numerical";
import type { ExamDefinition, QuestionPaletteStatus } from "@/types/exam";

export interface PaletteCounts {
  notVisited: number;
  notAnswered: number;
  answered: number;
  markedForReview: number;
  answeredAndMarked: number;
}

export const EMPTY_PALETTE_COUNTS: PaletteCounts = {
  notVisited: 0,
  notAnswered: 0,
  answered: 0,
  markedForReview: 0,
  answeredAndMarked: 0,
};

function isQuestionAnswered(
  questionId: string,
  answers: Record<string, string | null>,
  exam: ExamDefinition | null,
): boolean {
  const value = answers[questionId];
  if (value == null) return false;
  const question = exam?.questions[questionId];
  if (question?.type === "NUMERICAL") {
    return isNumericalAnswerAttempted(value);
  }
  return value.length > 0;
}

export function deriveQuestionStatus(
  questionId: string,
  answers: Record<string, string | null>,
  visited: Record<string, boolean>,
  markedForReview: Record<string, boolean>,
  exam: ExamDefinition | null,
): QuestionPaletteStatus {
  const answered = isQuestionAnswered(questionId, answers, exam);
  const marked = !!markedForReview[questionId];
  const isVisited = !!visited[questionId];

  if (answered && marked) return "answered-and-marked";
  if (marked) return "marked-for-review";
  if (answered) return "answered";
  if (isVisited) return "not-answered";
  return "not-visited";
}

export function derivePaletteCounts(
  exam: ExamDefinition | null,
  answers: Record<string, string | null>,
  visited: Record<string, boolean>,
  markedForReview: Record<string, boolean>,
): PaletteCounts {
  if (!exam) return EMPTY_PALETTE_COUNTS;

  const counts: PaletteCounts = { ...EMPTY_PALETTE_COUNTS };
  const allIds = exam.sections.flatMap((s) => s.questionIds);

  for (const id of allIds) {
    const status = deriveQuestionStatus(
      id,
      answers,
      visited,
      markedForReview,
      exam,
    );
    switch (status) {
      case "not-visited":
        counts.notVisited++;
        break;
      case "not-answered":
        counts.notAnswered++;
        break;
      case "answered":
        counts.answered++;
        break;
      case "marked-for-review":
        counts.markedForReview++;
        break;
      case "answered-and-marked":
        counts.answeredAndMarked++;
        break;
    }
  }

  return counts;
}

export function deriveQuestionStatuses(
  exam: ExamDefinition | null,
  answers: Record<string, string | null>,
  visited: Record<string, boolean>,
  markedForReview: Record<string, boolean>,
): Record<string, QuestionPaletteStatus> {
  if (!exam) return {};

  const statuses: Record<string, QuestionPaletteStatus> = {};
  for (const section of exam.sections) {
    for (const id of section.questionIds) {
      statuses[id] = deriveQuestionStatus(
        id,
        answers,
        visited,
        markedForReview,
        exam,
      );
    }
  }
  return statuses;
}

function countsEqual(a: PaletteCounts, b: PaletteCounts): boolean {
  return (
    a.notVisited === b.notVisited &&
    a.notAnswered === b.notAnswered &&
    a.answered === b.answered &&
    a.markedForReview === b.markedForReview &&
    a.answeredAndMarked === b.answeredAndMarked
  );
}

export function mergeDerivedState<
  T extends {
    exam: ExamDefinition | null;
    answers: Record<string, string | null>;
    visited: Record<string, boolean>;
    markedForReview: Record<string, boolean>;
    paletteCounts: PaletteCounts;
    questionStatuses: Record<string, QuestionPaletteStatus>;
  },
>(state: T): Pick<T, "paletteCounts" | "questionStatuses"> {
  const nextCounts = derivePaletteCounts(
    state.exam,
    state.answers,
    state.visited,
    state.markedForReview,
  );
  const nextStatuses = deriveQuestionStatuses(
    state.exam,
    state.answers,
    state.visited,
    state.markedForReview,
  );

  return {
    paletteCounts: countsEqual(state.paletteCounts, nextCounts)
      ? state.paletteCounts
      : nextCounts,
    questionStatuses: nextStatuses,
  };
}
