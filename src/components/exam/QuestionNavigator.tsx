"use client";

import { Button } from "@/components/ui/button";
import { useQuestionStore } from "@/stores/question-store";

interface ReviewNavigatorProps {
  canMoveQuestionUp: boolean;
  canMoveQuestionDown: boolean;
  onMoveQuestion: (delta: -1 | 1) => void;
  onDeleteQuestion: () => void;
  onAddQuestion: () => void;
  onContinue: () => void;
}

interface QuestionNavigatorProps {
  onSubmitClick: () => void;
  review?: ReviewNavigatorProps;
}

export function QuestionNavigator({ onSubmitClick, review }: QuestionNavigatorProps) {
  const exam = useQuestionStore((s) => s.exam);
  const currentQuestionId = useQuestionStore((s) => s.currentQuestionId);
  const clearResponse = useQuestionStore((s) => s.clearResponse);
  const saveAndNext = useQuestionStore((s) => s.saveAndNext);
  const markForReviewAndNext = useQuestionStore((s) => s.markForReviewAndNext);
  const goPrevious = useQuestionStore((s) => s.goPrevious);
  const goNext = useQuestionStore((s) => s.goNext);

  const allIds = exam ? exam.sections.flatMap((s) => s.questionIds) : [];
  const idx = currentQuestionId ? allIds.indexOf(currentQuestionId) : -1;
  const isFirst = idx <= 0;
  const isLast = idx >= allIds.length - 1;

  return (
    <div className="border-t-2 border-[#1a3c6e]/20 bg-[#e8eef5] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {review ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-gray-400 bg-white px-4 font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
                disabled={!review.canMoveQuestionUp}
                onClick={() => review.onMoveQuestion(-1)}
              >
                Move Up
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-gray-400 bg-white px-4 font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
                disabled={!review.canMoveQuestionDown}
                onClick={() => review.onMoveQuestion(1)}
              >
                Move Down
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-gray-400 bg-white px-4 font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
                onClick={review.onAddQuestion}
              >
                Add Question
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-red-200 bg-white px-4 font-semibold text-red-700 shadow-sm hover:bg-red-50"
                onClick={review.onDeleteQuestion}
              >
                Delete
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 border-gray-400 bg-white px-4 font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
              disabled={!currentQuestionId}
              onClick={() => currentQuestionId && clearResponse(currentQuestionId)}
            >
              Clear Response
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 border-gray-400 bg-white px-4 font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
            disabled={isFirst}
            onClick={goPrevious}
          >
            &lt;&lt; Previous
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 border border-[#152d52] bg-[#1a3c6e] px-4 font-semibold text-white shadow-sm hover:bg-[#152d52]"
            disabled={isLast}
            onClick={goNext}
          >
            Next &gt;&gt;
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {review ? (
            <Button
              type="button"
              size="sm"
              className="h-9 bg-[#8a6f3e] px-5 font-bold text-white shadow-sm hover:bg-[#725c33]"
              onClick={review.onContinue}
            >
              Continue to Publish
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                className="h-9 bg-[#2e7d32] px-4 font-semibold text-white shadow-sm hover:bg-[#256628]"
                onClick={saveAndNext}
              >
                Save &amp; Next
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 bg-[#6a1b9a] px-4 font-semibold text-white shadow-sm hover:bg-[#5a1785]"
                onClick={markForReviewAndNext}
              >
                Mark for Review &amp; Next
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 bg-[#c62828] px-5 font-bold text-white shadow-sm hover:bg-[#a82020]"
                onClick={onSubmitClick}
              >
                Submit
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
